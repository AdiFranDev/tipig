"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { toActionResult, type ActionResult } from "@/lib/action-result"

export async function login(formData: FormData): Promise<ActionResult> {
  return toActionResult(async () => {
    const allowedEmail = process.env.ALLOWED_EMAIL
    const secretKey = process.env.SECRET_KEY
    if (!allowedEmail || !secretKey) throw new Error("Auth is not configured")

    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    const password = String(formData.get("secretKey") ?? "")

    if (email !== allowedEmail.trim().toLowerCase() || password !== secretKey) {
      redirect("/login?error=invalid")
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: allowedEmail, password })

    if (error) {
      redirect("/login?error=invalid")
    }

    redirect("/")
  })
}
