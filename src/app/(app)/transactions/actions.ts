"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { sendOverdraftWarningEmail } from "@/actions/email-actions"
import {
  TRANSACTION_TYPES,
  EXPENSE_CLASSIFICATIONS,
  FUNDING_SOURCES,
  type TransactionType,
  type ExpenseClassification,
  type FundingSource,
} from "@/lib/transactions"
import { computeSavingsSplit } from "@/lib/savings"
import {
  isPhysicalAccount,
  assertSufficientBalance,
  toAccountBalance,
  findOtherPhysicalAccount,
} from "@/lib/accounts"
import { INTEREST_CATEGORY_NAME } from "@/lib/categories"
import { denominationsFor, denominationFieldName } from "@/lib/denominations"
import { toActionResult, type ActionResult } from "@/lib/action-result"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { z } from "zod"

/**
 * Supabase's generated RPC Args type reports every `save_transaction_with_denominations`
 * SQL parameter as required and non-null, but the Postgres function itself accepts NULL
 * for several of them (transaction_id defaults via gen_random_uuid(); destination/category/
 * savings-goal ids are legitimately absent depending on transaction type). Postgres function
 * introspection doesn't expose parameter nullability the way table columns do, so the
 * generator can't know this — widen locally instead of fighting the generator.
 */
type SaveTransactionArgs = {
  [K in keyof Database["public"]["Functions"]["save_transaction_with_denominations"]["Args"]]:
    Database["public"]["Functions"]["save_transaction_with_denominations"]["Args"][K] | null
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

const isUuid = (value: string) => z.uuid().safeParse(value).success

/**
 * Base shape is intentionally permissive on the conditional fields (empty
 * string allowed) — which of them are actually required depends on `type`,
 * enforced below in `.superRefine`. `expense_classification`/`funding_source`
 * use `z.union([enum, literal("")])` rather than a plain `z.string()` so the
 * parsed type stays a real literal union with no `as` cast needed when
 * building the final payload.
 */
const transactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES, "Invalid transaction type"),
    transaction_date: z.string().min(1, "Date is required"),
    amount: z.coerce.number("Invalid amount").positive("Invalid amount"),
    description: z.string(),
    account_id: z.uuid("Account is required"),
    destination_account_id: z.string(),
    category_id: z.string(),
    expense_classification: z.union([z.enum(EXPENSE_CLASSIFICATIONS), z.literal("")]),
    funding_source: z.union([z.enum(FUNDING_SOURCES), z.literal("")]),
    savings_goal_id: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "INCOME") {
      if (!isUuid(data.category_id)) ctx.addIssue("Category is required")
    } else if (data.type === "EXPENSE") {
      if (!isUuid(data.category_id)) ctx.addIssue("Category is required")
      if (data.expense_classification === "") ctx.addIssue("Expense classification is required")
      if (data.funding_source === "") {
        ctx.addIssue("Funding source is required")
      } else if (data.funding_source === "SAVED_MONEY" && !isUuid(data.savings_goal_id)) {
        ctx.addIssue("Savings goal is required when spending saved money")
      }
    } else if (data.type === "TRANSFER") {
      if (!isUuid(data.destination_account_id)) {
        ctx.addIssue("Destination account is required")
      } else if (data.destination_account_id === data.account_id) {
        ctx.addIssue("Destination account must differ from the source account")
      }
    }
    // SAVINGS needs no extra fields here — see applySavingsSplit.
  })

/**
 * One transaction form covers four very different shapes of row. This
 * parses+validates the raw FormData once via `transactionFormSchema` and
 * returns a full column patch (irrelevant fields explicitly nulled) so
 * switching a transaction's type on edit can't leave stale values from the
 * old type behind.
 *
 * `payload.savings_goal_id` is only for an EXPENSE drawing on a single goal
 * (SAVED_MONEY funding) — a single-goal draw needs no split. A SAVINGS
 * transaction's goal(s) live in `savings_allocations` instead, computed
 * separately by `applySavingsSplit` since it fans out across every active
 * goal by percentage.
 */
