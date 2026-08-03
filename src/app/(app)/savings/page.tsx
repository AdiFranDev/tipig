import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultSavingsGoals, type SavingsGoalBalance } from "@/lib/savings"
import { formatPHP } from "@/lib/format"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { createSavingsGoal, archiveSavingsGoal } from "./actions"
import { Pencil, Trash2 } from "lucide-react"

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

  const goals = (data ?? []) as SavingsGoalBalance[]
  const activeGoals = goals.filter((g) => g.is_active)
  const unallocated = activeGoals.find((g) => g.is_unallocated)
  const namedGoals = activeGoals.filter((g) => !g.is_unallocated)
  const archivedGoals = goals.filter((g) => !g.is_active)

  const { data: percentData } = await supabase
    .from("savings_goals")
    .select("allocation_percentage")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_unallocated", false)
  const allocatedPercent = (percentData ?? []).reduce(
    (sum, g) => sum + (g.allocation_percentage ?? 0),
    0
  )

  const totalSaved = activeGoals.reduce((sum, g) => sum + g.saved_amount, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-8 w-full">
      <h1 className="text-2xl font-semibold text-foreground">Savings Goals</h1>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Saved Money</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatPHP(totalSaved)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {allocatedPercent}% of each new SAVINGS transaction is split across your goals below;
            the remaining {Math.max(0, 100 - allocatedPercent)}% goes to Unallocated Savings.
          </p>
        </CardContent>
      </Card>

      {unallocated && <GoalCard goal={unallocated} />}

      {namedGoals.map((g) => (
        <GoalCard key={g.savings_goal_id} goal={g} />
      ))}

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
          <form action={createSavingsGoal} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Travel Fund" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_amount">Target Amount (optional)</Label>
              <Input id="target_amount" name="target_amount" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="allocation_percentage">Allocation % of each SAVINGS entry</Label>
              <Input
                id="allocation_percentage"
                name="allocation_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue="0"
              />
            </div>
            <Button type="submit" className="w-full">
              Add Goal
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function GoalCard({ goal }: Readonly<{ goal: SavingsGoalBalance }>) {
  const percent = goal.target_amount
    ? Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100))
    : null
  const archiveWithId = archiveSavingsGoal.bind(null, goal.savings_goal_id)

  return (
    <Card className="group w-full">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/savings/${goal.savings_goal_id}/edit`}
            className="min-w-0 flex-1 flex items-center justify-between gap-3 hover:opacity-80"
          >
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              {goal.name}
              {goal.is_unallocated && <Badge variant="outline">Auto</Badge>}
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
              <form action={archiveWithId}>
                <Button variant="ghost" size="icon-sm" type="submit" aria-label="Archive savings goal">
                  <Trash2 />
                </Button>
              </form>
            )}
          </div>
        </div>
        {percent !== null && (
          <div className="flex items-center gap-2">
            <Progress value={percent} className="flex-1" />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {percent}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
