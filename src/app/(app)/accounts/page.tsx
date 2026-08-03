import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  ACCOUNT_TYPES,
  accountTypeLabel,
  ensureDefaultAccounts,
  isPhysicalAccount,
  type AccountBalance,
} from "@/lib/accounts"
import { formatPHP } from "@/lib/format"
import { createAccount, archiveAccount } from "./actions"
import { Pencil, Trash2 } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { AccountTypeSelectValue } from "@/components/enum-select-value"
import { Badge } from "@/components/ui/badge"

export default async function AccountsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  await ensureDefaultAccounts(supabase, user.id)

  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
    .order("name")

  const accounts = (data ?? []) as AccountBalance[]
  const digital = accounts.filter((a) => !isPhysicalAccount(a.account_type))
  const physical = accounts.filter((a) => isPhysicalAccount(a.account_type))

  return (
    <div className="max-w-4xl mx-auto space-y-8 w-full">
      <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load accounts: {error.message}
        </div>
      )}

      <AccountGroup title="Digital Accounts" accounts={digital} />
      <AccountGroup title="Physical Accounts" accounts={physical} />

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Add Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAccount} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. BPI" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account_type">Type</Label>
              <Select name="account_type" defaultValue="DIGITAL_BANK">
                <SelectTrigger id="account_type" className="w-full">
                  <AccountTypeSelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening_balance">Opening Balance</Label>
              <Input
                id="opening_balance"
                name="opening_balance"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
              />
            </div>
            <Button type="submit" className="w-full">
              Add Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AccountGroup({
  title,
  accounts,
}: Readonly<{ title: string; accounts: AccountBalance[] }>) {
  if (accounts.length === 0) return null

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {accounts.map((a) => {
          const archiveWithId = archiveAccount.bind(null, a.account_id)
          return (
            <div
              key={a.account_id}
              className="group flex items-center gap-2 px-(--card-spacing) py-3"
            >
              <Link
                href={`/accounts/${a.account_id}/edit`}
                className="min-w-0 flex-1 flex items-center justify-between gap-3 hover:opacity-80"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                    {a.name}
                    {!a.is_active && <Badge variant="secondary">Archived</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{accountTypeLabel(a.account_type)}</p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    a.balance < 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {formatPHP(a.balance)}
                </span>
              </Link>
              {isPhysicalAccount(a.account_type) && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/accounts/${a.account_id}/reconcile`} />}
                >
                  Reconcile
                </Button>
              )}
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={<Link href={`/accounts/${a.account_id}/edit`} />}
                  aria-label="Edit account"
                >
                  <Pencil />
                </Button>
                {a.is_active && (
                  <form action={archiveWithId}>
                    <Button variant="ghost" size="icon-sm" type="submit" aria-label="Archive account">
                      <Trash2 />
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
