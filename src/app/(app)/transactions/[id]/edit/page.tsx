import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Category } from "@/lib/categories"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionForm, type TransactionFormDefaults } from "../../transaction-form"
import { updateTransaction } from "../../actions"

export default async function EditTransactionPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: tx } = await supabase.from("transactions").select("*").eq("id", id).single()
  if (!tx) notFound()

  const [{ data: accountsData }, { data: categoriesData }, { data: goalsData }] = await Promise.all([
    supabase.from("accounts").select("id, name, account_type").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").eq("is_active", true).order("name"),
    supabase.from("savings_goals").select("id, name").eq("is_active", true).order("name"),
  ])

  const defaults: TransactionFormDefaults = {
    type: tx.type,
    transaction_date: tx.transaction_date,
    amount: tx.amount,
    account_id: tx.account_id ?? undefined,
    destination_account_id: tx.destination_account_id ?? undefined,
    category_id: tx.category_id ?? undefined,
    expense_classification: tx.expense_classification ?? undefined,
    funding_source: tx.funding_source ?? undefined,
    savings_goal_id: tx.savings_goal_id ?? undefined,
    description: tx.description ?? undefined,
  }

  const updateWithId = updateTransaction.bind(null, tx.id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Edit Transaction</h1>
      <Card>
        <CardContent>
          <TransactionForm
            accounts={accountsData ?? []}
            categories={(categoriesData ?? []) as Category[]}
            savingsGoals={goalsData ?? []}
            action={updateWithId}
            defaults={defaults}
            submitLabel="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  )
}
