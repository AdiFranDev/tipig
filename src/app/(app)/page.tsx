import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultAccounts, toAccountBalance } from "@/lib/accounts"
import { ensureDefaultCategories } from "@/lib/categories"
import { ensureDefaultSavingsGoals, toSavingsGoalBalance } from "@/lib/savings"
import { currentMonth, monthRange, aggregateByType, excludeSavedExpenses } from "@/lib/transactions"
import { formatPHP } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { DashboardQuickActions } from "@/components/dashboard-quick-actions"

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export default async function DashboardOverview({
  searchParams,
}: Readonly<{ searchParams: Promise<{ month?: string }> }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const month = (await searchParams).month ?? currentMonth()
  const { start, end } = monthRange(month)

  await Promise.all([
    ensureDefaultAccounts(supabase, user.id),
    ensureDefaultCategories(supabase, user.id),
    ensureDefaultSavingsGoals(supabase, user.id),
  ])

  const [
    { data: accountsData },
    { data: categoriesData },
    { data: goalsData },
    { data: accountBalancesData },
    { data: goalBalancesData },
    { data: monthTxData },
  ] = await Promise.all([
    supabase.from("accounts").select("id, name, account_type").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").eq("is_active", true).order("name"),
    supabase.from("savings_goals").select("id, name").eq("is_active", true).order("name"),
    supabase.from("account_balances").select("*").eq("is_active", true).order("name"),
    supabase.from("savings_goal_balances").select("*").eq("is_active", true),
    supabase
      .from("transactions")
      .select("type, amount, expense_classification, funding_source")
      .gte("transaction_date", start)
      .lt("transaction_date", end),
  ])

  const accounts = accountsData ?? []
  const categories = categoriesData ?? []
  const goals = goalsData ?? []
  const accountBalances = (accountBalancesData ?? []).map(toAccountBalance)
  const goalBalances = (goalBalancesData ?? []).map(toSavingsGoalBalance)

  const totalMoney = accountBalances.reduce((sum, a) => sum + a.balance, 0)
  const savedMoney = goalBalances.reduce((sum, g) => sum + g.saved_amount, 0)
  const availableToSpend = totalMoney - savedMoney

  const { income, expense, savings, netCashFlow } = aggregateByType(excludeSavedExpenses(monthTxData ?? []))
  const monthlyRemaining = Math.round((income - expense - savings) * 100) / 100
  const defaultSweepAccountId = accountBalances.length
    ? accountBalances.reduce((max, a) => (a.balance > max.balance ? a : max)).account_id
    : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-14">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-foreground">Hi Adrian!</h1>
        <p className="text-sm text-muted-foreground">{monthLabel(month)}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Available to Spend
          </span>
          <span className="text-5xl font-light tabular-nums text-emerald-500">
            {formatPHP(availableToSpend)}
          </span>
          <span className="text-sm text-muted-foreground">Total minus saved</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Total Saved
          </span>
          <span className="text-5xl font-light tabular-nums text-foreground">
            {formatPHP(savedMoney)}
          </span>
          <span className="text-sm text-muted-foreground">
            Across {goals.length} savings goal{goals.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {availableToSpend < 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-red-500">Available to Spend is negative</p>
            <p className="text-xs text-muted-foreground">
              Your savings goals ({formatPHP(savedMoney)}) currently exceed your actual account
              balances ({formatPHP(totalMoney)}). This usually means an expense was paid from an
              account but not marked &quot;Paid From: Saved Money,&quot; or a goal is committed
              beyond what&apos;s actually saved. Review recent expenses or adjust your goals to
              correct it.
            </p>
          </div>
        </div>
      )}

      <DashboardQuickActions
        accounts={accounts}
        categories={categories}
        savingsGoals={goals}
        availableToSpend={availableToSpend}
        month={month}
        monthlyRemaining={monthlyRemaining}
        defaultSweepAccountId={defaultSweepAccountId}
      />

      <div className="flex w-full items-center justify-between rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-6">
          <SummaryStat label="Income" value={income} color="text-emerald-500" />
          <SummaryStat label="Expenses" value={expense} color="text-red-500" />
          <SummaryStat label="Net Cash Flow" value={netCashFlow} color="text-foreground" />
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/analytics" />}>
          Open Analytics
        </Button>
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  color,
}: Readonly<{ label: string; value: number; color: string }>) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{formatPHP(value)}</p>
    </div>
  )
}
