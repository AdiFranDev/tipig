import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultAccounts, isPhysicalAccount, ACCOUNT_ICONS, type AccountBalance } from "@/lib/accounts"
import { ensureDefaultCategories, type Category } from "@/lib/categories"
import { ensureDefaultSavingsGoals, type SavingsGoalBalance } from "@/lib/savings"
import { ensureDefaultSettings } from "@/lib/settings"
import {
  currentMonth,
  monthRange,
  aggregateByType,
  TRANSACTION_TYPES,
  EXPENSE_CLASSIFICATIONS,
  type TransactionDetail,
  type TransactionType,
} from "@/lib/transactions"
import { formatPHP, formatEnumLabel } from "@/lib/format"
import { KpiCard, MiniStat, BudgetSplitStat } from "@/components/stat-cards"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { EnumSelectValue, NamedSelectValue } from "@/components/enum-select-value"
import { TransactionForm } from "./transaction-form"
import { createTransaction, deleteTransaction } from "./actions"
import { ActionForm } from "@/components/action-form"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_TX_LIMIT = 5
const LOAD_MORE_STEP = 5

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function adjacentMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number)
  const d = new Date(year, mon - 1 + delta, 1)
  return currentMonth(d)
}

type TransactionsSearchParams = {
  month?: string
  q?: string
  type?: string
  bucket?: string
  category?: string
  account?: string
  limit?: string
}

