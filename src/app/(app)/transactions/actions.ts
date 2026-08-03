"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  TRANSACTION_TYPES,
  EXPENSE_CLASSIFICATIONS,
  FUNDING_SOURCES,
  type TransactionType,
  type ExpenseClassification,
  type FundingSource,
} from "@/lib/transactions"
import { computeSavingsSplit } from "@/lib/savings"
import { isPhysicalAccount, assertSufficientBalance } from "@/lib/accounts"
import { denominationsFor, denominationFieldName } from "@/lib/denominations"
import { toActionResult, type ActionResult } from "@/lib/action-result"
import type { SupabaseClient } from "@supabase/supabase-js"

function parseEnum<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[]
): T | null {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) return null
  return value as T
}

type TransactionPayload = {
  type: TransactionType
  transaction_date: string
  amount: number
  description: string | null
  account_id: string
  destination_account_id: string | null
  category_id: string | null
  expense_classification: ExpenseClassification | null
  funding_source: FundingSource | null
  savings_goal_id: string | null
}

/**
 * One transaction form covers four very different shapes of row. This
 * parses+validates the raw FormData once and returns a full column patch
 * (irrelevant fields explicitly nulled) so switching a transaction's type
 * on edit can't leave stale values from the old type behind.
 *
 * `payload.savings_goal_id` is only for an EXPENSE drawing on a single goal
 * (SAVED_MONEY funding) — a single-goal draw needs no split. A SAVINGS
 * transaction's goal(s) live in `savings_allocations` instead, computed
 * separately by `applySavingsSplit` since it fans out across every active
 * goal by percentage.
 */
function parseTransactionForm(formData: FormData): TransactionPayload {
  const type = parseEnum<TransactionType>(formData.get("type"), TRANSACTION_TYPES)
  if (!type) throw new Error("Invalid transaction type")

  const transaction_date = String(formData.get("transaction_date") ?? "")
  if (!transaction_date) throw new Error("Date is required")

  const amount = Number(formData.get("amount"))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount")

  const description = String(formData.get("description") ?? "").trim() || null
  const account_id = String(formData.get("account_id") ?? "")
  if (!account_id) throw new Error("Account is required")

  const payload: TransactionPayload = {
    type,
    transaction_date,
    amount,
    description,
    account_id,
    destination_account_id: null,
    category_id: null,
    expense_classification: null,
    funding_source: null,
    savings_goal_id: null,
  }

  if (type === "INCOME") {
    payload.category_id = String(formData.get("category_id") ?? "")
    if (!payload.category_id) throw new Error("Category is required")
  } else if (type === "EXPENSE") {
    payload.category_id = String(formData.get("category_id") ?? "")
    if (!payload.category_id) throw new Error("Category is required")

    payload.expense_classification = parseEnum<ExpenseClassification>(
      formData.get("expense_classification"),
      EXPENSE_CLASSIFICATIONS
    )
    if (!payload.expense_classification) throw new Error("Expense classification is required")

    payload.funding_source = parseEnum<FundingSource>(
      formData.get("funding_source"),
      FUNDING_SOURCES
    )
    if (!payload.funding_source) throw new Error("Funding source is required")

    if (payload.funding_source === "SAVED_MONEY") {
      payload.savings_goal_id = String(formData.get("savings_goal_id") ?? "")
      if (!payload.savings_goal_id) {
        throw new Error("Savings goal is required when spending saved money")
      }
    }
  } else if (type === "TRANSFER") {
    payload.destination_account_id = String(formData.get("destination_account_id") ?? "")
    if (!payload.destination_account_id) throw new Error("Destination account is required")
    if (payload.destination_account_id === account_id) {
      throw new Error("Destination account must differ from the source account")
    }
  }
  // SAVINGS needs no extra fields here — see applySavingsSplit.

  return payload
}

