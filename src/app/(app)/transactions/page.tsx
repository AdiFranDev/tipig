import Link from "next/link"
import { Plus, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultAccounts, toAccountBalance } from "@/lib/accounts"
import { ensureDefaultCategories, type Category } from "@/lib/categories"
import { ensureDefaultSavingsGoals, toSavingsGoalBalance } from "@/lib/savings"
import {
  currentMonth,
  monthRange,
  aggregateByType,
  excludeSavedExpenses,
  TRANSACTION_TYPES,
  EXPENSE_CLASSIFICATIONS,
  toTransactionDetail,
  type TransactionDetail,
  type TransactionType,
  type ExpenseClassification,
} from "@/lib/transactions"
import { formatPHP, formatEnumLabel } from "@/lib/format"
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

function isTransactionType(value: string): value is TransactionType {
  return (TRANSACTION_TYPES as readonly string[]).includes(value)
}

function isExpenseClassification(value: string): value is ExpenseClassification {
  return (EXPENSE_CLASSIFICATIONS as readonly string[]).includes(value)
}

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
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
      .select("type, amount, funding_source")
      .gte("transaction_date", start)
      .lt("transaction_date", end),
  ])

  const accounts = accountsData ?? []
  const categories: Category[] = categoriesData ?? []
  const goals = goalsData ?? []
  const accountBalances = (accountBalancesData ?? []).map(toAccountBalance)
  const goalBalances = (goalBalancesData ?? []).map(toSavingsGoalBalance)
  const availableToSpend =
    accountBalances.reduce((sum, a) => sum + a.balance, 0) -
    goalBalances.reduce((sum, g) => sum + g.saved_amount, 0)
  const { income, expense, savings } = aggregateByType(excludeSavedExpenses(monthTxData ?? []))
  const totalEntries = (monthTxData ?? []).length

  let txQuery = supabase
    .from("transaction_details")
    .select("*")
    .gte("transaction_date", start)
    .lt("transaction_date", end)

  if (q) txQuery = txQuery.ilike("description", `%${q}%`)
  if (typeFilter && isTransactionType(typeFilter)) {
    txQuery = txQuery.eq("type", typeFilter)
  }
  if (bucketFilter && isExpenseClassification(bucketFilter)) {
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

  const allFetched = (txData ?? []).map(toTransactionDetail)
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

  const loadMoreParams = baseParams()
  if (accountFilter) loadMoreParams.set("account", accountFilter)
  loadMoreParams.set("limit", String(limit + LOAD_MORE_STEP))
  const loadMoreHref = `/transactions?${loadMoreParams.toString()}`

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel(month)} · {totalEntries} entries · the single source of truth
          </p>
        </div>
        <div className="flex items-center gap-6">
          <HeaderStat label="Income" value={income} color="text-emerald-500" />
          <HeaderStat label="Expenses" value={expense} color="text-red-500" />
          <HeaderStat label="Savings" value={savings} color="text-foreground" />
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-6 space-y-6 lg:space-y-0">
        <div className="max-w-xl rounded-xl border border-border bg-transparent p-4 lg:sticky lg:top-20">
          <h2 className="mb-4 flex items-center gap-2 text-base font-medium text-foreground">
            <Plus size={16} />
            Add Transaction
          </h2>
          <TransactionForm
            accounts={accounts}
            categories={categories}
            savingsGoals={goals}
            action={createTransaction}
            availableToSpend={availableToSpend}
          />
        </div>

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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={16} />
                {monthLabel(month)}
              </CardTitle>
              {transactions.length > 0 && (
                <CardDescription>
                  Showing {transactions.length}
                  {hasMore ? "+" : ""} transaction{transactions.length === 1 ? "" : "s"}
                  {hasFilters ? ". Narrow your search or load more below" : ""}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <p className="px-(--card-spacing) py-6 text-sm text-muted-foreground">
                  No transactions match.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <th className="px-(--card-spacing) py-2 font-medium">Date</th>
                        <th className="px-(--card-spacing) py-2 font-medium">Entry</th>
                        <th className="px-(--card-spacing) py-2 font-medium">Where</th>
                        <th className="px-(--card-spacing) py-2 text-right font-medium">Amount</th>
                        <th className="px-(--card-spacing) py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.map((t) => (
                        <TransactionRow key={t.id} transaction={t} />
                      ))}
                    </tbody>
                  </table>
                </div>
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

function HeaderStat({
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

const TYPE_SIGN: Record<TransactionType, -1 | 0 | 1> = {
  INCOME: 1,
  EXPENSE: -1,
  SAVINGS: 0,
  TRANSFER: 0,
}

function TransactionRow({ transaction: t }: Readonly<{ transaction: TransactionDetail }>) {
  const sign = TYPE_SIGN[t.type]
  const deleteWithId = deleteTransaction.bind(null, t.id)

  const where =
    t.type === "TRANSFER"
      ? `${t.account_name} : ${t.destination_account_name}`
      : t.type === "SAVINGS"
        ? `${t.account_name} : ${t.savings_goal_name}`
        : `${t.category_name} : ${t.account_name}`

  return (
    <tr>
      <td className="px-(--card-spacing) py-3 text-sm text-muted-foreground">{t.transaction_date}</td>
      <td className="px-(--card-spacing) py-3">
        <Link href={`/transactions/${t.id}/edit`} className="block min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {t.description || t.category_name || t.type}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="secondary">{t.type}</Badge>
            {t.expense_classification && <Badge variant="outline">{t.expense_classification}</Badge>}
          </div>
        </Link>
      </td>
      <td className="px-(--card-spacing) py-3 text-sm text-muted-foreground">{where}</td>
      <td className="px-(--card-spacing) py-3 text-right">
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            sign > 0 ? "text-emerald-500" : sign < 0 ? "text-red-500" : "text-foreground"
          }`}
        >
          {sign > 0 ? "+" : sign < 0 ? "-" : ""}
          {formatPHP(t.amount)}
        </span>
      </td>
      <td className="px-(--card-spacing) py-3 text-right">
        <ActionForm action={deleteWithId} successMessage="Transaction deleted">
          <Button variant="ghost" size="icon-sm" type="submit" aria-label="Delete transaction">
            ×
          </Button>
        </ActionForm>
      </td>
    </tr>
  )
}
