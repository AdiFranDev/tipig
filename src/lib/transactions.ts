export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "SAVINGS", "TRANSFER"] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const EXPENSE_CLASSIFICATIONS = ["NEED", "WANT"] as const
export type ExpenseClassification = (typeof EXPENSE_CLASSIFICATIONS)[number]

export const FUNDING_SOURCES = ["AVAILABLE_MONEY", "SAVED_MONEY"] as const
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
