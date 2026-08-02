export const DEFAULT_SAVINGS_GOALS: {
  name: string
  is_unallocated: boolean
  target_amount: number | null
}[] = [
  { name: "Unallocated Savings", is_unallocated: true, target_amount: null },
  { name: "Graduation Fund", is_unallocated: false, target_amount: null },
  { name: "Emergency Fund", is_unallocated: false, target_amount: null },
  { name: "Certification Fund", is_unallocated: false, target_amount: null },
  { name: "Investments", is_unallocated: false, target_amount: null },
]

export async function ensureDefaultSavingsGoals(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string
) {
  const { count } = await supabase
    .from("savings_goals")
    .select("id", { count: "exact", head: true })

  if (count === 0) {
    await supabase
      .from("savings_goals")
      .insert(DEFAULT_SAVINGS_GOALS.map((g) => ({ ...g, user_id: userId })))
  }
}

export type SavingsGoal = {
  id: string
  name: string
  target_amount: number | null
  is_unallocated: boolean
  is_active: boolean
}

export type SavingsSplitGoal = { id: string; allocation_percentage: number | null }

/**
 * Splits a SAVINGS transaction across goals by their configured percentage.
 * Whatever a goal's share rounds down to, plus any percentage nobody
 * claimed, plus the leftover cent from rounding, all lands on the
 * Unallocated goal in one shot — so nothing is ever silently dropped.
 */
export function computeSavingsSplit(
  amount: number,
  goals: SavingsSplitGoal[],
  unallocatedGoalId: string
): { savings_goal_id: string; amount: number }[] {
  const result: { savings_goal_id: string; amount: number }[] = []
  let allocated = 0

  for (const g of goals) {
    const pct = g.allocation_percentage ?? 0
    if (pct <= 0) continue
    const share = Math.round(amount * (pct / 100) * 100) / 100
    if (share > 0) {
      result.push({ savings_goal_id: g.id, amount: share })
      allocated += share
    }
  }

  const remainder = Math.round((amount - allocated) * 100) / 100
  if (remainder > 0) {
    result.push({ savings_goal_id: unallocatedGoalId, amount: remainder })
  }

  return result
}

export type SavingsGoalBalance = {
  savings_goal_id: string
  name: string
  target_amount: number | null
  is_unallocated: boolean
  is_active: boolean
  saved_amount: number
}
