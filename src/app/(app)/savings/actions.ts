"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { toActionResult, type ActionResult } from "@/lib/action-result"

export async function createSavingsGoal(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
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

    const { error } = await supabase.from("savings_goals").insert({
      user_id: user.id,
      name,
      target_amount,
      is_unallocated: false,
    })
    if (error) throw new Error(error.message)

    revalidatePath("/savings")
    return "Savings goal added"
  })
}

export async function updateSavingsGoal(goalId: string, formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
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

    const patch: Record<string, unknown> = { name, target_amount, is_active }

    const { error } = await supabase
      .from("savings_goals")
      .update(patch)
      .eq("id", goalId)
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)

    revalidatePath("/", "layout")
    redirect("/savings")
  })
}

export async function archiveSavingsGoal(goalId: string): Promise<ActionResult> {
  return toActionResult(async () => {
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
    return "Savings goal archived"
  })
}