/** Replaces a SAVINGS transaction's allocations with a fresh even split. */
async function applySavingsSplit(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
  amount: number
) {
  const { data: goals } = await supabase
    .from("savings_goals")
    .select("id, is_unallocated")
    .eq("user_id", userId)
    .eq("is_active", true)

  const unallocatedGoal = goals?.find((g) => g.is_unallocated)
  if (!unallocatedGoal) {
    throw new Error("No Unallocated Savings goal found — visit the Savings page first")
  }

  const activeGoalIds = (goals ?? []).filter((g) => !g.is_unallocated).map((g) => g.id)
  const split = computeSavingsSplit(amount, activeGoalIds, unallocatedGoal.id)

  const { error } = await supabase.from("savings_allocations").insert(
    split.map((s) => ({
      user_id: userId,
      transaction_id: transactionId,
      savings_goal_id: s.savings_goal_id,
      amount: s.amount,
      allocation_type: "EVEN_SPLIT",
    }))
  )
  if (error) throw new Error(error.message)
}

type DenominationEntry = { denomination: number; quantity: number }
type DenominationRow = {
  user_id: string
  account_id: string
  denomination: number
  quantity: number
  direction: "IN" | "OUT"
}

function parseDenominationQuantities(
  formData: FormData,
  prefix: string,
  denominations: readonly number[]
): DenominationEntry[] {
  const result: DenominationEntry[] = []
  for (const d of denominations) {
    const qty = Math.floor(Number(formData.get(denominationFieldName(prefix, d)) ?? 0))
    if (qty > 0) result.push({ denomination: d, quantity: qty })
  }
  return result
}

function totalOf(entries: DenominationEntry[]): number {
  return Math.round(entries.reduce((sum, e) => sum + e.denomination * e.quantity, 0) * 100) / 100
}

/**
 * Blocks an OUT movement that would drain a denomination past zero — the
 * physical Hard Floor. On an edit, `excludeTransactionId` backs out this
 * same transaction's own existing rows first (they're about to be replaced),
 * so re-submitting an unchanged breakdown never falsely double-claims
 * inventory it's already holding — mirrors `oldEffectOnAccount` below, one
 * level more granular (per-denomination instead of per-account-total).
 */
async function assertDenominationsAvailable(
  supabase: SupabaseClient,
  accountId: string,
  out: DenominationEntry[],
  excludeTransactionId?: string
) {
  if (out.length === 0) return
  const { data: balances } = await supabase
    .from("denomination_balances")
    .select("denomination, on_hand")
    .eq("account_id", accountId)

  const onHand = new Map((balances ?? []).map((b) => [b.denomination, b.on_hand as number]))

  if (excludeTransactionId) {
    const { data: ownRows } = await supabase
      .from("transaction_denominations")
      .select("denomination, quantity, direction")
      .eq("transaction_id", excludeTransactionId)
      .eq("account_id", accountId)
    for (const r of ownRows ?? []) {
      const delta = r.direction === "IN" ? -r.quantity : r.quantity
      onHand.set(r.denomination, (onHand.get(r.denomination) ?? 0) + delta)
    }
  }

  for (const o of out) {
    const available = onHand.get(o.denomination) ?? 0
    if (o.quantity > available) {
      throw new Error(
        `Not enough ₱${o.denomination} on hand (have ${available}, need ${o.quantity})`
      )
    }
  }
}

/**
 * The complementary physical account (Paper Cash <-> Coin Pouch) — an
 * EXPENSE's change can land here too, e.g. coins as change for a Paper Cash
 * payment. Returns undefined if the user has no active account of that type,
 * in which case change is simply confined to the paying account as before.
 */
async function findOtherPhysicalAccount(
  supabase: SupabaseClient,
  userId: string,
  accountType: string
): Promise<{ id: string; type: string } | undefined> {
  const otherType = accountType === "PAPER_CASH" ? "COIN_POUCH" : "PAPER_CASH"
  const { data } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("user_id", userId)
    .eq("account_type", otherType)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()
  return data ? { id: data.id, type: data.account_type } : undefined
}

/**
 * Validates a physical EXPENSE's "Direct Payments & Change" breakdown and
 * returns the ledger rows to insert. Runs entirely *before* the parent
 * transaction is written, so a Hard Floor violation or an arithmetic
 * mismatch blocks the whole entry instead of leaving an orphaned
 * transaction row with no denomination backing.
 *
 * Change can be split across two accounts — `otherAccount`'s denominations
 * (e.g. Coin Pouch coins received as change for a Paper Cash bill) post to
 * that account's ledger, not the paying account's.
 */
