import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultSavingsGoals, toSavingsGoalBalance, type SavingsGoalBalance } from "@/lib/savings"
import { formatPHP } from "@/lib/format"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createSavingsGoal, archiveSavingsGoal } from "./actions"
import { Pencil, Trash2, GraduationCap, Shield, TrendingUp, Target } from "lucide-react"
import { ActionForm } from "@/components/action-form"

export default async function SavingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  await ensureDefaultSavingsGoals(supabase, user.id)

  const { data } = await supabase
    .from("savings_goal_balances")
    .select("*")
    .order("is_unallocated", { ascending: false })
    .order("name")

  const goals = (data ?? []).map(toSavingsGoalBalance)
  const activeGoals = goals.filter((g) => g.is_active)
  const unallocated = activeGoals.find((g) => g.is_unallocated)
  const namedGoals = activeGoals.filter((g) => !g.is_unallocated)
  const archivedGoals = goals.filter((g) => !g.is_active)

  const totalSaved = activeGoals.reduce((sum, g) => sum + g.saved_amount, 0)
  const splitCount = namedGoals.length

  return (
    <div className="space-y-8 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Savings Goals</h1>
        <p className="text-sm text-muted-foreground">Purpose, never location: spending a goal reduces both</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-transparent p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Saved Money</p>
          <p className="text-4xl font-light tabular-nums text-foreground">{formatPHP(totalSaved)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {splitCount > 0
              ? `Each new SAVINGS transaction splits evenly across your ${splitCount} active goal${splitCount === 1 ? "" : "s"}: any rounding remainder lands in Unallocated Savings.`
              : "Each new SAVINGS transaction goes entirely to Unallocated Savings until you add a goal below."}
          </p>
        </div>

        {unallocated && (
          <div className="rounded-xl border border-zinc-800 bg-transparent p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                Unallocated Savings
                <span className="text-[10px] bg-zinc-800 text-muted-foreground px-2 py-0.5 rounded">Auto</span>
              </span>
              <span className="text-4xl font-light tabular-nums text-foreground">
                {formatPHP(unallocated.saved_amount)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              The catch-all: monthly sweeps, interest, and split remainders arrive here until you assign them a purpose.
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              Assign to a goal
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {namedGoals.map((g) => (
          <GoalCard key={g.savings_goal_id} goal={g} />
        ))}
      </div>

      {archivedGoals.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Archived
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {archivedGoals.map((g) => (
              <Link
                key={g.savings_goal_id}
                href={`/savings/${g.savings_goal_id}/edit`}
                className="flex items-center justify-between px-(--card-spacing) py-3 hover:bg-muted/50"
              >
                <span className="text-sm text-foreground">{g.name}</span>
                <Badge variant="secondary">Archived</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Add Savings Goal</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createSavingsGoal} successMessage="Savings goal added" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Travel Fund" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_amount">Target Amount (optional)</Label>
              <Input id="target_amount" name="target_amount" type="number" step="0.01" min="0" />
            </div>
            <Button type="submit" className="w-full">
              Add Goal
            </Button>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  )
}

function goalIcon(name: string) {
  const className = "text-muted-foreground"
  if (name.includes("Graduation")) return <GraduationCap size={16} className={className} />
  if (name.includes("Emergency")) return <Shield size={16} className={className} />
  if (name.includes("Investments")) return <TrendingUp size={16} className={className} />
  return <Target size={16} className={className} />
}

function GoalCard({ goal }: Readonly<{ goal: SavingsGoalBalance }>) {
  const percent = goal.target_amount
    ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100))
    : null
  const archiveWithId = archiveSavingsGoal.bind(null, goal.savings_goal_id)

  return (
    <div className="group rounded-xl border border-zinc-800 bg-transparent p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/savings/${goal.savings_goal_id}/edit`}
          className="min-w-0 flex-1 flex items-center justify-between gap-3 hover:opacity-80"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {goalIcon(goal.name)}
            {goal.name}
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatPHP(goal.saved_amount)}
            {goal.target_amount != null && (
              <span className="text-muted-foreground font-normal"> / {formatPHP(goal.target_amount)}</span>
            )}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/savings/${goal.savings_goal_id}/edit`} />}
            aria-label="Edit savings goal"
          >
            <Pencil />
          </Button>
          {!goal.is_unallocated && (
            <ActionForm action={archiveWithId} successMessage="Savings goal archived">
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Archive savings goal">
                <Trash2 />
              </Button>
            </ActionForm>
          )}
        </div>
      </div>
      {percent !== null && (
        <>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-3">
            <div className="bg-emerald-500 rounded-full h-full" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-2">{percent}%</p>
        </>
      )}
    </div>
  )
}
