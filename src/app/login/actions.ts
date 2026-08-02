"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export async function sendMagicLink(formData: FormData) {
  const allowedEmail = process.env.ALLOWED_EMAIL
  if (!allowedEmail) throw new Error("ALLOWED_EMAIL is not configured")

  const submittedEmail = String(formData.get("email") ?? "").trim().toLowerCase()
  if (submittedEmail !== allowedEmail.trim().toLowerCase()) {
    redirect("/login?error=unauthorized")
  }
  const email = allowedEmail

  const headerList = await headers()
  const host = headerList.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${protocol}://${host}/auth/callback`,
    },
  })

  if (error) {
    redirect("/login?error=send-failed")
  }

  redirect("/login?sent=1")
}