async function validatePhysicalExpense(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  accountType: string,
  amount: number,
  formData: FormData,
  otherAccount?: { id: string; type: string },
  excludeTransactionId?: string
): Promise<DenominationRow[]> {
  const denominations = denominationsFor(accountType as never)
  const handed = parseDenominationQuantities(formData, "handed", denominations)
  const changeOwn = parseDenominationQuantities(formData, "change", denominations)
  const otherDenominations = otherAccount ? denominationsFor(otherAccount.type as never) : []
  const changeOther = otherAccount
    ? parseDenominationQuantities(formData, "change_other", otherDenominations)
    : []

  if (handed.length === 0) {
    throw new Error("Denomination breakdown (handed over) is required for physical cash expenses")
  }

  const handedTotal = totalOf(handed)
  const changeTotal = Math.round((totalOf(changeOwn) + totalOf(changeOther)) * 100) / 100

  if (handedTotal < amount) {
    throw new Error(
      `Handed over (₱${handedTotal}) is less than the expense (₱${amount}) — hand over enough to cover it`
    )
  }

  const expectedChange = Math.round((handedTotal - amount) * 100) / 100
  if (Math.round((expectedChange - changeTotal) * 100) / 100 !== 0) {
    throw new Error(
      `Handed over (₱${handedTotal}) minus the expense (₱${amount}) must equal change — expected ₱${expectedChange}, got ₱${changeTotal}`
    )
  }

  await assertDenominationsAvailable(supabase, accountId, handed, excludeTransactionId)

  return [
    ...handed.map((h) => ({
      user_id: userId,
      account_id: accountId,
      denomination: h.denomination,
      quantity: h.quantity,
      direction: "OUT" as const,
    })),
    ...changeOwn.map((c) => ({
      user_id: userId,
      account_id: accountId,
      denomination: c.denomination,
      quantity: c.quantity,
      direction: "IN" as const,
    })),
    ...changeOther.map((c) => ({
      user_id: userId,
      account_id: otherAccount!.id,
      denomination: c.denomination,
      quantity: c.quantity,
      direction: "IN" as const,
    })),
  ]
}

/**
 * Validates a physical INCOME's declared denomination breakdown and returns
 * the ledger rows to insert. No inventory floor to check here — receiving
 * cash is always an IN movement, which can never drain a denomination past
 * zero — so unlike the EXPENSE/TRANSFER validators this needs no Supabase
 * client and isn't async.
 */
function validateIncomeDenomination(
  userId: string,
  accountId: string,
  accountType: string,
  amount: number,
  formData: FormData
): DenominationRow[] {
  const denominations = denominationsFor(accountType as never)
  const received = parseDenominationQuantities(formData, "received", denominations)

  if (received.length === 0) {
    throw new Error("Denomination breakdown is required for physical cash income")
  }

  const receivedTotal = totalOf(received)
  if (receivedTotal !== amount) {
    throw new Error(
      `Denomination breakdown (₱${receivedTotal}) must equal the income amount (₱${amount})`
    )
  }

  return received.map((r) => ({
    user_id: userId,
    account_id: accountId,
    denomination: r.denomination,
    quantity: r.quantity,
    direction: "IN" as const,
  }))
}

/**
 * Validates a "Breaking Bills" TRANSFER (re-denominating money between two
 * physical accounts) and returns the ledger rows to insert. Same
 * validate-before-write ordering as `validatePhysicalExpense`.
 */
async function validateBreakingBills(
  supabase: SupabaseClient,
  userId: string,
  sourceAccountId: string,
  sourceAccountType: string,
  destAccountId: string,
  destAccountType: string,
  amount: number,
  formData: FormData,
  excludeTransactionId?: string
): Promise<DenominationRow[]> {
  const out = parseDenominationQuantities(formData, "out", denominationsFor(sourceAccountType as never))
  const inn = parseDenominationQuantities(formData, "in", denominationsFor(destAccountType as never))

  if (out.length === 0 || inn.length === 0) {
    throw new Error("Denomination breakdown (take out / put in) is required to break bills")
  }

  const outTotal = totalOf(out)
  const inTotal = totalOf(inn)
  if (outTotal !== amount || inTotal !== amount) {
    throw new Error(
      `Both sides of a breaking-bills transfer must total the transfer amount (₱${amount}); got out ₱${outTotal}, in ₱${inTotal}`
    )
  }

  await assertDenominationsAvailable(supabase, sourceAccountId, out, excludeTransactionId)

  return [
    ...out.map((o) => ({
      user_id: userId,
      account_id: sourceAccountId,
      denomination: o.denomination,
      quantity: o.quantity,
      direction: "OUT" as const,
    })),
    ...inn.map((i) => ({
      user_id: userId,
      account_id: destAccountId,
      denomination: i.denomination,
      quantity: i.quantity,
      direction: "IN" as const,
    })),
  ]
}

