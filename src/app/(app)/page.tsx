import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultSettings } from "@/lib/settings"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { formatPHP } from "@/lib/format"
import { KpiCard, MiniStat, BudgetSplitStat } from "@/components/stat-cards"
import { isPhysicalAccount, ACCOUNT_ICONS, type AccountBalance } from "@/lib/accounts"
import type { SavingsGoalBalance } from "@/lib/savings"
import { currentMonth, monthRange, aggregateByType } from "@/lib/transactions"
import { denominationsFor } from "@/lib/denominations"
import { QUICK_ENTRIES } from "@/lib/quick-entries"
import { NamedSelectValue } from "@/components/enum-select-value"
import { sweepMonth, quickCoinsExpense } from "@/actions/transactions"
import { MonthlyBarChart } from "./monthly-bar-chart"
import { DenominationBarChart } from "./denomination-bar-chart"
import { ActionForm } from "@/components/action-form"

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function adjacentMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number)
  return currentMonth(new Date(year, mon - 1 + delta, 1))
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

  const [{ data: accountsData }, { data: goalsData }, { data: monthTxData }, { data: denomBalancesData }, settings] =
    await Promise.all([
      supabase.from("account_balances").select("*").order("name"),
      supabase.from("savings_goal_balances").select("*").eq("is_active", true),
      supabase
        .from("transactions")
        .select("type, amount, expense_classification")
        .gte("transaction_date", start)
        .lt("transaction_date", end),
      supabase.from("denomination_balances").select("account_id, denomination, on_hand"),
      ensureDefaultSettings(supabase, user.id),
    ])

  const accounts = (accountsData ?? []) as AccountBalance[]
  const goals = (goalsData ?? []) as SavingsGoalBalance[]

  const activeAccounts = accounts.filter((a) => a.is_active)
  const totalMoney = activeAccounts.reduce((sum, a) => sum + a.balance, 0)
  const savedMoney = goals.reduce((sum, g) => sum + g.saved_amount, 0)
  const availableToSpend = totalMoney - savedMoney

  const digital = activeAccounts.filter((a) => !isPhysicalAccount(a.account_type))
  const physical = activeAccounts.filter((a) => isPhysicalAccount(a.account_type))

  // Exact bill/coin counts per physical account, keyed for the breakdown
  // chart below — denominationsFor() supplies the canonical ordered list so
  // a denomination with zero on hand still shows as a zero-height bar.
  const onHandByAccount = new Map<string, Map<number, number>>()
  for (const row of denomBalancesData ?? []) {
    if (!onHandByAccount.has(row.account_id)) onHandByAccount.set(row.account_id, new Map())
    onHandByAccount.get(row.account_id)!.set(row.denomination, row.on_hand)
  }

  const { income, expense, savings, netCashFlow } = aggregateByType(monthTxData ?? [])
  const monthlyRemaining = Math.round((income - expense - savings) * 100) / 100

  const needs = (monthTxData ?? [])
    .filter((t) => t.type === "EXPENSE" && t.expense_classification === "NEED")
    .reduce((sum, t) => sum + t.amount, 0)
  const wants = (monthTxData ?? [])
    .filter((t) => t.type === "EXPENSE" && t.expense_classification === "WANT")
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/?month=${adjacentMonth(month, -1)}`} />}
          >
            ‹
          </Button>
          <span className="text-sm font-medium text-foreground w-32 text-center">
            {monthLabel(month)}
          </span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/?month=${adjacentMonth(month, 1)}`} />}
          >
            ›
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Money" hint="Sum of all active accounts" value={totalMoney} />
        <KpiCard
          label="Saved Money"
          hint={`Across ${goals.length} savings goal${goals.length === 1 ? "" : "s"}`}
          value={savedMoney}
        />
        <KpiCard
          label="Available to Spend"
          hint="Total minus saved"
          value={availableToSpend}
          emphasize
          highlight
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Split</CardTitle>
          <CardDescription>
            If {formatPHP(totalMoney)} followed your Settings targets: a visualization only,
            nothing is actually divided or moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div style={{ width: `${settings.needs_target_percentage}%` }} className="h-full bg-[var(--chart-2)]" />
            <div style={{ width: `${settings.wants_target_percentage}%` }} className="h-full bg-[var(--chart-3)]" />
            <div style={{ width: `${settings.savings_target_percentage}%` }} className="h-full bg-[var(--chart-4)]" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <BudgetSplitStat
              label="Needs"
              percentage={settings.needs_target_percentage}
              amount={(totalMoney * settings.needs_target_percentage) / 100}
              swatch="bg-[var(--chart-2)]"
            />
            <BudgetSplitStat
              label="Wants"
              percentage={settings.wants_target_percentage}
              amount={(totalMoney * settings.wants_target_percentage) / 100}
              swatch="bg-[var(--chart-3)]"
            />
            <BudgetSplitStat
              label="Savings"
              percentage={settings.savings_target_percentage}
              amount={(totalMoney * settings.savings_target_percentage) / 100}
              swatch="bg-[var(--chart-4)]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cash Flow: {monthLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="Income" value={income} tone="emerald" />
            <MiniStat
              label="Expenses"
              value={expense}
              tone="destructive"
              subtitle={`Needs ${formatPHP(needs)} · Wants ${formatPHP(wants)}`}
            />
            <MiniStat label="Savings" value={savings} />
            <MiniStat label="Net Cash Flow" value={netCashFlow} tone="net" />
          </div>
          <MonthlyBarChart
            month={monthLabel(month)}
            income={income}
            needs={needs}
            wants={wants}
            savings={savings}
          />
        </CardContent>
      </Card>

      {physical.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Physical Cash Breakdown</CardTitle>
            <CardDescription>Exact bill and coin counts on hand</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {physical.map((a) => {
              const denominations = denominationsFor(a.account_type)
              const onHand = onHandByAccount.get(a.account_id) ?? new Map<number, number>()
              const data = denominations.map((d) => ({ denomination: d, quantity: onHand.get(d) ?? 0 }))
              return (
                <div key={a.account_id}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {a.name}
                  </h3>
                  <DenominationBarChart data={data} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {monthlyRemaining > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Review</CardTitle>
            <CardDescription>
              {formatPHP(monthlyRemaining)} from {monthLabel(month)}{" "}
              has not been swept into savings yet. Sweep it now, or leave it: it&apos;ll simply
              carry forward as Available to Spend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={sweepMonth} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="month" value={month} />
              <div className="space-y-1.5">
                <Label htmlFor="account_id">From Account</Label>
                <Select name="account_id">
                  <SelectTrigger id="account_id" className="w-40">
                    <NamedSelectValue
                      items={activeAccounts.map((a) => ({ id: a.account_id, name: a.name }))}
                      placeholder="Account"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((a) => (
                      <SelectItem key={a.account_id} value={a.account_id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target">Sweep To</Label>
                <Select name="target" defaultValue="UNALLOCATED">
                  <SelectTrigger id="target" className="w-48">
                    <NamedSelectValue
                      items={goals.filter((g) => !g.is_unallocated).map((g) => ({ id: g.savings_goal_id, name: g.name }))}
                      extra={{ value: "UNALLOCATED", label: "Unallocated Savings" }}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNALLOCATED">Unallocated Savings</SelectItem>
                    {goals
                      .filter((g) => !g.is_unallocated)
                      .map((g) => (
                        <SelectItem key={g.savings_goal_id} value={g.savings_goal_id}>
                          {g.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Sweep {formatPHP(monthlyRemaining)}</Button>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Coins Quick Entry</CardTitle>
          <CardDescription>One tap to log a common small Coin Pouch expense</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ENTRIES.map((q) => (
            <ActionForm key={q.label} action={quickCoinsExpense}>
              <input type="hidden" name="label" value={q.label} />
              <input type="hidden" name="category_name" value={q.categoryName} />
              <input type="hidden" name="amount" value={q.defaultAmount} />
              <Button type="submit" variant="outline" className="h-auto w-full py-2 whitespace-normal">
                Log ₱{q.defaultAmount} {q.label}
              </Button>
            </ActionForm>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Locations</CardTitle>
          <CardDescription>Where your money physically sits</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <AccountList title="Digital" accounts={digital} />
          <AccountList title="Physical" accounts={physical} />
        </CardContent>
      </Card>
    </div>
  )
}

function AccountList({
  title,
  accounts,
}: Readonly<{ title: string; accounts: AccountBalance[] }>) {
  if (accounts.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">None yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {accounts.map((a) => {
          const Icon = ACCOUNT_ICONS[a.account_type]
          return (
            <li key={a.account_id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <Icon className="size-4 text-muted-foreground" />
                {a.name}
              </span>
              <span
                className={`tabular-nums font-medium ${
                  a.balance < 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {formatPHP(a.balance)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
