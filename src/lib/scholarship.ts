export type ScholarshipAllocation = {
  id: string
  name: string
  total_amount: number
  starting_month: string
  covered_months: number
}

/** Monthly available allowance = total amount ÷ number of covered months. */
export function monthlyAllowance(
  a: Pick<ScholarshipAllocation, "total_amount" | "covered_months">
): number {
  return Math.round((a.total_amount / a.covered_months) * 100) / 100
}

export function coveredMonthRange(
  a: Pick<ScholarshipAllocation, "starting_month" | "covered_months">
): string {
  const start = new Date(a.starting_month)
  const end = new Date(start.getFullYear(), start.getMonth() + a.covered_months - 1, 1)
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  return a.covered_months === 1 ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}
