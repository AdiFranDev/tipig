import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateSavingsGoal } from "../../actions"
import { ActionForm } from "@/components/action-form"

export default async function EditSavingsGoalPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  const supabase = await createClient()

  const { data: goal } = await supabase
    .from("savings_goals")
    .select("id, name, target_amount, is_unallocated, is_active")
    .eq("id", id)
    .single()

  if (!goal) notFound()

  const updateWithId = updateSavingsGoal.bind(null, goal.id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Edit Savings Goal</h1>

      <Card>
        <CardHeader>
          <CardTitle>{goal.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateWithId} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={goal.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_amount">Target Amount (optional)</Label>
              <Input
                id="target_amount"
                name="target_amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={goal.target_amount ?? ""}
              />
            </div>
            {!goal.is_unallocated && (
              <div className="flex items-center gap-2">
                <Switch id="is_active" name="is_active" defaultChecked={goal.is_active} />
                <Label htmlFor="is_active">Active (uncheck to archive)</Label>
              </div>
            )}
            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  )
}
