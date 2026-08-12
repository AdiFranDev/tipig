import { createClient } from "@/lib/supabase/server"
import { ensureDefaultAccounts, isPhysicalAccount, toAccountBalance } from "@/lib/accounts"
import { formatPHP } from "@/lib/format"
import { restoreAccount } from "./actions"
import { AccountGrids } from "./account-grids"
import { RefreshCcw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ActionForm } from "@/components/action-form"

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

  const accounts = (data ?? []).map(toAccountBalance)
  const activeAccounts = accounts.filter((a) => a.is_active)
  const digital = activeAccounts.filter((a) => !isPhysicalAccount(a.account_type))
  const physical = activeAccounts.filter((a) => isPhysicalAccount(a.account_type))
  const archivedAccounts = accounts.filter((a) => !a.is_active)

  const totalMoney = activeAccounts.reduce((sum, a) => sum + a.balance, 0)
  const digitalTotal = digital.reduce((sum, a) => sum + a.balance, 0)
  const physicalTotal = physical.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className="space-y-8 px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground">Where money sits: location, never purpose</p>
        </div>
        <div className="flex gap-6">
          <Kpi label="TOTAL MONEY" value={totalMoney} />
          <Kpi label="DIGITAL" value={digitalTotal} />
          <Kpi label="PHYSICAL" value={physicalTotal} />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load accounts: {error.message}
        </div>
      )}

      <AccountGrids digital={digital} physical={physical} />

      {archivedAccounts.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Archived Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {archivedAccounts.map((a) => {
              const restoreWithId = restoreAccount.bind(null, a.account_id)
              return (
                <div key={a.account_id} className="flex items-center gap-2 px-(--card-spacing) py-3">
                  <span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground truncate">
                    {a.name}
                  </span>
                  <ActionForm action={restoreWithId} successMessage="Account restored">
                    <Button variant="ghost" size="icon-sm" type="submit" aria-label="Restore account">
                      <RefreshCcw />
                    </Button>
                  </ActionForm>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Kpi({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{formatPHP(value)}</p>
    </div>
  )
}
