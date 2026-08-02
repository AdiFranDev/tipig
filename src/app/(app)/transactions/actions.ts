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
import { isPhysicalAccount } from "@/lib/accounts"
import { denominationsFor, denominationFieldName } from "@/lib/denominations"
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

/** Replaces a SAVINGS transaction's allocations with a fresh percentage split. */
async function applySavingsSplit(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
  amount: number
) {
  const { data: goals } = await supabase
    .from("savings_goals")
    .select("id, allocation_percentage, is_unallocated")
    .eq("user_id", userId)
    .eq("is_active", true)

  const unallocatedGoal = goals?.find((g) => g.is_unallocated)
  if (!unallocatedGoal) {
    throw new Error("No Unallocated Savings goal found — visit the Savings page first")
  }

  const split = computeSavingsSplit(
    amount,
    (goals ?? []).filter((g) => !g.is_unallocated),
    unallocatedGoal.id
  )

  const { error } = await supabase.from("savings_allocations").insert(
    split.map((s) => ({
      user_id: userId,
      transaction_id: transactionId,
      savings_goal_id: s.savings_goal_id,
      amount: s.amount,
      allocation_type: "PERCENTAGE",
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

/** Blocks an OUT movement that would drain a denomination past zero — the physical Hard Floor. */
async function assertDenominationsAvailable(
  supabase: SupabaseClient,
  accountId: string,
  out: DenominationEntry[]
) {
  if (out.length === 0) return
  const { data: balances } = await supabase
    .from("denomination_balances")
    .select("denomination, on_hand")
    .eq("account_id", accountId)

  const onHand = new Map((balances ?? []).map((b) => [b.denomination, b.on_hand as number]))
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
 * Validates a physical EXPENSE's "Direct Payments & Change" breakdown and
 * returns the ledger rows to insert. Runs entirely *before* the parent
 * transaction is written, so a Hard Floor violation or an arithmetic
 * mismatch blocks the whole entry instead of leaving an orphaned
 * transaction row with no denomination backing.
 */
async function validatePhysicalExpense(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  accountType: string,
  amount: number,
  formData: FormData
): Promise<DenominationRow[]> {
  const denominations = denominationsFor(accountType as never)
  const handed = parseDenominationQuantities(formData, "handed", denominations)
  const change = parseDenominationQuantities(formData, "change", denominations)

  if (handed.length === 0) {
    throw new Error("Denomination breakdown (handed over) is required for physical cash expenses")
  }

  const handedTotal = totalOf(handed)
  const changeTotal = totalOf(change)
  const expectedChange = Math.round((handedTotal - amount) * 100) / 100
  if (Math.round((expectedChange - changeTotal) * 100) / 100 !== 0) {
    throw new Error(
      `Handed over (₱${handedTotal}) minus the expense (₱${amount}) must equal change — expected ₱${expectedChange}, got ₱${changeTotal}`
    )
  }

  await assertDenominationsAvailable(supabase, accountId, handed)

  return [
    ...handed.map((h) => ({
      user_id: userId,
      account_id: accountId,
      denomination: h.denomination,
      quantity: h.quantity,
      direction: "OUT" as const,
    })),
    ...change.map((c) => ({
      user_id: userId,
      account_id: accountId,
      denomination: c.denomination,
      quantity: c.quantity,
      direction: "IN" as const,
    })),
  ]
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
  formData: FormData
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

  await assertDenominationsAvailable(supabase, sourceAccountId, out)

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

export async function createTransaction(formData: FormData) {
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
    .from("accounts")
    .select("id, account_type")
    .in("id", accountIds)
  const accountTypeById = new Map((accountRows ?? []).map((a) => [a.id, a.account_type]))

  const sourceType = accountTypeById.get(payload.account_id)
  const destType = payload.destination_account_id
    ? accountTypeById.get(payload.destination_account_id)
    : undefined

  // Physical-cash accounts need their denomination breakdown fully
  // validated *before* the transaction is written (see the validate*
  // helpers above) — never insert the transaction row first and hope.
  let denominationRows: DenominationRow[] = []
  if (payload.type === "EXPENSE" && sourceType && isPhysicalAccount(sourceType)) {
    denominationRows = await validatePhysicalExpense(
      supabase,
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

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({ ...payload, user_id: user.id })
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  if (payload.type === "SAVINGS") {
    await applySavingsSplit(supabase, user.id, inserted.id, payload.amount)
  }
  if (denominationRows.length > 0) {
    const { error: denomError } = await supabase
      .from("transaction_denominations")
      .insert(denominationRows.map((r) => ({ ...r, transaction_id: inserted.id })))
    if (denomError) throw new Error(denomError.message)
  }

  revalidatePath("/", "layout")
}

export async function updateTransaction(transactionId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const payload = parseTransactionForm(formData)

  const { error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", transactionId)
    .eq("user_id", user.id)
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
}

export async function deleteTransaction(transactionId: string) {
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
}
