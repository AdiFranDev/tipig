import type { LucideIcon } from "lucide-react"
import { ArrowDownLeft, ArrowUpRight, RefreshCw, PiggyBank, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatPHP } from "@/lib/format"
import type { TransactionDetail } from "@/lib/transactions"

const TONE: Record<TransactionDetail["type"], string> = {
  INCOME: "text-emerald-500",
  EXPENSE: "text-red-500",
  SAVINGS: "text-foreground",
  TRANSFER: "text-foreground",
}

const SIGN: Record<TransactionDetail["type"], string> = {
  INCOME: "+",
  EXPENSE: "-",
  SAVINGS: "",
  TRANSFER: "",
}

const TYPE_ICON: Record<TransactionDetail["type"], LucideIcon> = {
  INCOME: ArrowDownLeft,
  EXPENSE: ArrowUpRight,
  TRANSFER: RefreshCw,
  SAVINGS: PiggyBank,
}

function whereFor(t: TransactionDetail): string {
  if (t.type === "TRANSFER") return `${t.account_name} : ${t.destination_account_name}`
  if (t.type === "SAVINGS") return `${t.account_name} : ${t.savings_goal_name}`
  return `${t.category_name} : ${t.account_name}`
}

export function RecentLedger({ transactions }: Readonly<{ transactions: TransactionDetail[] }>) {
  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions yet this month.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Description</th>
            <th className="py-2 pr-3 font-medium">Type</th>
            <th className="py-2 pr-3 font-medium">Where</th>
            <th className="py-2 pl-3 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((t) => {
            const Icon = TYPE_ICON[t.type]
            return (
              <tr key={t.id}>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span className="truncate font-medium text-foreground">
                      {t.description || t.category_name || t.type}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">
                      <Icon />
                      {t.type}
                    </Badge>
                    {t.expense_classification && <Badge variant="outline">{t.expense_classification}</Badge>}
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="size-3.5 shrink-0" />
                    <span className="truncate">{whereFor(t)}</span>
                  </div>
                </td>
                <td className="py-2.5 pl-3 text-right">
                  <span className={`font-semibold tabular-nums ${TONE[t.type]}`}>
                    {SIGN[t.type]}
                    {formatPHP(t.amount)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
