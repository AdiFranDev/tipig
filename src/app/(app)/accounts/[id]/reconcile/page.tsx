import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isPhysicalAccount } from "@/lib/accounts"
import { denominationsFor, denominationFieldName, type DenominationBalance } from "@/lib/denominations"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { reconcilePhysicalCash } from "../../actions"

export default async function ReconcileAccountPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  const supabase = await createClient()

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, account_type")
    .eq("id", id)
    .single()

  if (!account || !isPhysicalAccount(account.account_type)) notFound()

  const denominations = denominationsFor(account.account_type)
  const { data: balancesData } = await supabase
    .from("denomination_balances")
    .select("denomination, on_hand")
    .eq("account_id", id)

  const balances = (balancesData ?? []) as DenominationBalance[]
  const onHand = new Map(balances.map((b) => [b.denomination, b.on_hand]))

  const reconcileWithId = reconcilePhysicalCash.bind(null, account.id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Reconcile {account.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Physical Adjustment / Loss</CardTitle>
          <CardDescription>
            Count what&apos;s actually in {account.name} and enter it below. Any difference from
            what&apos;s recorded becomes an explicit adjustment transaction — nothing is
            overwritten silently.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={reconcileWithId} className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs font-medium text-muted-foreground">
              <span>Denomination</span>
              <span>Recorded</span>
              <span>Actual Count</span>
            </div>
            {denominations.map((d) => (
              <div key={d} className="grid grid-cols-3 items-center gap-3">
                <Label htmlFor={denominationFieldName("actual", d)}>₱{d}</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {onHand.get(d) ?? 0}
                </span>
                <Input
                  id={denominationFieldName("actual", d)}
                  name={denominationFieldName("actual", d)}
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={onHand.get(d) ?? 0}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Leave a row unchanged if the count matches. Only rows you edit create a
              difference — a shortfall logs a Physical Adjustment/Loss expense; extra cash found
              logs a Physical Adjustment/Gain income.
            </p>
            <Button type="submit" className="w-full">
              Reconcile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
