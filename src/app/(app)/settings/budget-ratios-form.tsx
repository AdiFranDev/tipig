"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActionToast } from "@/hooks/use-action-toast"
import { updateBudgetRatios } from "./actions"

export function BudgetRatiosForm({
  needs: initialNeeds,
  wants: initialWants,
  savings: initialSavings,
}: Readonly<{ needs: number; wants: number; savings: number }>) {
  const [needs, setNeeds] = useState(initialNeeds)
  const [wants, setWants] = useState(initialWants)
  const [savings, setSavings] = useState(initialSavings)
  const [formAction] = useActionToast(updateBudgetRatios, "Budget targets saved")

  const total = Math.round((needs + wants + savings) * 100) / 100
  const isValid = total === 100

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="needs_target_percentage">Needs %</Label>
          <Input
            id="needs_target_percentage"
            name="needs_target_percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
            value={needs}
            onChange={(e) => setNeeds(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wants_target_percentage">Wants %</Label>
          <Input
            id="wants_target_percentage"
            name="wants_target_percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
            value={wants}
            onChange={(e) => setWants(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="savings_target_percentage">Savings %</Label>
          <Input
            id="savings_target_percentage"
            name="savings_target_percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
            value={savings}
            onChange={(e) => setSavings(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {isValid ? (
            <>
              <div style={{ width: `${needs}%` }} className="h-full bg-[var(--chart-2)]" />
              <div style={{ width: `${wants}%` }} className="h-full bg-[var(--chart-3)]" />
              <div style={{ width: `${savings}%` }} className="h-full bg-[var(--chart-4)]" />
            </>
          ) : (
            <div
              style={{ width: `${Math.min(total, 100)}%` }}
              className="h-full bg-destructive transition-all"
            />
          )}
        </div>
        <p className={`text-xs ${isValid ? "text-muted-foreground" : "text-destructive"}`}>
          {isValid
            ? "Needs + Wants + Savings = 100%"
            : `Total is ${total}%: must equal exactly 100% to save`}
        </p>
      </div>

      <Button type="submit" disabled={!isValid}>
        Save Targets
      </Button>
    </form>
  )
}
