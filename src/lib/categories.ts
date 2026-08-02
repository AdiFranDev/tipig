export type CategoryType = "INCOME" | "EXPENSE"
export type ExpenseClassification = "NEED" | "WANT"

export const DEFAULT_CATEGORIES: {
  name: string
  category_type: CategoryType
  default_expense_classification: ExpenseClassification | null
}[] = [
  { name: "Allowance/Scholarship", category_type: "INCOME", default_expense_classification: null },
  { name: "Salary", category_type: "INCOME", default_expense_classification: null },
  { name: "Interest", category_type: "INCOME", default_expense_classification: null },
  { name: "Gift", category_type: "INCOME", default_expense_classification: null },
  { name: "Other Income", category_type: "INCOME", default_expense_classification: null },
  { name: "Food", category_type: "EXPENSE", default_expense_classification: "NEED" },
  { name: "Transport", category_type: "EXPENSE", default_expense_classification: "NEED" },
  { name: "School", category_type: "EXPENSE", default_expense_classification: "NEED" },
  { name: "Bills", category_type: "EXPENSE", default_expense_classification: "NEED" },
  { name: "Health", category_type: "EXPENSE", default_expense_classification: "NEED" },
  { name: "Shopping", category_type: "EXPENSE", default_expense_classification: "WANT" },
  { name: "Entertainment", category_type: "EXPENSE", default_expense_classification: "WANT" },
  { name: "Other", category_type: "EXPENSE", default_expense_classification: "WANT" },
]

export async function ensureDefaultCategories(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string
) {
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })

  if (count === 0) {
    await supabase
      .from("categories")
      .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId })))
  }
}

export const PHYSICAL_ADJUSTMENT_LOSS_CATEGORY = "Physical Adjustment/Loss"
export const PHYSICAL_ADJUSTMENT_GAIN_CATEGORY = "Physical Adjustment/Gain"

export type Category = {
  id: string
  name: string
  category_type: CategoryType
  default_expense_classification: ExpenseClassification | null
  is_active: boolean
}