function parseTransactionForm(formData: FormData): TransactionPayload {
  const result = transactionFormSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    transaction_date: String(formData.get("transaction_date") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    description: String(formData.get("description") ?? "").trim(),
    account_id: String(formData.get("account_id") ?? ""),
    destination_account_id: String(formData.get("destination_account_id") ?? ""),
    category_id: String(formData.get("category_id") ?? ""),
    expense_classification: String(formData.get("expense_classification") ?? ""),
    funding_source: String(formData.get("funding_source") ?? ""),
    savings_goal_id: String(formData.get("savings_goal_id") ?? ""),
  })
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid transaction data")
  }
  const data = result.data

  return {
    type: data.type,
    transaction_date: data.transaction_date,
    amount: data.amount,
    description: data.description || null,
    account_id: data.account_id,
    destination_account_id: data.type === "TRANSFER" ? data.destination_account_id : null,
    category_id: data.type === "INCOME" || data.type === "EXPENSE" ? data.category_id : null,
    expense_classification:
      data.type === "EXPENSE" && data.expense_classification !== "" ? data.expense_classification : null,
    funding_source: data.type === "EXPENSE" && data.funding_source !== "" ? data.funding_source : null,
    savings_goal_id:
      data.type === "EXPENSE" && data.funding_source === "SAVED_MONEY" ? data.savings_goal_id : null,
  }
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
    throw new Error("No Unallocated Savings goal found. Visit the Savings page first")
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

/**
 * Interest is real new money — it must increase Total Money, which means it
 * has to be an INCOME row (account_balances.balance only sums INCOME/EXPENSE/
 * TRANSFER, see oldEffectOnAccount above). But it should never read as
 * spendable, so it's immediately reserved: a paired SAVINGS row + a
 * savings_allocations entry into Unallocated Savings. SAVINGS never affects
 * account_balances.balance, so Saved Money rises by the same amount and
 * Available to Spend nets out unchanged. Mirrors sweepMonth's existing
 * multi-insert pattern rather than introducing a new atomic RPC.
 */
