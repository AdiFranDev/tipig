"use client"

import { useState } from "react"
import { Plus, Coins, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { NamedSelectValue } from "@/components/enum-select-value"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ActionCard } from "@/components/action-card"
import { TransactionForm } from "@/app/(app)/transactions/transaction-form"
import { createTransaction } from "@/app/(app)/transactions/actions"
import { sweepMonth } from "@/actions/transactions"
import { useActionToast } from "@/hooks/use-action-toast"
import type { AccountOption } from "@/lib/accounts"
import type { Category } from "@/lib/categories"
import { formatPHP } from "@/lib/format"

type SavingsGoalOption = { id: string; name: string }

export function DashboardQuickActions({
  accounts,
  categories,
  savingsGoals,
  availableToSpend,
  month,
  monthlyRemaining,
  defaultSweepAccountId,
}: Readonly<{
  accounts: AccountOption[]
  categories: Category[]
  savingsGoals: SavingsGoalOption[]
  availableToSpend: number
  month: string
  monthlyRemaining: number
  defaultSweepAccountId?: string
}>) {
  const [addOpen, setAddOpen] = useState(false)
  const [coinsOpen, setCoinsOpen] = useState(false)
  const [sweepOpen, setSweepOpen] = useState(false)
  const [sweepAccountId, setSweepAccountId] = useState(defaultSweepAccountId ?? "")
  const [sweepAction, sweepPending] = useActionToast(sweepMonth, "Swept into savings", () => setSweepOpen(false))
  const canSweep = monthlyRemaining > 0

  const coinPouchAccountId = accounts.find((a) => a.account_type === "COIN_POUCH")?.id

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger
          render={
            <ActionCard
              icon={Plus}
              title="Add Transaction"
              description="Log income, an expense, a transfer, or savings"
            />
          }
        />
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>Record a new transaction on the ledger.</DialogDescription>
          </DialogHeader>
          <TransactionForm
            accounts={accounts}
            categories={categories}
            savingsGoals={savingsGoals}
            action={createTransaction}
            onSuccess={() => setAddOpen(false)}
            availableToSpend={availableToSpend}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={coinsOpen} onOpenChange={setCoinsOpen}>
        <DialogTrigger
          render={
            <ActionCard
              icon={Coins}
              title="Quick Coins"
              description="Rapid logging for a small Coin Pouch expense"
            />
          }
        />
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Coins</DialogTitle>
            <DialogDescription>Log a small Coin Pouch expense.</DialogDescription>
          </DialogHeader>
          <TransactionForm
            accounts={accounts}
            categories={categories}
            savingsGoals={savingsGoals}
            action={createTransaction}
            defaultType="EXPENSE"
            defaultAccountId={coinPouchAccountId}
            onSuccess={() => setCoinsOpen(false)}
            availableToSpend={availableToSpend}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={sweepOpen} onOpenChange={setSweepOpen}>
        <DialogTrigger
          render={
            <ActionCard
              icon={Calendar}
              title={`Sweep ${formatPHP(monthlyRemaining)}`}
              description="Not yet swept into savings. Sweep it now, or leave it to carry forward as Available to Spend."
            />
          }
        />
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sweep into Savings</DialogTitle>
          </DialogHeader>
          {canSweep ? (
            <form action={sweepAction} className="space-y-3">
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="target" value="UNALLOCATED" />
              <p className="text-sm text-muted-foreground">
                Are you sure you want to sweep {formatPHP(monthlyRemaining)} into your Unallocated Savings?
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="sweep_account_id">From Account</Label>
                <Select
                  name="account_id"
                  value={sweepAccountId}
                  onValueChange={(v) => setSweepAccountId(v ?? "")}
                >
                  <SelectTrigger id="sweep_account_id" className="w-full">
                    <NamedSelectValue items={accounts} placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={sweepPending || !sweepAccountId}>
                {sweepPending ? "Sweeping..." : "Confirm Sweep"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing left to sweep this month.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
