"use server"

import { createElement } from "react"
import { getResendClient } from "@/lib/resend"
import { WeeklyDigestEmail } from "@/emails/weekly-digest"
import { OverdraftWarningEmail } from "@/emails/overdraft-warning"
import { DailyCheckinEmail } from "@/emails/daily-checkin"
import { toActionResult, type ActionResult } from "@/lib/action-result"

type WeeklyDigestData = {
  totalIncome: number
  totalExpenses: number
  netCashFlow: number
}

type OverdraftWarningData = {
  attemptedExpense: number
  category: string
  shortfall: number
}

export async function sendWeeklyDigestEmail(data: WeeklyDigestData): Promise<ActionResult> {
  return toActionResult(async () => {
    const { error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.ALLOWED_EMAIL!,
      subject: "Your Weekly Financial Digest",
      react: createElement(WeeklyDigestEmail, data),
    })
    if (error) throw new Error(error.message)
    return "Weekly digest sent"
  })
}

export async function sendOverdraftWarningEmail(data: OverdraftWarningData): Promise<ActionResult> {
  return toActionResult(async () => {
    const { error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.ALLOWED_EMAIL!,
      subject: `Overdraft Warning: ${data.category} expense exceeds available funds`,
      headers: { "X-Priority": "1", Importance: "high" },
      react: createElement(OverdraftWarningEmail, data),
    })
    if (error) throw new Error(error.message)
    return "Overdraft warning sent"
  })
}

type DailyCheckinData = {
  todayIncome: number
  todayExpense: number
}

export async function sendDailyCheckinEmail(data: DailyCheckinData): Promise<ActionResult> {
  return toActionResult(async () => {
    const { error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.ALLOWED_EMAIL!,
      subject: "Daily Tipig Check-in",
      react: createElement(DailyCheckinEmail, data),
    })
    if (error) throw new Error(error.message)
    return "Daily check-in sent"
  })
}