/**
 * account_balances.balance already includes this (pre-edit) row's effect,
 * so validating a new amount on update needs that old effect backed out
 * first — mirrors the view's own signed formula per transaction type.
 */
function oldEffectOnAccount(
  old: {
    type: TransactionType
    amount: number
    account_id: string | null
    destination_account_id: string | null
  },
  targetAccountId: string
): number {
  if (old.type === "INCOME") return old.account_id === targetAccountId ? old.amount : 0
  if (old.type === "EXPENSE") return old.account_id === targetAccountId ? -old.amount : 0
  if (old.type === "TRANSFER") {
    let effect = 0
    if (old.account_id === targetAccountId) effect -= old.amount
    if (old.destination_account_id === targetAccountId) effect += old.amount
    return effect
  }
  return 0 // SAVINGS never affects account_balances.balance
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const payload = parseTransactionForm(formData)

  const accountIds = [payload.account_id, payload.destination_account_id].filter(
    (id): id is string => Boolean(id)
  )
  const { data: accountRows } = await supabase
    .from("account_balances")
    .select("account_id, name, account_type, balance")
    .in("account_id", accountIds)
  const accountById = new Map((accountRows ?? []).map((a) => [a.account_id, a]))

  const sourceType = accountById.get(payload.account_id)?.account_type
  const destType = payload.destination_account_id
    ? accountById.get(payload.destination_account_id)?.account_type
    : undefined

  // Physical-cash accounts need their denomination breakdown fully
  // validated *before* the transaction is written (see the validate*
  // helpers above) — never insert the transaction row first and hope.
  let denominationRows: DenominationRow[] = []
  if (payload.type === "EXPENSE" && sourceType && isPhysicalAccount(sourceType)) {
    const otherAccount = await findOtherPhysicalAccount(supabase, user.id, sourceType)
    denominationRows = await validatePhysicalExpense(
      supabase,
      user.id,
      payload.account_id,
      sourceType,
      payload.amount,
      formData,
      otherAccount
    )
  } else if (payload.type === "INCOME" && sourceType && isPhysicalAccount(sourceType)) {
    denominationRows = validateIncomeDenomination(
      user.id,
      payload.account_id,
      sourceType,
      payload.amount,
      formData
    )
  } else if (
    payload.type === "TRANSFER" &&
    sourceType &&
    destType &&
    payload.destination_account_id &&
    isPhysicalAccount(sourceType) &&
    isPhysicalAccount(destType)
  ) {
    denominationRows = await validateBreakingBills(
      supabase,
      user.id,
      payload.account_id,
      sourceType,
      payload.destination_account_id,
      destType,
      payload.amount,
      formData
    )
  }

  // The Hard Floor: an EXPENSE or SAVINGS can never exceed the selected
  // account's actual balance, for any account type — see account_balances.
  // Runs after the physical check so a Coin Pouch expense with insufficient
  // denominations gets the more specific error first.
  if (payload.type === "EXPENSE" || payload.type === "SAVINGS") {
    const acc = accountById.get(payload.account_id)
    if (acc) assertSufficientBalance(acc.balance, payload.amount, acc.name)
  }

  // Both inserts happen inside one Postgres function call so they're
  // atomic — a denomination-floor trigger failure rolls back the whole
  // transaction row too, instead of leaving it orphaned with no ledger
  // backing it (see save_transaction_with_denominations migration).
  const { data: transactionId, error } = await supabase.rpc("save_transaction_with_denominations", {
    p_transaction_id: null,
    p_type: payload.type,
    p_transaction_date: payload.transaction_date,
    p_amount: payload.amount,
    p_description: payload.description,
    p_account_id: payload.account_id,
    p_destination_account_id: payload.destination_account_id,
    p_category_id: payload.category_id,
    p_expense_classification: payload.expense_classification,
    p_funding_source: payload.funding_source,
    p_savings_goal_id: payload.savings_goal_id,
    p_denomination_rows: denominationRows.map(({ account_id, denomination, quantity, direction }) => ({
      account_id,
      denomination,
      quantity,
      direction,
    })),
  })
  if (error) throw new Error(error.message)

  if (payload.type === "SAVINGS") {
    await applySavingsSplit(supabase, user.id, transactionId, payload.amount)
  }

  revalidatePath("/", "layout")
  return "Transaction added"
  })
}

