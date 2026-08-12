import type { Settings } from "@/lib/settings"

export type BudgetBucketKey = "needs" | "wants" | "savings"

export type BudgetBucket = {
  key: BudgetBucketKey
  label: string
  percentage: number
  target: number
  actual: number
}

export type BudgetSplitResult =
  | { status: "no_income" }
  | { status: "invalid_ratios"; total: number }
  | { status: "ok"; buckets: BudgetBucket[] }

const RATIO_TOLERANCE = 0.01

/**
 * Pure calculation for the Budget Split visualization. Base value is Total
 * Monthly Income (money actually earned this month), not Net Cash Flow or
 * current on-hand balances — those already reflect spending decisions, which
 * would make the "if you followed your targets" comparison circular.
 */
export function computeBudgetSplit(
  totalMonthlyIncome: number,
  settings: Pick<
    Settings,
    "needs_target_percentage" | "wants_target_percentage" | "savings_target_percentage"
  >,
  actuals: { needs: number; wants: number; savings: number }
): BudgetSplitResult {
  if (totalMonthlyIncome <= 0) return { status: "no_income" }

  const total =
    Math.round(
      (settings.needs_target_percentage +
        settings.wants_target_percentage +
        settings.savings_target_percentage) *
        100
    ) / 100
  if (Math.abs(total - 100) > RATIO_TOLERANCE) return { status: "invalid_ratios", total }

  const buckets: BudgetBucket[] = [
    {
      key: "needs",
      label: "Needs",
      percentage: settings.needs_target_percentage,
      target: (totalMonthlyIncome * settings.needs_target_percentage) / 100,
      actual: actuals.needs,
    },
    {
      key: "wants",
      label: "Wants",
      percentage: settings.wants_target_percentage,
      target: (totalMonthlyIncome * settings.wants_target_percentage) / 100,
      actual: actuals.wants,
    },
    {
      key: "savings",
      label: "Savings",
      percentage: settings.savings_target_percentage,
      target: (totalMonthlyIncome * settings.savings_target_percentage) / 100,
      actual: actuals.savings,
    },
  ]

  return { status: "ok", buckets }
}
