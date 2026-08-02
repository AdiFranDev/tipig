import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultAccounts } from "@/lib/accounts"
import { ensureDefaultCategories, type Category } from "@/lib/categories"
import { ensureDefaultSavingsGoals } from "@/lib/savings"
import {
  currentMonth,
  monthRange,
  TRANSACTION_TYPES,
  EXPENSE_CLASSIFICATIONS,
  type TransactionDetail,
  type TransactionType,
} from "@/lib/transactions"
import { formatPHP, formatEnumLabel } from "@/lib/format"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TransactionForm } from "./transaction-form"
import { createTransaction, deleteTransaction } from "./actions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  const { month: monthParam, q, type: typeFilter, bucket: bucketFilter, category: categoryFilter, account: accountFilter } =
    await searchParams
  const month = monthParam ?? currentMonth()
  const { start, end } = monthRange(month)

  const [{ data: accountsData }, { data: categoriesData }, { data: goalsData }] = await Promise.all([
    supabase.from("accounts").select("id, name, account_type").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").eq("is_active", true).order("name"),
    supabase.from("savings_goals").select("id, name").eq("is_active", true).order("name"),
  ])

  const accounts = accountsData ?? []
  const categories = (categoriesData ?? []) as Category[]
  const goals = goalsData ?? []

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

  const transactions = (txData ?? []) as TransactionDetail[]
  const hasFilters = Boolean(q || typeFilter || bucketFilter || categoryFilter || accountFilter)

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
                    <SelectValue />
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
                    <SelectValue />
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
                    <SelectValue />
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
                    <SelectValue />
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
              <CardTitle>{monthLabel(month)}</CardTitle>
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
          </Card>
        </div>
      </div>
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
      <form action={deleteWithId}>
        <Button variant="ghost" size="icon-sm" type="submit" aria-label="Delete transaction">
          ×
        </Button>
      </form>
    </div>
  )
}
