import type { Database } from "@/types/supabase"

export type Settings = Pick<
  Database["public"]["Tables"]["settings"]["Row"],
  "id" | "needs_target_percentage" | "wants_target_percentage" | "savings_target_percentage"
>

export async function ensureDefaultSettings(
  supabase: import("@supabase/supabase-js").SupabaseClient<Database>,
  userId: string
): Promise<Settings> {
  const { data: existing } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) return existing

  const { data: created, error } = await supabase
    .from("settings")
    .insert({ user_id: userId })
    .select("*")
    .single()
  if (error || !created) throw new Error(error?.message ?? "Failed to create default settings")

  return created
}