export default async function TransactionsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<TransactionsSearchParams> }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  await Promise.all([
    ensureDefaultAccounts(supabase, user.id),
    ensureDefaultCategories(supabase, user.id),
    ensureDefaultSavingsGoals(supabase, user.id),
  ])

  const {
    month: monthParam,
    q,
    type: typeFilter,
    bucket: bucketFilter,
    category: categoryFilter,
    account: accountFilter,
    limit: limitParam,
  } = await searchParams
  const month = monthParam ?? currentMonth()
  const { start, end } = monthRange(month)
  const requestedLimit = Number(limitParam)
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : DEFAULT_TX_LIMIT

  const [
    { data: accountsData },
    { data: categoriesData },
    { data: goalsData },
    { data: balancesData },
    { data: goalBalancesData },
    { data: monthTxData },
    settings,
  ] = await Promise.all([
    supabase.from("accounts").select("id, name, account_type").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").eq("is_active", true).order("name"),
    supabase.from("savings_goals").select("id, name").eq("is_active", true).order("name"),
    supabase.from("account_balances").select("*").eq("is_active", true).order("name"),
    supabase.from("savings_goal_balances").select("*").eq("is_active", true),
    supabase
      .from("transactions")
      .select("type, amount, expense_classification")
      .gte("transaction_date", start)
      .lt("transaction_date", end),
    ensureDefaultSettings(supabase, user.id),
  ])

  const accounts = accountsData ?? []
  const categories = (categoriesData ?? []) as Category[]
  const goals = goalsData ?? []
  const accountBalances = (balancesData ?? []) as AccountBalance[]
  const goalBalances = (goalBalancesData ?? []) as SavingsGoalBalance[]

  const totalMoney = accountBalances.reduce((sum, a) => sum + a.balance, 0)
  const savedMoney = goalBalances.reduce((sum, g) => sum + g.saved_amount, 0)
  const availableToSpend = totalMoney - savedMoney

  const { income, expense, savings } = aggregateByType(monthTxData ?? [])
  const needs = (monthTxData ?? [])
    .filter((t) => t.type === "EXPENSE" && t.expense_classification === "NEED")
    .reduce((sum, t) => sum + t.amount, 0)
  const wants = (monthTxData ?? [])
    .filter((t) => t.type === "EXPENSE" && t.expense_classification === "WANT")
    .reduce((sum, t) => sum + t.amount, 0)

  let txQuery = supabase
    .from("transaction_details")
    .select("*")
    .gte("transaction_date", start)
    .lt("transaction_date", end)

  if (q) txQuery = txQuery.ilike("description", `%${q}%`)
  if (typeFilter && (TRANSACTION_TYPES as readonly string[]).includes(typeFilter)) {
    txQuery = txQuery.eq("type", typeFilter)
  }
  if (bucketFilter && (EXPENSE_CLASSIFICATIONS as readonly string[]).includes(bucketFilter)) {
    txQuery = txQuery.eq("expense_classification", bucketFilter)
  }
  if (categoryFilter && UUID_RE.test(categoryFilter)) {
    txQuery = txQuery.eq("category_id", categoryFilter)
  }
  if (accountFilter && UUID_RE.test(accountFilter)) {
    txQuery = txQuery.or(`account_id.eq.${accountFilter},destination_account_id.eq.${accountFilter}`)
  }

  const { data: txData } = await txQuery
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, limit) // fetch one extra row past `limit` to detect "has more" without a count query

  const allFetched = (txData ?? []) as TransactionDetail[]
  const transactions = allFetched.slice(0, limit)
  const hasMore = allFetched.length > limit
  const hasFilters = Boolean(q || typeFilter || bucketFilter || categoryFilter || accountFilter)

  function baseParams() {
    const params = new URLSearchParams()
    params.set("month", month)
    if (q) params.set("q", q)
    if (typeFilter) params.set("type", typeFilter)
    if (bucketFilter) params.set("bucket", bucketFilter)
    if (categoryFilter) params.set("category", categoryFilter)
    return params
  }

  function accountHref(accountId: string) {
    const params = baseParams()
    if (accountFilter !== accountId) params.set("account", accountId)
    return `/transactions?${params.toString()}`
  }

  const loadMoreParams = baseParams()
  if (accountFilter) loadMoreParams.set("account", accountFilter)
  loadMoreParams.set("limit", String(limit + LOAD_MORE_STEP))
  const loadMoreHref = `/transactions?${loadMoreParams.toString()}`

  const digitalBalances = accountBalances.filter((a) => !isPhysicalAccount(a.account_type))
  const physicalBalances = accountBalances.filter((a) => isPhysicalAccount(a.account_type))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/transactions?month=${adjacentMonth(month, -1)}`} />}
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
            render={<Link href={`/transactions?month=${adjacentMonth(month, 1)}`} />}
          >
            ›
          </Button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[350px_1fr] lg:items-start lg:gap-6 space-y-6 lg:space-y-0">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Add Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionForm accounts={accounts} categories={categories} savingsGoals={goals} action={createTransaction} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search &amp; Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <form method="get" action="/transactions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="month" value={month} />
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Input name="q" placeholder="Search description..." defaultValue={q ?? ""} />
                </div>
                <Select name="type" defaultValue={typeFilter ?? "ALL"}>
                  <SelectTrigger className="w-full">
                    <EnumSelectValue allLabel="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    {TRANSACTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatEnumLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select name="bucket" defaultValue={bucketFilter ?? "ALL"}>
                  <SelectTrigger className="w-full">
                    <EnumSelectValue allLabel="Needs & Wants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Needs &amp; Wants</SelectItem>
                    {EXPENSE_CLASSIFICATIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {formatEnumLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select name="category" defaultValue={categoryFilter ?? "ALL"}>
                  <SelectTrigger className="w-full">
                    <NamedSelectValue items={categories} extra={{ value: "ALL", label: "All Categories" }} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select name="account" defaultValue={accountFilter ?? "ALL"}>
                  <SelectTrigger className="w-full">
                    <NamedSelectValue items={accounts} extra={{ value: "ALL", label: "All Accounts" }} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Accounts</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                  <Button type="submit">Apply Filters</Button>
                  {hasFilters && (
                    <Button
                      type="button"
                      variant="ghost"
                      nativeButton={false}
                      render={<Link href={`/transactions?month=${month}`} />}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Total Money" hint="Sum of all active accounts" value={totalMoney} />
            <KpiCard
              label="Saved Money"
              hint={`Across ${goalBalances.length} savings goal${goalBalances.length === 1 ? "" : "s"}`}
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
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <MiniStat
                  label="Income"
                  value={income}
                  tone="emerald"
                />
                <MiniStat
                  label="Expenses"
                  value={expense}
                  tone="destructive"
                  subtitle={`Needs ${formatPHP(needs)} · Wants ${formatPHP(wants)}`}
                />
                <MiniStat label="Savings" value={savings} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Balances</CardTitle>
              <CardDescription>Current balance, as of now: tap an account to filter below</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <AccountBalanceList
                title="Digital"
                accounts={digitalBalances}
                activeAccountId={accountFilter}
                hrefFor={accountHref}
              />
              <AccountBalanceList
                title="Physical"
                accounts={physicalBalances}
                activeAccountId={accountFilter}
                hrefFor={accountHref}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{monthLabel(month)}</CardTitle>
              {transactions.length > 0 && (
                <CardDescription>
                  Showing {transactions.length}
                  {hasMore ? "+" : ""} transaction{transactions.length === 1 ? "" : "s"}
                  {hasFilters ? ". Narrow your search or load more below" : ""}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {transactions.length === 0 ? (
                <p className="px-(--card-spacing) py-6 text-sm text-muted-foreground">
                  No transactions match.
                </p>
              ) : (
                transactions.map((t) => <TransactionRow key={t.id} transaction={t} />)
              )}
            </CardContent>
            {hasMore && (
              <CardFooter>
                <Button variant="outline" className="w-full" nativeButton={false} render={<Link href={loadMoreHref} />}>
                  Load {LOAD_MORE_STEP} more
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function AccountBalanceList({
  title,
  accounts,
  activeAccountId,
  hrefFor,
}: Readonly<{
  title: string
  accounts: AccountBalance[]
  activeAccountId?: string
  hrefFor: (accountId: string) => string
}>) {
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
      <ul className="space-y-1">
        {accounts.map((a) => {
          const Icon = ACCOUNT_ICONS[a.account_type]
          const isActive = a.account_id === activeAccountId
          return (
            <li key={a.account_id}>
              {/* Plain anchor (not next/link): forces a full navigation so the
                  Search & Filter selects re-initialize with the new account
                  filter instead of keeping their stale defaultValue. */}
              <a
                href={hrefFor(a.account_id)}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                  isActive ? "bg-accent ring-1 ring-primary/40" : ""
                }`}
              >
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
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const TYPE_SIGN: Record<TransactionType, -1 | 0 | 1> = {
  INCOME: 1,
  EXPENSE: -1,
  SAVINGS: 0,
  TRANSFER: 0,
}

