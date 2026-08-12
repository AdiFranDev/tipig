import type { Database } from "@/types/supabase"

export type ScholarshipAllocation = Pick<
  Database["public"]["Tables"]["scholarship_allocations"]["Row"],
  "id" | "name" | "total_amount" | "starting_month" | "covered_months"
>

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
