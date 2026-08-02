import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { formatPHP } from "@/lib/format"
import type { TransactionDetail } from "@/lib/transactions"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NetCashFlowChart } from "./net-cash-flow-chart"

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

  const transactions = (data ?? []) as TransactionDetail[]

  const monthly: MonthlyRow[] = Array.from({ length: 12 }, () => ({
    income: 0,
    expense: 0,
    savings: 0,
  }))
  const categoryTotals = new Map<string, number>()

  for (const t of transactions) {
    const monthIndex = Number(t.transaction_date.slice(5, 7)) - 1
    if (t.type === "INCOME") monthly[monthIndex].income += t.amount
    if (t.type === "EXPENSE") {
      monthly[monthIndex].expense += t.amount
      const key = t.category_name ?? "Uncategorized"
      categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + t.amount)
    }
    if (t.type === "SAVINGS") monthly[monthIndex].savings += t.amount
  }

  const annualIncome = monthly.reduce((sum, m) => sum + m.income, 0)
  const annualExpense = monthly.reduce((sum, m) => sum + m.expense, 0)
  const annualSavings = monthly.reduce((sum, m) => sum + m.savings, 0)
  const annualNet = annualIncome - annualExpense

  const categoryBreakdown = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
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
                return (
                  <tr key={MONTH_NAMES[i]} className="border-b border-border last:border-0">
                    <td className="px-(--card-spacing) py-2 text-foreground">{MONTH_NAMES[i]}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                      {formatPHP(m.income)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">
                      {formatPHP(m.expense)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {formatPHP(m.savings)}
                    </td>
                    <td
                      className={`px-(--card-spacing) py-2 text-right tabular-nums font-medium ${
                        net > 0
                          ? "text-emerald-600 dark:text-emerald-500"
                          : net < 0
                            ? "text-destructive"
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

      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {categoryBreakdown.length === 0 ? (
            <p className="px-(--card-spacing) py-6 text-sm text-muted-foreground">
              No expenses recorded for {year}.
            </p>
          ) : (
            categoryBreakdown.map(([name, total]) => (
              <div key={name} className="flex items-center justify-between px-(--card-spacing) py-3">
                <span className="text-sm text-foreground">{name}</span>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {formatPHP(total)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
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
      ? "text-emerald-600 dark:text-emerald-500"
      : value < 0
        ? "text-destructive"
        : "text-foreground"
    : value < 0
      ? "text-destructive"
      : "text-foreground"

  return (
    <Card>
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold tabular-nums ${valueColor}`}>{formatPHP(value)}</p>
      </CardContent>
    </Card>
  )
}
