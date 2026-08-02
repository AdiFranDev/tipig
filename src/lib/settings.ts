export type Settings = {
  id: string
  needs_target_percentage: number
  wants_target_percentage: number
  savings_target_percentage: number
}

export async function ensureDefaultSettings(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string
): Promise<Settings> {
  const { data: existing } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) return existing as Settings

  const { data: created } = await supabase
    .from("settings")
    .insert({ user_id: userId })
    .select("*")
    .single()

  return created as Settings
}
