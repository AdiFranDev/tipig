import type { Database } from "@/types/supabase"

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "SAVINGS", "TRANSFER"] as const satisfies readonly Database["public"]["Enums"]["transaction_type"][]
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const EXPENSE_CLASSIFICATIONS = ["NEED", "WANT"] as const satisfies readonly Database["public"]["Enums"]["expense_classification"][]
export type ExpenseClassification = (typeof EXPENSE_CLASSIFICATIONS)[number]

export const FUNDING_SOURCES = ["AVAILABLE_MONEY", "SAVED_MONEY"] as const satisfies readonly Database["public"]["Enums"]["funding_source"][]
export type FundingSource = (typeof FUNDING_SOURCES)[number]

export type TransactionDetail = {
  id: string
  transaction_date: string
  type: TransactionType
  amount: number
  description: string | null
  account_id: string | null
  account_name: string | null
  destination_account_id: string | null
  destination_account_name: string | null
  category_id: string | null
  category_name: string | null
  expense_classification: ExpenseClassification | null
  funding_source: FundingSource | null
  savings_goal_id: string | null
  savings_goal_name: string | null
}

/**
 * `transaction_details` is a view; see the comment on `toAccountBalance` in
 * accounts.ts for why generated types mark every column nullable here even
 * though the core transaction fields are always populated.
 */
export function toTransactionDetail(
  row: Pick<
    Database["public"]["Views"]["transaction_details"]["Row"],
    | "id"
    | "transaction_date"
    | "type"
    | "amount"
    | "description"
    | "account_id"
    | "account_name"
    | "destination_account_id"
    | "destination_account_name"
    | "category_id"
    | "category_name"
    | "expense_classification"
    | "funding_source"
    | "savings_goal_id"
    | "savings_goal_name"
  >
): TransactionDetail {
  return {
    id: row.id!,
    transaction_date: row.transaction_date!,
    type: row.type!,
    amount: row.amount!,
    description: row.description,
    account_id: row.account_id,
    account_name: row.account_name,
    destination_account_id: row.destination_account_id,
    destination_account_name: row.destination_account_name,
    category_id: row.category_id,
    category_name: row.category_name,
    expense_classification: row.expense_classification,
    funding_source: row.funding_source,
    savings_goal_id: row.savings_goal_id,
    savings_goal_name: row.savings_goal_name,
  }
}

/** "YYYY-MM" for the given date, defaulting to today. */
export function currentMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** [start, end) as YYYY-MM-DD, `end` being the first day of the following month. */
export function monthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number)
  const start = `${year}-${String(mon).padStart(2, "0")}-01`
  const endDate = new Date(year, mon, 1)
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`
  return { start, end }
}

/** [start, end) as YYYY-MM-DD, covering the 7 days up to and including today. */
export function last7Days(date = new Date()): { start: string; end: string } {
  const toDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const end = new Date(date)
  end.setDate(end.getDate() + 1)
  const start = new Date(date)
  start.setDate(start.getDate() - 6)
  return { start: toDateString(start), end: toDateString(end) }
}

/** [start, end) as YYYY-MM-DD, covering just today. */
export function todayRange(date = new Date()): { start: string; end: string } {
  const toDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const end = new Date(date)
  end.setDate(end.getDate() + 1)
  return { start: toDateString(date), end: toDateString(end) }
}

/** "YYYY-MM-DD" for the last calendar day of the given "YYYY-MM" month. */
export function lastDayOfMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number)
  const d = new Date(year, mon, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function aggregateByType(transactions: { type: TransactionType; amount: number }[]) {
  let income = 0
  let expense = 0
  let savings = 0
  for (const t of transactions) {
    if (t.type === "INCOME") income += t.amount
    else if (t.type === "EXPENSE") expense += t.amount
    else if (t.type === "SAVINGS") savings += t.amount
  }
  // Transfers and savings allocations never touch net cash flow — they
  // move money between accounts/goals, they don't create or consume it.
  return { income, expense, savings, netCashFlow: income - expense }
}

/**
 * An EXPENSE paid from Saved Money is a withdrawal from a goal that was
 * already funded in a prior period — including it in this month's budget
 * metrics (Total Expenses, Needs/Wants, Net Cash Flow) would double-count
 * money already accounted for as savings. Callers computing monthly budget
 * aggregates should filter through this before summing.
 */
export function excludeSavedExpenses<T extends { type: TransactionType; funding_source?: FundingSource | null }>(
  transactions: T[]
): T[] {
  return transactions.filter((t) => !(t.type === "EXPENSE" && t.funding_source === "SAVED_MONEY"))
}
