import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/admin"
import { aggregateByType, last7Days } from "@/lib/transactions"
import { sendWeeklyDigestEmail } from "@/actions/email-actions"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient()
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const user = usersPage.users.find((u) => u.email === process.env.ALLOWED_EMAIL)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 500 })

  const { start, end } = last7Days()
  const { data: weekTx, error: txError } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("user_id", user.id)
    .gte("transaction_date", start)
    .lt("transaction_date", end)
  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

  const { income, expense, netCashFlow } = aggregateByType(weekTx ?? [])

  const result = await sendWeeklyDigestEmail({
    totalIncome: income,
    totalExpenses: expense,
    netCashFlow,
  })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ success: true })
}