export async function updateTransaction(transactionId: string, formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const payload = parseTransactionForm(formData)

    const { data: oldRow } = await supabase
      .from("transactions")
      .select("type, amount, account_id, destination_account_id")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single()
    if (!oldRow) throw new Error("Transaction not found")

    const accountIds = [payload.account_id, payload.destination_account_id].filter(
      (id): id is string => Boolean(id)
    )
    const { data: accountRows } = await supabase
      .from("account_balances")
      .select("account_id, name, account_type, balance")
      .in("account_id", accountIds)
    const accountById = new Map((accountRows ?? []).map((a) => [a.account_id, a]))

    const sourceType = accountById.get(payload.account_id)?.account_type
    const destType = payload.destination_account_id
      ? accountById.get(payload.destination_account_id)?.account_type
      : undefined

    // Same validate-before-write flow as createTransaction, with the
    // transaction's own current rows excluded from the inventory check
    // since they're about to be replaced (see assertDenominationsAvailable).
    let denominationRows: DenominationRow[] = []
    if (payload.type === "EXPENSE" && sourceType && isPhysicalAccount(sourceType)) {
      const otherAccount = await findOtherPhysicalAccount(supabase, user.id, sourceType)
      denominationRows = await validatePhysicalExpense(
        supabase,
        user.id,
        payload.account_id,
        sourceType,
        payload.amount,
        formData,
        otherAccount,
        transactionId
      )
    } else if (payload.type === "INCOME" && sourceType && isPhysicalAccount(sourceType)) {
      denominationRows = validateIncomeDenomination(
        user.id,
        payload.account_id,
        sourceType,
        payload.amount,
        formData
      )
    } else if (
      payload.type === "TRANSFER" &&
      sourceType &&
      destType &&
      payload.destination_account_id &&
      isPhysicalAccount(sourceType) &&
      isPhysicalAccount(destType)
    ) {
      denominationRows = await validateBreakingBills(
        supabase,
        user.id,
        payload.account_id,
        sourceType,
        payload.destination_account_id,
        destType,
        payload.amount,
        formData,
        transactionId
      )
    }

    if (payload.type === "EXPENSE" || payload.type === "SAVINGS") {
      const acc = accountById.get(payload.account_id)
      if (acc) {
        const baseline = acc.balance - oldEffectOnAccount(oldRow, payload.account_id)
        assertSufficientBalance(baseline, payload.amount, acc.name)
      }
    }

    // Update + denomination replace happen atomically — see
    // save_transaction_with_denominations migration.
    const { error } = await supabase.rpc("save_transaction_with_denominations", {
      p_transaction_id: transactionId,
      p_type: payload.type,
      p_transaction_date: payload.transaction_date,
      p_amount: payload.amount,
      p_description: payload.description,
      p_account_id: payload.account_id,
      p_destination_account_id: payload.destination_account_id,
      p_category_id: payload.category_id,
      p_expense_classification: payload.expense_classification,
      p_funding_source: payload.funding_source,
      p_savings_goal_id: payload.savings_goal_id,
      p_denomination_rows: denominationRows.map(({ account_id, denomination, quantity, direction }) => ({
        account_id,
        denomination,
        quantity,
        direction,
      })),
    })
    if (error) throw new Error(error.message)

    // Always clear the old allocation first: covers editing the amount of a
    // SAVINGS transaction (needs a fresh split), and switching away from
    // SAVINGS entirely.
    const { error: clearError } = await supabase
      .from("savings_allocations")
      .delete()
      .eq("transaction_id", transactionId)
      .eq("user_id", user.id)
    if (clearError) throw new Error(clearError.message)

    if (payload.type === "SAVINGS") {
      await applySavingsSplit(supabase, user.id, transactionId, payload.amount)
    }

    revalidatePath("/", "layout")
    redirect("/transactions")
  })
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)

    revalidatePath("/", "layout")
    return "Transaction deleted"
  })
}
