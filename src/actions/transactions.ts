"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { monthRange, lastDayOfMonth, aggregateByType } from "@/lib/transactions"
import { assertSufficientBalance, toAccountBalance } from "@/lib/accounts"
import { toActionResult, type ActionResult } from "@/lib/action-result"

export async function sweepMonth(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const month = String(formData.get("month") ?? "")
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month")

    const account_id = String(formData.get("account_id") ?? "")
    if (!account_id) throw new Error("Account is required")

    const target = String(formData.get("target") ?? "")
    if (!target) throw new Error("Choose where to sweep the leftover to")

    // Recompute server-side — never trust a client-submitted amount for a
    // money-moving action.
    const { start, end } = monthRange(month)
    const { data: monthTx } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", user.id)
      .gte("transaction_date", start)
      .lt("transaction_date", end)

    const { income, expense, savings } = aggregateByType(monthTx ?? [])
    const remaining = Math.round((income - expense - savings) * 100) / 100
    if (remaining <= 0) throw new Error("Nothing left to sweep for this month")

    let savings_goal_id = target
    if (target === "UNALLOCATED") {
      const { data: unallocated } = await supabase
        .from("savings_goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_unallocated", true)
        .single()
      if (!unallocated) throw new Error("No Unallocated Savings goal found")
      savings_goal_id = unallocated.id
    }

    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "SAVINGS",
        transaction_date: lastDayOfMonth(month),
        amount: remaining,
        account_id,
        description: "Monthly Sweep",
      })
      .select("id")
      .single()
    if (error) throw new Error(error.message)

    const { error: allocError } = await supabase.from("savings_allocations").insert({
      user_id: user.id,
      transaction_id: inserted.id,
      savings_goal_id,
      amount: remaining,
      allocation_type: "SWEEP",
    })
    if (allocError) throw new Error(allocError.message)

    revalidatePath("/", "layout")
    return `Swept ₱${remaining.toFixed(2)} into savings`
  })
}

/**
 * One-tap logging for small Coin Pouch expenses. Deliberately does not
 * touch the denomination ledger (that's the precise "handed over / change"
 * flow on the Transactions form) — these are loose-change amounts where
 * asking for an exact denomination breakdown would defeat the point of a
 * quick action. Any drift this causes between the Coin Pouch total and its
 * counted denominations is exactly what the spec's Physical Adjustment
 * flow (an ordinary EXPENSE transaction) exists to correct.
 */
export async function quickCoinsExpense(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const label = String(formData.get("label") ?? "").trim()
    const categoryName = String(formData.get("category_name") ?? "").trim()
    const amount = Number(formData.get("amount"))
    if (!label || !categoryName) throw new Error("Invalid quick entry")
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount")

    const [{ data: coinPouchRow }, { data: category }] = await Promise.all([
      supabase
        .from("account_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("account_type", "COIN_POUCH")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", categoryName)
        .eq("category_type", "EXPENSE")
        .limit(1)
        .maybeSingle(),
    ])
    if (!coinPouchRow) throw new Error("No active Coin Pouch account found")
    if (!category) throw new Error(`Category "${categoryName}" not found`)

    const coinPouch = toAccountBalance(coinPouchRow)
    assertSufficientBalance(coinPouch.balance, amount, coinPouch.name)

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "EXPENSE",
      transaction_date: new Date().toISOString().slice(0, 10),
      amount,
      account_id: coinPouch.account_id,
      category_id: category.id,
      expense_classification: "NEED",
      funding_source: "AVAILABLE_MONEY",
      description: label,
    })
    if (error) throw new Error(error.message)

    revalidatePath("/", "layout")
    return `Logged ${label}: ₱${amount.toFixed(2)}`
  })
}
