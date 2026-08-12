import type { LucideIcon } from "lucide-react"
import {
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Scale,
  LineChart,
  BarChart3,
  Wallet,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultSettings } from "@/lib/settings"
import { isPhysicalAccount, toAccountBalance } from "@/lib/accounts"
import { currentMonth, monthRange, aggregateByType, excludeSavedExpenses, toTransactionDetail } from "@/lib/transactions"
import { denominationsFor, toDenominationBalance } from "@/lib/denominations"
import { formatPHP } from "@/lib/format"
import { BudgetSplitCard } from "@/components/budget-split-card"
import { RecentLedger } from "@/components/recent-ledger"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MonthlyBarChart } from "../monthly-bar-chart-loader"
import { DenominationBarChart } from "../denomination-bar-chart-loader"
import { NetCashFlowChart } from "../annual/net-cash-flow-chart-loader"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

const RECENT_LIMIT = 8

export default async function AnalyticsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ month?: string }> }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const month = (await searchParams).month ?? currentMonth()
  const { start, end } = monthRange(month)
  const year = Number(month.slice(0, 4))

  const [
    settings,
    { data: accountBalancesData },
    { data: denomBalancesData },
    { data: monthTxData },
    { data: recentTxData },
    { data: yearTxData },
  ] = await Promise.all([
    ensureDefaultSettings(supabase, user.id),
    supabase.from("account_balances").select("*").eq("is_active", true).order("name"),
    supabase.from("denomination_balances").select("account_id, denomination, on_hand"),
    supabase
      .from("transactions")
      .select("type, amount, expense_classification, funding_source")
      .gte("transaction_date", start)
      .lt("transaction_date", end),
    supabase
      .from("transaction_details")
      .select("*")
      .gte("transaction_date", start)
      .lt("transaction_date", end)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("transactions")
      .select("type, amount, transaction_date, funding_source")
      .gte("transaction_date", `${year}-01-01`)
      .lt("transaction_date", `${year + 1}-01-01`),
  ])

  const accounts = (accountBalancesData ?? []).map(toAccountBalance)
  const physical = accounts.filter((a) => isPhysicalAccount(a.account_type))
  const recentTransactions = (recentTxData ?? []).map(toTransactionDetail)

  const onHandByAccount = new Map<string, Map<number, number>>()
  for (const row of (denomBalancesData ?? []).map(toDenominationBalance)) {
    if (!onHandByAccount.has(row.account_id)) onHandByAccount.set(row.account_id, new Map())
    onHandByAccount.get(row.account_id)!.set(row.denomination, row.on_hand)
  }

  function totalOnHand(accountId: string): number {
    const onHand = onHandByAccount.get(accountId) ?? new Map<number, number>()
    return [...onHand.entries()].reduce((sum, [denom, qty]) => sum + denom * qty, 0)
  }
  const paperCashTotal = totalOnHand(physical.find((a) => a.account_type === "PAPER_CASH")?.account_id ?? "")
  const coinPouchTotal = totalOnHand(physical.find((a) => a.account_type === "COIN_POUCH")?.account_id ?? "")

  const monthTxForBudget = excludeSavedExpenses(monthTxData ?? [])
  const { income, expense, savings, netCashFlow } = aggregateByType(monthTxForBudget)
  const needs = monthTxForBudget
    .filter((t) => t.type === "EXPENSE" && t.expense_classification === "NEED")
    .reduce((sum, t) => sum + t.amount, 0)
  const wants = monthTxForBudget
    .filter((t) => t.type === "EXPENSE" && t.expense_classification === "WANT")
    .reduce((sum, t) => sum + t.amount, 0)
  const savingsPercent = income > 0 ? Math.round((savings / income) * 100) : 0

  const monthlyIncome = Array<number>(12).fill(0)
  const monthlyExpense = Array<number>(12).fill(0)
  for (const t of excludeSavedExpenses(yearTxData ?? [])) {
    const idx = Number(t.transaction_date.slice(5, 7)) - 1
    if (t.type === "INCOME") monthlyIncome[idx] += t.amount
    if (t.type === "EXPENSE") monthlyExpense[idx] += t.amount
  }
  const netCashFlowSeries = MONTH_NAMES.map((m, i) => ({
    month: m,
    net: Math.round((monthlyIncome[i] - monthlyExpense[i]) * 100) / 100,
  }))

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel(month)} · derived entirely from the transaction ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Filter size={14} />
            All accounts
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download size={14} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={TrendingUp}
          label="Total Monthly Income"
          value={income}
          color="text-emerald-500"
          subtitle="Budget base for all targets"
        />
        <StatTile
          icon={TrendingDown}
          label="Expenses"
          value={expense}
          color="text-red-500"
          subtitle={`Needs ${formatPHP(needs)} · Wants ${formatPHP(wants)}`}
        />
        <StatTile
          icon={PiggyBank}
          label="Savings Logged"
          value={savings}
          color="text-foreground"
          subtitle={`${savingsPercent}% of income this month`}
        />
        <StatTile
          icon={Scale}
          label="Net Cash Flow"
          value={netCashFlow}
          color="text-emerald-500"
          subtitle="Income minus expenses"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border bg-transparent">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <CardTitle className="flex items-center gap-1.5">
              <LineChart size={14} className="text-muted-foreground" />
              Net Cash Flow: {year}
            </CardTitle>
            <span className="text-xs text-emerald-500">+{formatPHP(netCashFlow)} this month</span>
          </CardHeader>
          <CardContent>
            <NetCashFlowChart data={netCashFlowSeries} />
          </CardContent>
        </Card>
        <BudgetSplitCard totalMonthlyIncome={income} settings={settings} actuals={{ needs, wants, savings }} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border bg-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <BarChart3 size={14} className="text-muted-foreground" />
              {monthLabel(month)} Composition
            </CardTitle>
            <CardDescription>Income against Needs, Wants, and Savings</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBarChart month={monthLabel(month)} income={income} needs={needs} wants={wants} savings={savings} />
          </CardContent>
        </Card>

        {physical.length > 0 && (
          <Card className="border-border bg-transparent">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <CardTitle className="flex items-center gap-1.5">
                <Wallet size={14} className="text-muted-foreground" />
                Denomination Breakdown
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Paper {formatPHP(paperCashTotal)} · Coins {formatPHP(coinPouchTotal)}
              </span>
            </CardHeader>
            <CardContent className="space-y-6">
              {physical.map((a) => {
                const denominations = denominationsFor(a.account_type)
                const onHand = onHandByAccount.get(a.account_id) ?? new Map<number, number>()
                const data = denominations.map((d) => ({ denomination: d, quantity: onHand.get(d) ?? 0 }))
                return (
                  <div key={a.account_id}>
                    <h3 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {a.name}
                    </h3>
                    <DenominationBarChart data={data} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-border bg-transparent">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Recent Ledger</CardTitle>
            <CardDescription>{monthLabel(month)}</CardDescription>
          </div>
          <span className="text-xs text-muted-foreground">
            Latest {recentTransactions.length} of {(monthTxData ?? []).length} this month
          </span>
        </CardHeader>
        <CardContent>
          <RecentLedger transactions={recentTransactions} />
        </CardContent>
      </Card>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: Readonly<{
  icon: LucideIcon
  label: string
  value: number
  subtitle: string
  color: string
}>) {
  return (
    <Card className="border-border bg-transparent">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon size={14} className="text-muted-foreground" />
          {label}
        </CardDescription>
        <CardTitle className={`text-3xl font-light tabular-nums ${color}`}>{formatPHP(value)}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
    </Card>
  )
}
