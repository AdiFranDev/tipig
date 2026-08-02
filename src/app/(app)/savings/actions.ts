"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function assertPercentageBudget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  newPercentage: number,
  excludeGoalId?: string
) {
  let query = supabase
    .from("savings_goals")
    .select("allocation_percentage")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_unallocated", false)

  if (excludeGoalId) query = query.neq("id", excludeGoalId)

  const { data } = await query
  const existingTotal = (data ?? []).reduce((sum, g) => sum + (g.allocation_percentage ?? 0), 0)
  const total = Math.round((existingTotal + newPercentage) * 100) / 100

  if (total > 100) {
    throw new Error(
      `Allocation percentages can't exceed 100% across all goals (would be ${total}%)`
    )
  }
}

export async function createSavingsGoal(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const name = String(formData.get("name") ?? "").trim()
  if (!name) throw new Error("Name is required")

  const targetRaw = String(formData.get("target_amount") ?? "").trim()
  const target_amount = targetRaw ? Number(targetRaw) : null
  if (target_amount !== null && (!Number.isFinite(target_amount) || target_amount < 0)) {
    throw new Error("Invalid target amount")
  }

  const allocation_percentage = Number(formData.get("allocation_percentage") ?? 0)
  if (!Number.isFinite(allocation_percentage) || allocation_percentage < 0 || allocation_percentage > 100) {
    throw new Error("Invalid allocation percentage")
  }
  await assertPercentageBudget(supabase, user.id, allocation_percentage)

  const { error } = await supabase.from("savings_goals").insert({
    user_id: user.id,
    name,
    target_amount,
    allocation_percentage,
    is_unallocated: false,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/savings")
}

export async function updateSavingsGoal(goalId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: goal } = await supabase
    .from("savings_goals")
    .select("is_unallocated")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single()
  if (!goal) throw new Error("Savings goal not found")

  const name = String(formData.get("name") ?? "").trim()
  if (!name) throw new Error("Name is required")

  const targetRaw = String(formData.get("target_amount") ?? "").trim()
  const target_amount = targetRaw ? Number(targetRaw) : null
  if (target_amount !== null && (!Number.isFinite(target_amount) || target_amount < 0)) {
    throw new Error("Invalid target amount")
  }

  // The Unallocated goal has no is_active control in the UI (it must always
  // stay active as the remainder catch-all), so don't read it from the form.
  const is_active = goal.is_unallocated ? true : formData.get("is_active") === "on"

  // The Unallocated goal is the remainder catch-all — its own percentage
  // isn't user-configurable, so skip both the field and the budget check.
  let allocation_percentage: number | null = null
  if (!goal.is_unallocated) {
    allocation_percentage = Number(formData.get("allocation_percentage") ?? 0)
    if (
      !Number.isFinite(allocation_percentage) ||
      allocation_percentage < 0 ||
      allocation_percentage > 100
    ) {
      throw new Error("Invalid allocation percentage")
    }
    await assertPercentageBudget(supabase, user.id, allocation_percentage, goalId)
  }

  const patch: Record<string, unknown> = { name, target_amount, is_active }
  if (!goal.is_unallocated) patch.allocation_percentage = allocation_percentage

  const { error } = await supabase
    .from("savings_goals")
    .update(patch)
    .eq("id", goalId)
    .eq("user_id", user.id)
  if (error) throw new Error(error.message)

  revalidatePath("/", "layout")
  redirect("/savings")
}

export async function archiveSavingsGoal(goalId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: goal } = await supabase
    .from("savings_goals")
    .select("is_unallocated")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single()
  if (!goal) throw new Error("Savings goal not found")
  if (goal.is_unallocated) throw new Error("Unallocated Savings can't be archived")

  const { error } = await supabase
    .from("savings_goals")
    .update({ is_active: false })
    .eq("id", goalId)
    .eq("user_id", user.id)
  if (error) throw new Error(error.message)

  revalidatePath("/", "layout")
}