async function recordInterestIncome(
  supabase: SupabaseClient<Database>,
  userId: string,
  payload: TransactionPayload
): Promise<void> {
  const { error: incomeError } = await supabase.from("transactions").insert({
    user_id: userId,
    type: "INCOME",
    transaction_date: payload.transaction_date,
    amount: payload.amount,
    description: payload.description,
    account_id: payload.account_id,
    category_id: payload.category_id,
  })
  if (incomeError) throw new Error(incomeError.message)

  const { data: unallocated } = await supabase
    .from("savings_goals")
    .select("id")
    .eq("user_id", userId)
    .eq("is_unallocated", true)
    .single()
  if (!unallocated) throw new Error("No Unallocated Savings goal found")

  const { data: savingsRow, error: savingsError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "SAVINGS",
      transaction_date: payload.transaction_date,
      amount: payload.amount,
      account_id: payload.account_id,
      description: payload.description ?? INTEREST_CATEGORY_NAME,
    })
    .select("id")
    .single()
  if (savingsError || !savingsRow) {
    throw new Error(savingsError?.message ?? "Failed to reserve interest into savings")
  }

  const { error: allocError } = await supabase.from("savings_allocations").insert({
    user_id: userId,
    transaction_id: savingsRow.id,
    savings_goal_id: unallocated.id,
    amount: payload.amount,
    allocation_type: "INTEREST",
  })
  if (allocError) throw new Error(allocError.message)
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
 * Validates a physical "Direct Payments & Change" breakdown and returns the
 * ledger rows to insert — used for both an EXPENSE (paying a merchant) and a
 * SAVINGS allocation drawn from physical cash (setting bills/coins aside for
 * a goal), since both are the same shape: cash leaves the account, optional
 * change comes back, and the Hard Floor applies identically either way. Runs
 * entirely *before* the parent transaction is written, so a Hard Floor
 * violation or an arithmetic mismatch blocks the whole entry instead of
 * leaving an orphaned transaction row with no denomination backing.
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
  const handedOther = otherAccount
    ? parseDenominationQuantities(formData, "handed_other", otherDenominations)
    : []
  const changeOther = otherAccount
    ? parseDenominationQuantities(formData, "change_other", otherDenominations)
    : []

  if (handed.length === 0 && handedOther.length === 0) {
    throw new Error("Denomination breakdown (handed over) is required for physical cash")
  }

  const handedTotal = Math.round((totalOf(handed) + totalOf(handedOther)) * 100) / 100
  const changeTotal = Math.round((totalOf(changeOwn) + totalOf(changeOther)) * 100) / 100

  if (handedTotal < amount) {
    throw new Error(
      `Handed over (₱${handedTotal}) is less than the amount (₱${amount}). Hand over enough to cover it`
    )
  }

  const expectedChange = Math.round((handedTotal - amount) * 100) / 100
  if (Math.round((expectedChange - changeTotal) * 100) / 100 !== 0) {
    throw new Error(
      `Handed over (₱${handedTotal}) minus the amount (₱${amount}) must equal change: expected ₱${expectedChange}, got ₱${changeTotal}`
    )
  }

  await assertDenominationsAvailable(supabase, accountId, handed, excludeTransactionId)
  if (handedOther.length > 0) {
    await assertDenominationsAvailable(supabase, otherAccount!.id, handedOther, excludeTransactionId)
  }

  return [
    ...handed.map((h) => ({
      user_id: userId,
      account_id: accountId,
      denomination: h.denomination,
      quantity: h.quantity,
      direction: "OUT" as const,
    })),
    ...handedOther.map((h) => ({
      user_id: userId,
      account_id: otherAccount!.id,
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
 *
 * Money received can span both physical accounts too (e.g. a ₱1000 bill
 * plus a ₱20 coin as one allowance) — `otherAccount`'s denominations post
 * to that account's ledger, not the receiving account's, mirroring
 * `validatePhysicalExpense`'s cross-account change.
 */
function validateIncomeDenomination(
  userId: string,
  accountId: string,
  accountType: string,
  amount: number,
  formData: FormData,
  otherAccount?: { id: string; type: string }
): DenominationRow[] {
  const denominations = denominationsFor(accountType as never)
  const received = parseDenominationQuantities(formData, "received", denominations)
  const otherDenominations = otherAccount ? denominationsFor(otherAccount.type as never) : []
  const receivedOther = otherAccount
    ? parseDenominationQuantities(formData, "received_other", otherDenominations)
    : []

  if (received.length === 0 && receivedOther.length === 0) {
    throw new Error("Denomination breakdown is required for physical cash income")
  }

  const receivedTotal = Math.round((totalOf(received) + totalOf(receivedOther)) * 100) / 100
  if (receivedTotal !== amount) {
    throw new Error(
      `Denomination breakdown (₱${receivedTotal}) must equal the income amount (₱${amount})`
    )
  }

  return [
    ...received.map((r) => ({
      user_id: userId,
      account_id: accountId,
      denomination: r.denomination,
      quantity: r.quantity,
      direction: "IN" as const,
    })),
    ...receivedOther.map((r) => ({
      user_id: userId,
      account_id: otherAccount!.id,
      denomination: r.denomination,
      quantity: r.quantity,
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
 * Validates a TRANSFER whose source is physical but the destination isn't
 * (e.g. depositing Paper Cash into a digital bank account) — the bills/coins
 * handed over must sum to exactly the transfer amount. No "change" concept
 * (unlike EXPENSE): the full amount leaves the source account.
 */
async function validatePhysicalTransferOut(
  supabase: SupabaseClient,
  userId: string,
  sourceAccountId: string,
  sourceAccountType: string,
  amount: number,
  formData: FormData,
  excludeTransactionId?: string
): Promise<DenominationRow[]> {
  const out = parseDenominationQuantities(formData, "out", denominationsFor(sourceAccountType as never))

  if (out.length === 0) {
    throw new Error("Denomination breakdown is required for a physical cash deposit")
  }

  const outTotal = totalOf(out)
  if (outTotal !== amount) {
    throw new Error(`Denomination breakdown (₱${outTotal}) must equal the transfer amount (₱${amount})`)
  }

  await assertDenominationsAvailable(supabase, sourceAccountId, out, excludeTransactionId)

  return out.map((o) => ({
    user_id: userId,
    account_id: sourceAccountId,
    denomination: o.denomination,
    quantity: o.quantity,
    direction: "OUT" as const,
  }))
}

/**
 * Validates a TRANSFER whose destination is physical but the source isn't
 * (e.g. withdrawing cash from a digital bank into Paper Cash) — the bills/
 * coins received must sum to exactly the transfer amount. No Hard Floor
 * check: an IN movement can never drain a denomination past zero.
 *
 * Money received can span both physical accounts too (e.g. mostly Paper
 * Cash bills plus a few Coin Pouch coins from the same withdrawal) —
 * `otherAccount`'s denominations post to that account's ledger, not the
 * destination's, mirroring `validateIncomeDenomination`'s cross-account
 * receipt.
 */
function validatePhysicalTransferIn(
  userId: string,
  destAccountId: string,
  destAccountType: string,
  amount: number,
  formData: FormData,
  otherAccount?: { id: string; type: string }
): DenominationRow[] {
  const inn = parseDenominationQuantities(formData, "in", denominationsFor(destAccountType as never))
  const otherDenominations = otherAccount ? denominationsFor(otherAccount.type as never) : []
  const inOther = otherAccount
    ? parseDenominationQuantities(formData, "in_other", otherDenominations)
    : []

  if (inn.length === 0 && inOther.length === 0) {
    throw new Error("Denomination breakdown is required for a physical cash withdrawal")
  }

  const inTotal = Math.round((totalOf(inn) + totalOf(inOther)) * 100) / 100
  if (inTotal !== amount) {
    throw new Error(`Denomination breakdown (₱${inTotal}) must equal the transfer amount (₱${amount})`)
  }

  return [
    ...inn.map((i) => ({
      user_id: userId,
      account_id: destAccountId,
      denomination: i.denomination,
      quantity: i.quantity,
      direction: "IN" as const,
    })),
    ...inOther.map((i) => ({
      user_id: userId,
      account_id: otherAccount!.id,
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

/**
 * The physical-split validators (`validatePhysicalExpense`,
 * `validateIncomeDenomination`, `validatePhysicalTransferIn`) let a
 * transaction's denomination breakdown span both physical accounts — e.g.
 * paying from Paper Cash and getting coin change back into the Coin Pouch.
 * Those denomination rows already post correctly to whichever account they
 * belong to, but the *parent* transaction only ever posts its ledger amount
 * against one `account_id` — the other account's share has no matching
 * ledger entry, which is exactly the bug this corrects.
 *
 * Fixes it with a second, real TRANSFER row moving the cross-account share
 * from the primary ledger account to the other one (or the reverse, if the
 * other account net-contributed rather than net-received) — never a bigger
 * amount on the primary row, since `account_balances` can only credit one
 * `account_id` per row. Carries no denomination rows of its own (the
 * existing rows already cover the physical side); it exists purely to
 * correct the ledger math. Linked back to its parent via
 * `related_transaction_id` so an edit can find and update/remove it instead
 * of accumulating duplicates.
 */
async function syncCrossAccountTransfer(
  supabase: SupabaseClient<Database>,
  userId: string,
  parentTransactionId: string,
  transactionDate: string,
  sourceAccountId: string,
  denominationRows: DenominationRow[]
): Promise<void> {
  const otherRows = denominationRows.filter((r) => r.account_id !== sourceAccountId)
  const otherAccountId = otherRows[0]?.account_id

  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("related_transaction_id", parentTransactionId)
    .eq("type", "TRANSFER")
    .eq("user_id", userId)
    .maybeSingle()

  const otherNet = otherAccountId
    ? Math.round(
        otherRows.reduce((sum, r) => sum + (r.direction === "IN" ? 1 : -1) * r.denomination * r.quantity, 0) * 100
      ) / 100
    : 0

  if (!otherAccountId || otherNet === 0) {
    if (existing) await supabase.from("transactions").delete().eq("id", existing.id).eq("user_id", userId)
    return
  }

  const [account_id, destination_account_id, amount] =
    otherNet > 0 ? [sourceAccountId, otherAccountId, otherNet] : [otherAccountId, sourceAccountId, -otherNet]

  const rpcArgs = {
    p_transaction_id: existing?.id ?? null,
    p_type: "TRANSFER",
    p_transaction_date: transactionDate,
    p_amount: amount,
    p_description: "Cross-account change (auto)",
    p_account_id: account_id,
    p_destination_account_id: destination_account_id,
    p_category_id: null,
    p_expense_classification: null,
    p_funding_source: null,
    p_savings_goal_id: null,
    p_denomination_rows: [],
  } satisfies SaveTransactionArgs
  const { data: transferId, error } = await supabase.rpc(
    "save_transaction_with_denominations",
    rpcArgs as unknown as Database["public"]["Functions"]["save_transaction_with_denominations"]["Args"]
  )
  if (error) throw new Error(error.message)

  if (!existing) {
    const { error: linkError } = await supabase
      .from("transactions")
      .update({ related_transaction_id: parentTransactionId })
      .eq("id", transferId)
      .eq("user_id", userId)
    if (linkError) throw new Error(linkError.message)
  }
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const payload = parseTransactionForm(formData)

  if (payload.type === "INCOME" && payload.category_id) {
    const { data: category } = await supabase
      .from("categories")
      .select("name")
      .eq("id", payload.category_id)
      .eq("user_id", user.id)
      .single()

    if (category?.name === INTEREST_CATEGORY_NAME) {
      await recordInterestIncome(supabase, user.id, payload)
      revalidatePath("/", "layout")
      return "Interest saved to Unallocated Savings"
    }
  }

  const accountIds = [payload.account_id, payload.destination_account_id].filter(
    (id): id is string => Boolean(id)
  )
  const { data: accountRows } = await supabase
    .from("account_balances")
    .select("*")
    .in("account_id", accountIds)
  const accountById = new Map((accountRows ?? []).map(toAccountBalance).map((a) => [a.account_id, a]))

  const sourceType = accountById.get(payload.account_id)?.account_type
  const destType = payload.destination_account_id
    ? accountById.get(payload.destination_account_id)?.account_type
    : undefined

  // Physical-cash accounts need their denomination breakdown fully
  // validated *before* the transaction is written (see the validate*
  // helpers above) — never insert the transaction row first and hope.
  let denominationRows: DenominationRow[] = []
  let crossAccountSourceId: string | null = null
  if (
    (payload.type === "EXPENSE" || payload.type === "SAVINGS") &&
    sourceType &&
    isPhysicalAccount(sourceType)
  ) {
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
    crossAccountSourceId = payload.account_id
  } else if (payload.type === "INCOME" && sourceType && isPhysicalAccount(sourceType)) {
    const otherAccount = await findOtherPhysicalAccount(supabase, user.id, sourceType)
    denominationRows = validateIncomeDenomination(
      user.id,
      payload.account_id,
      sourceType,
      payload.amount,
      formData,
      otherAccount
    )
    crossAccountSourceId = payload.account_id
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
  } else if (
    payload.type === "TRANSFER" &&
    sourceType &&
    isPhysicalAccount(sourceType) &&
    !(destType && isPhysicalAccount(destType))
  ) {
    denominationRows = await validatePhysicalTransferOut(
      supabase,
      user.id,
      payload.account_id,
      sourceType,
      payload.amount,
      formData
    )
  } else if (
    payload.type === "TRANSFER" &&
    destType &&
    isPhysicalAccount(destType) &&
    !(sourceType && isPhysicalAccount(sourceType))
  ) {
    const otherAccount = await findOtherPhysicalAccount(supabase, user.id, destType)
    denominationRows = validatePhysicalTransferIn(
      user.id,
      payload.destination_account_id!,
      destType,
      payload.amount,
      formData,
      otherAccount
    )
    crossAccountSourceId = payload.destination_account_id!
  }

  // The Hard Floor: an EXPENSE or SAVINGS can never exceed the selected
  // account's actual balance, for any account type — see account_balances.
  // Runs after the physical check so a Coin Pouch expense with insufficient
  // denominations gets the more specific error first.
  if (payload.type === "EXPENSE" || payload.type === "SAVINGS") {
    const acc = accountById.get(payload.account_id)
    if (acc) {
      try {
        assertSufficientBalance(acc.balance, payload.amount, acc.name)
      } catch (err) {
        const shortfall = payload.amount - acc.balance
        let category = payload.type === "SAVINGS" ? "Savings" : "Uncategorized"
        if (payload.type === "EXPENSE" && payload.category_id) {
          const { data: categoryRow } = await supabase
            .from("categories")
            .select("name")
            .eq("id", payload.category_id)
            .eq("user_id", user.id)
            .single()
          category = categoryRow?.name ?? category
        }
        after(() => sendOverdraftWarningEmail({ attemptedExpense: payload.amount, category, shortfall }))
        throw err
      }
    }
  }

  // Both inserts happen inside one Postgres function call so they're
  // atomic — a denomination-floor trigger failure rolls back the whole
  // transaction row too, instead of leaving it orphaned with no ledger
  // backing it (see save_transaction_with_denominations migration).
  const rpcArgs = {
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
  } satisfies SaveTransactionArgs
  const { data: transactionId, error } = await supabase.rpc(
    "save_transaction_with_denominations",
    rpcArgs as unknown as Database["public"]["Functions"]["save_transaction_with_denominations"]["Args"]
  )
  if (error) throw new Error(error.message)

  if (crossAccountSourceId) {
    await syncCrossAccountTransfer(
      supabase,
      user.id,
      transactionId,
      payload.transaction_date,
      crossAccountSourceId,
      denominationRows
    )
  }

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
      .select("*")
      .in("account_id", accountIds)
    const accountById = new Map((accountRows ?? []).map(toAccountBalance).map((a) => [a.account_id, a]))

    const sourceType = accountById.get(payload.account_id)?.account_type
    const destType = payload.destination_account_id
      ? accountById.get(payload.destination_account_id)?.account_type
      : undefined

    // Same validate-before-write flow as createTransaction, with the
    // transaction's own current rows excluded from the inventory check
    // since they're about to be replaced (see assertDenominationsAvailable).
    let denominationRows: DenominationRow[] = []
    let crossAccountSourceId: string | null = null
    if (
      (payload.type === "EXPENSE" || payload.type === "SAVINGS") &&
      sourceType &&
      isPhysicalAccount(sourceType)
    ) {
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
      crossAccountSourceId = payload.account_id
    } else if (payload.type === "INCOME" && sourceType && isPhysicalAccount(sourceType)) {
      const otherAccount = await findOtherPhysicalAccount(supabase, user.id, sourceType)
      denominationRows = validateIncomeDenomination(
        user.id,
        payload.account_id,
        sourceType,
        payload.amount,
        formData,
        otherAccount
      )
      crossAccountSourceId = payload.account_id
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
    } else if (
      payload.type === "TRANSFER" &&
      sourceType &&
      isPhysicalAccount(sourceType) &&
      !(destType && isPhysicalAccount(destType))
    ) {
      denominationRows = await validatePhysicalTransferOut(
        supabase,
        user.id,
        payload.account_id,
        sourceType,
        payload.amount,
        formData,
        transactionId
      )
    } else if (
      payload.type === "TRANSFER" &&
      destType &&
      isPhysicalAccount(destType) &&
      !(sourceType && isPhysicalAccount(sourceType))
    ) {
      const otherAccount = await findOtherPhysicalAccount(supabase, user.id, destType)
      denominationRows = validatePhysicalTransferIn(
        user.id,
        payload.destination_account_id!,
        destType,
        payload.amount,
        formData,
        otherAccount
      )
      crossAccountSourceId = payload.destination_account_id!
    }

    if (payload.type === "EXPENSE" || payload.type === "SAVINGS") {
      const acc = accountById.get(payload.account_id)
      if (acc) {
        const baseline = acc.balance - oldEffectOnAccount(oldRow, payload.account_id)
        try {
          assertSufficientBalance(baseline, payload.amount, acc.name)
        } catch (err) {
          const shortfall = payload.amount - baseline
          let category = payload.type === "SAVINGS" ? "Savings" : "Uncategorized"
          if (payload.type === "EXPENSE" && payload.category_id) {
            const { data: categoryRow } = await supabase
              .from("categories")
              .select("name")
              .eq("id", payload.category_id)
              .eq("user_id", user.id)
              .single()
            category = categoryRow?.name ?? category
          }
          after(() => sendOverdraftWarningEmail({ attemptedExpense: payload.amount, category, shortfall }))
          throw err
        }
      }
    }

    // Update + denomination replace happen atomically — see
    // save_transaction_with_denominations migration.
    const rpcArgs = {
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
    } satisfies SaveTransactionArgs
    const { error } = await supabase.rpc(
      "save_transaction_with_denominations",
      rpcArgs as unknown as Database["public"]["Functions"]["save_transaction_with_denominations"]["Args"]
    )
    if (error) throw new Error(error.message)

    if (crossAccountSourceId) {
      await syncCrossAccountTransfer(
        supabase,
        user.id,
        transactionId,
        payload.transaction_date,
        crossAccountSourceId,
        denominationRows
      )
    } else {
      // The edit may have removed this transaction's cross-account nature
      // (e.g. switched to a digital account, or to a breaking-bills TRANSFER,
      // which is already fully self-contained via its own account_id/
      // destination_account_id) — clean up any stale linked TRANSFER from
      // before the edit so it doesn't keep double-counting.
      const { error: staleLinkError } = await supabase
        .from("transactions")
        .delete()
        .eq("related_transaction_id", transactionId)
        .eq("user_id", user.id)
      if (staleLinkError) throw new Error(staleLinkError.message)
    }

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

    // Delete a linked auto-generated cross-account TRANSFER first — the
    // related_transaction_id FK is NO ACTION, so deleting the parent while
    // this still points to it would otherwise fail with a raw FK violation.
    const { error: linkedError } = await supabase
      .from("transactions")
      .delete()
      .eq("related_transaction_id", transactionId)
      .eq("user_id", user.id)
    if (linkedError) throw new Error(linkedError.message)

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
