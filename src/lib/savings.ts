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

/**
 * Splits a SAVINGS transaction evenly across active goals. Each goal's
 * share is floored to the nearest centavo (never rounded up), so the
 * leftover — including any remainder from an uneven division — always
 * lands on the Unallocated goal and the math balances exactly.
 */
export function computeSavingsSplit(
  amount: number,
  activeGoalIds: string[],
  unallocatedGoalId: string
): { savings_goal_id: string; amount: number }[] {
  if (activeGoalIds.length === 0) {
    return [{ savings_goal_id: unallocatedGoalId, amount }]
  }

  const share = Math.floor((amount / activeGoalIds.length) * 100) / 100
  const result = activeGoalIds.map((id) => ({ savings_goal_id: id, amount: share }))

  const remainder = Math.round((amount - share * activeGoalIds.length) * 100) / 100
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
