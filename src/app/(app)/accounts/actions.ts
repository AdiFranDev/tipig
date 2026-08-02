"use server"

import { createClient } from "@/lib/supabase/server"
import { ACCOUNT_TYPES, isPhysicalAccount, type AccountType } from "@/lib/accounts"
import { denominationsFor, denominationFieldName } from "@/lib/denominations"
import {
  PHYSICAL_ADJUSTMENT_LOSS_CATEGORY,
  PHYSICAL_ADJUSTMENT_GAIN_CATEGORY,
} from "@/lib/categories"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"

const VALID_TYPES = new Set(ACCOUNT_TYPES.map((t) => t.value))

function parseAccountType(value: FormDataEntryValue | null): AccountType {
  if (typeof value !== "string" || !VALID_TYPES.has(value as AccountType)) {
    throw new Error("Invalid account type")
  }
  return value as AccountType
}

function formString(value: FormDataEntryValue | null, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

export async function createAccount(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const name = formString(formData.get("name")).trim()
  if (!name) throw new Error("Name is required")
  const account_type = parseAccountType(formData.get("account_type"))
  const openingBalanceRaw = formString(formData.get("opening_balance"), "0")
  const opening_balance = Number(openingBalanceRaw)
  if (!Number.isFinite(opening_balance) || opening_balance < 0) {
    throw new Error("Invalid opening balance")
  }

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    account_type,
    opening_balance,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/accounts")
}

export async function updateAccount(accountId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const name = String(formData.get("name") ?? "").trim()
  if (!name) throw new Error("Name is required")
  const account_type = parseAccountType(formData.get("account_type"))
  const is_active = formData.get("is_active") === "on"

  // .eq("user_id", ...) is redundant with RLS but keeps the intent explicit
  // at the call site: this can only ever touch the caller's own row.
  const { error } = await supabase
    .from("accounts")
    .update({ name, account_type, is_active })
    .eq("id", accountId)
    .eq("user_id", user.id)
  if (error) throw new Error(error.message)

  revalidatePath("/accounts")
  redirect("/accounts")
}

export async function archiveAccount(accountId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase
    .from("accounts")
    .update({ is_active: false })
    .eq("id", accountId)
    .eq("user_id", user.id)
  if (error) throw new Error(error.message)

  revalidatePath("/accounts")
}

async function findOrCreateCategory(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  categoryType: "INCOME" | "EXPENSE"
): Promise<string> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .eq("category_type", categoryType)
    .maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name,
      category_type: categoryType,
      default_expense_classification: categoryType === "EXPENSE" ? "NEED" : null,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return created.id
}

/**
 * "Physical Adjustment/Loss": reconciles a physical account's denomination
 * ledger to match a real-world count. Per-denomination deltas become IN/OUT
 * ledger rows (so the counted truth replaces the old on-hand figures
 * exactly), and the net peso difference becomes one ordinary EXPENSE (a
 * loss) or INCOME (a gain) transaction — never a silent balance overwrite.
 */
export async function reconcilePhysicalCash(accountId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: account } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single()
  if (!account || !isPhysicalAccount(account.account_type)) {
    throw new Error("Not a physical cash account")
  }

  const denominations = denominationsFor(account.account_type)
  const { data: balances } = await supabase
    .from("denomination_balances")
    .select("denomination, on_hand")
    .eq("account_id", accountId)
  const onHand = new Map((balances ?? []).map((b) => [b.denomination, b.on_hand as number]))

  const deltas: { denomination: number; delta: number }[] = []
  for (const d of denominations) {
    const actual = Math.floor(Number(formData.get(denominationFieldName("actual", d)) ?? NaN))
    if (!Number.isFinite(actual) || actual < 0) {
      throw new Error(`Invalid counted quantity for ₱${d}`)
    }
    const expected = onHand.get(d) ?? 0
    const delta = actual - expected
    if (delta !== 0) deltas.push({ denomination: d, delta })
  }

  if (deltas.length === 0) {
    throw new Error("No difference from the recorded count — nothing to reconcile")
  }

  const netTotal = Math.round(deltas.reduce((sum, d) => sum + d.denomination * d.delta, 0) * 100) / 100
  if (netTotal === 0) {
    throw new Error(
      "The counted denominations differ but net to ₱0 — this shortcut doesn't handle same-value swaps"
    )
  }

  const isLoss = netTotal < 0
  const categoryId = await findOrCreateCategory(
    supabase,
    user.id,
    isLoss ? PHYSICAL_ADJUSTMENT_LOSS_CATEGORY : PHYSICAL_ADJUSTMENT_GAIN_CATEGORY,
    isLoss ? "EXPENSE" : "INCOME"
  )

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: isLoss ? "EXPENSE" : "INCOME",
      transaction_date: new Date().toISOString().slice(0, 10),
      amount: Math.abs(netTotal),
      account_id: accountId,
      category_id: categoryId,
      description: "Physical Adjustment",
      ...(isLoss ? { expense_classification: "NEED", funding_source: "AVAILABLE_MONEY" } : {}),
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  const { error: denomError } = await supabase.from("transaction_denominations").insert(
    deltas.map((d) => ({
      user_id: user.id,
      transaction_id: inserted.id,
      account_id: accountId,
      denomination: d.denomination,
      quantity: Math.abs(d.delta),
      direction: d.delta < 0 ? "OUT" : "IN",
    }))
  )
  if (denomError) throw new Error(denomError.message)

  revalidatePath("/", "layout")
  redirect("/accounts")
}
