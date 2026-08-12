import { Target } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { formatPHP } from "@/lib/format"
import { computeBudgetSplit, type BudgetBucketKey } from "@/lib/budget"
import type { Settings } from "@/lib/settings"

const SWATCH: Record<BudgetBucketKey, string> = {
  needs: "bg-[var(--chart-2)]",
  wants: "bg-[var(--chart-3)]",
  savings: "bg-[var(--chart-4)]",
}

export function BudgetSplitCard({
  totalMonthlyIncome,
  settings,
  actuals,
}: Readonly<{
  totalMonthlyIncome: number
  settings: Pick<
    Settings,
    "needs_target_percentage" | "wants_target_percentage" | "savings_target_percentage"
  >
  actuals: { needs: number; wants: number; savings: number }
}>) {
  const result = computeBudgetSplit(totalMonthlyIncome, settings, actuals)

  return (
    <Card className="border-border bg-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Target size={14} className="text-muted-foreground" />
          Budget Split: {Math.round(settings.needs_target_percentage)}/
          {Math.round(settings.wants_target_percentage)}/
          {Math.round(settings.savings_target_percentage)}
        </CardTitle>
        <CardDescription>
          {result.status === "ok"
            ? `If your Total Monthly Income of ${formatPHP(totalMonthlyIncome)} followed your Settings targets. Visualization only: nothing is divided or moved.`
            : "A visualization only, nothing is actually divided or moved."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.status === "no_income" && (
          <p className="text-sm text-muted-foreground">
            No income logged this month yet, so there is nothing to split.
          </p>
        )}
        {result.status === "invalid_ratios" && (
          <p className="text-sm text-destructive">
            Needs, Wants, and Savings targets add up to {result.total}%, not 100%. Fix this in
            Settings to see the split.
          </p>
        )}
        {result.status === "ok" && (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {result.buckets.map((b) => (
                <div
                  key={b.key}
                  style={{ width: `${b.percentage}%` }}
                  className={`h-full ${SWATCH[b.key]}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {result.buckets.map((b) => (
                <div key={b.key}>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-2 rounded-full ${SWATCH[b.key]}`} />
                    {b.label} ({b.percentage}%)
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {formatPHP(b.target)}
                  </p>
                  <p
                    className={`text-xs tabular-nums ${
                      b.actual > b.target ? "text-red-500" : "text-muted-foreground"
                    }`}
                  >
                    Actual {formatPHP(b.actual)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