function TransactionRow({ transaction: t }: Readonly<{ transaction: TransactionDetail }>) {
  const sign = TYPE_SIGN[t.type]
  const deleteWithId = deleteTransaction.bind(null, t.id)

  const detail =
    t.type === "TRANSFER"
      ? `${t.account_name} → ${t.destination_account_name}`
      : t.type === "SAVINGS"
        ? `${t.account_name} → ${t.savings_goal_name}`
        : `${t.category_name} · ${t.account_name}`

  return (
    <div className="flex items-center justify-between gap-3 px-(--card-spacing) py-3">
      <Link href={`/transactions/${t.id}/edit`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {t.description || t.category_name || t.type}
          </p>
          <Badge variant="secondary">{t.type}</Badge>
          {t.expense_classification && (
            <Badge variant="outline">{t.expense_classification}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t.transaction_date} · {detail}
        </p>
      </Link>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          sign > 0 ? "text-emerald-600" : sign < 0 ? "text-destructive" : "text-foreground"
        }`}
      >
        {sign > 0 ? "+" : sign < 0 ? "-" : ""}
        {formatPHP(t.amount)}
      </span>
      <ActionForm action={deleteWithId} successMessage="Transaction deleted">
        <Button variant="ghost" size="icon-sm" type="submit" aria-label="Delete transaction">
          ×
        </Button>
      </ActionForm>
    </div>
  )
}
