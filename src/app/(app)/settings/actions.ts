"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { toActionResult, type ActionResult } from "@/lib/action-result"
import type { CategoryType, ExpenseClassification } from "@/lib/categories"

const CATEGORY_TYPES: readonly CategoryType[] = ["INCOME", "EXPENSE"]
const EXPENSE_CLASSIFICATIONS: readonly ExpenseClassification[] = ["NEED", "WANT"]

export async function updateBudgetRatios(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const needs = Number(formData.get("needs_target_percentage"))
    const wants = Number(formData.get("wants_target_percentage"))
    const savings = Number(formData.get("savings_target_percentage"))

    if (![needs, wants, savings].every((n) => Number.isFinite(n) && n >= 0)) {
      throw new Error("Percentages must be non-negative numbers")
    }
    const total = Math.round((needs + wants + savings) * 100) / 100
    if (total !== 100) {
      throw new Error(`Needs + Wants + Savings must total 100% (got ${total}%)`)
    }

    const { error } = await supabase
      .from("settings")
      .update({
        needs_target_percentage: needs,
        wants_target_percentage: wants,
        savings_target_percentage: savings,
      })
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)

    revalidatePath("/", "layout")
    return "Budget targets saved"
  })
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const name = String(formData.get("name") ?? "").trim()
    if (!name) throw new Error("Name is required")

    const category_type = String(formData.get("category_type") ?? "")
    if (!CATEGORY_TYPES.includes(category_type as CategoryType)) {
      throw new Error("Invalid category type")
    }

    const rawClassification = String(formData.get("default_expense_classification") ?? "")
    const default_expense_classification =
      category_type === "EXPENSE" && EXPENSE_CLASSIFICATIONS.includes(rawClassification as ExpenseClassification)
        ? rawClassification
        : null

    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name,
      category_type,
      default_expense_classification,
    })
    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return "Category added"
  })
}

export async function updateCategory(categoryId: string, formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const name = String(formData.get("name") ?? "").trim()
    if (!name) throw new Error("Name is required")

    const category_type = String(formData.get("category_type") ?? "")
    if (!CATEGORY_TYPES.includes(category_type as CategoryType)) {
      throw new Error("Invalid category type")
    }

    const rawClassification = String(formData.get("default_expense_classification") ?? "")
    const default_expense_classification =
      category_type === "EXPENSE" && EXPENSE_CLASSIFICATIONS.includes(rawClassification as ExpenseClassification)
        ? rawClassification
        : null

    const is_active = formData.get("is_active") === "on"

    const { error } = await supabase
      .from("categories")
      .update({ name, category_type, default_expense_classification, is_active })
      .eq("id", categoryId)
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    redirect("/settings")
  })
}

export async function archiveCategory(categoryId: string): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", categoryId)
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return "Category archived"
  })
}

export async function restoreCategory(categoryId: string): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
      .from("categories")
      .update({ is_active: true })
      .eq("id", categoryId)
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return "Category restored"
  })
}

export async function createScholarshipAllocation(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const name = String(formData.get("name") ?? "").trim()
    if (!name) throw new Error("Name is required")

    const total_amount = Number(formData.get("total_amount"))
    if (!Number.isFinite(total_amount) || total_amount <= 0) throw new Error("Invalid total amount")

    const startingMonthRaw = String(formData.get("starting_month") ?? "")
    if (!/^\d{4}-\d{2}$/.test(startingMonthRaw)) throw new Error("Invalid starting month")
    const starting_month = `${startingMonthRaw}-01`

    const covered_months = Math.floor(Number(formData.get("covered_months")))
    if (!Number.isFinite(covered_months) || covered_months <= 0) {
      throw new Error("Invalid number of covered months")
    }

    const { error } = await supabase.from("scholarship_allocations").insert({
      user_id: user.id,
      name,
      total_amount,
      starting_month,
      covered_months,
    })
    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return "Allocation added"
  })
}

export async function deleteScholarshipAllocation(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
      .from("scholarship_allocations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)

    revalidatePath("/settings")
    return "Allocation deleted"
  })
}
