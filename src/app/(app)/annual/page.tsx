import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatPHP } from "@/lib/format"
import { toTransactionDetail, excludeSavedExpenses } from "@/lib/transactions"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NetCashFlowChart } from "./net-cash-flow-chart-loader"
import {
  CumulativeAreaChart,
  BudgetSplitBarChart,
  TopCategoriesBarChart,
} from "@/components/annual-advanced-charts-loader"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

type MonthlyRow = { income: number; expense: number; savings: number }

export default async function AnnualPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ year?: string }> }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const year = Number((await searchParams).year) || new Date().getFullYear()

  const { data } = await supabase
    .from("transaction_details")
    .select("*")
    .gte("transaction_date", `${year}-01-01`)
    .lt("transaction_date", `${year + 1}-01-01`)

  const transactions = (data ?? []).map(toTransactionDetail)

  const monthly: MonthlyRow[] = Array.from({ length: 12 }, () => ({
    income: 0,
    expense: 0,
    savings: 0,
  }))

  for (const t of transactions) {
    const monthIndex = Number(t.transaction_date.slice(5, 7)) - 1
    if (t.type === "INCOME") monthly[monthIndex].income += t.amount
    if (t.type === "EXPENSE") monthly[monthIndex].expense += t.amount
    if (t.type === "SAVINGS") monthly[monthIndex].savings += t.amount
  }

  const annualIncome = monthly.reduce((sum, m) => sum + m.income, 0)
  const annualExpense = monthly.reduce((sum, m) => sum + m.expense, 0)
  const annualSavings = monthly.reduce((sum, m) => sum + m.savings, 0)
  const annualNet = annualIncome - annualExpense

  // Pure budget metrics for the advanced charts: a SAVED_MONEY expense is a
  // withdrawal from an already-funded goal, not new spending — see
  // excludeSavedExpenses' doc comment.
  const budgetTransactions = excludeSavedExpenses(transactions)

  const trendData = Array.from({ length: 12 }, (_, i) => ({
    month: MONTH_NAMES[i],
    needs: 0,
    wants: 0,
    savings: 0,
  }))
  const topCategoryTotals = new Map<string, number>()

  for (const t of budgetTransactions) {
    const monthIndex = Number(t.transaction_date.slice(5, 7)) - 1
    if (t.type === "EXPENSE" && t.expense_classification === "NEED") trendData[monthIndex].needs += t.amount
    if (t.type === "EXPENSE" && t.expense_classification === "WANT") trendData[monthIndex].wants += t.amount
    if (t.type === "SAVINGS") trendData[monthIndex].savings += t.amount
    if (t.type === "EXPENSE") {
      const key = t.category_name ?? "Uncategorized"
      topCategoryTotals.set(key, (topCategoryTotals.get(key) ?? 0) + t.amount)
    }
  }

  let runningSavings = 0
  let runningExpenses = 0
  const cumulativeData = trendData.map((m) => {
    runningSavings = Math.round((runningSavings + m.savings) * 100) / 100
    runningExpenses = Math.round((runningExpenses + m.needs + m.wants) * 100) / 100
    return { month: m.month, cumulativeSavings: runningSavings, cumulativeExpenses: runningExpenses }
  })

  const topCategoriesData = [...topCategoryTotals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const now = new Date()
  const isCurrentYear = year === now.getFullYear()
  const currentMonthIndex = now.getMonth()

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Annual Summary</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/annual?year=${year - 1}`} />}
          >
            ‹
          </Button>
          <span className="text-sm font-medium text-foreground w-16 text-center">{year}</span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/annual?year=${year + 1}`} />}
          >
            ›
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Annual Income" value={annualIncome} />
        <StatCard label="Annual Expenses" value={annualExpense} />
        <StatCard label="Annual Savings" value={annualSavings} />
        <StatCard label="Net Cash Flow" value={annualNet} dynamic />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Net Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <NetCashFlowChart
            data={monthly.map((m, i) => ({
              month: MONTH_NAMES[i],
              net: Math.round((m.income - m.expense) * 100) / 100,
            }))}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CumulativeAreaChart data={cumulativeData} />
        <BudgetSplitBarChart data={trendData} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-(--card-spacing) py-2">Month</th>
                  <th className="text-right font-medium px-3 py-2">Income</th>
                  <th className="text-right font-medium px-3 py-2">Expenses</th>
                  <th className="text-right font-medium px-3 py-2">Savings</th>
                  <th className="text-right font-medium px-(--card-spacing) py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => {
                  const net = m.income - m.expense
                  const isCurrentMonth = isCurrentYear && i === currentMonthIndex
                  return (
                    <tr
                      key={MONTH_NAMES[i]}
                      className={`border-b border-border last:border-0 ${isCurrentMonth ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-(--card-spacing) py-2 text-foreground">{MONTH_NAMES[i]}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-500">
                        {formatPHP(m.income)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-500">
                        {formatPHP(m.expense)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {formatPHP(m.savings)}
                      </td>
                      <td
                        className={`px-(--card-spacing) py-2 text-right tabular-nums font-medium ${
                          net > 0
                            ? "text-emerald-500"
                            : net < 0
                              ? "text-red-500"
                              : "text-foreground"
                        }`}
                      >
                        {formatPHP(net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <TopCategoriesBarChart data={topCategoriesData} />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  dynamic,
}: Readonly<{ label: string; value: number; dynamic?: boolean }>) {
  const valueColor = dynamic
    ? value > 0
      ? "text-emerald-500"
      : value < 0
        ? "text-red-500"
        : "text-foreground"
    : value < 0
      ? "text-red-500"
      : "text-foreground"

  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${valueColor}`}>{formatPHP(value)}</CardTitle>
      </CardHeader>
    </Card>
  )
}
