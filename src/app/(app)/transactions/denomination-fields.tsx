"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPHP } from "@/lib/format"
import { denominationFieldName } from "@/lib/denominations"

function useQuantities(denominations: readonly number[]) {
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const total = denominations.reduce((sum, d) => sum + (quantities[d] ?? 0) * d, 0)
  return { quantities, setQuantities, total }
}

function DenominationGrid({
  legend,
  prefix,
  denominations,
  quantities,
  onChange,
}: Readonly<{
  legend: string
  prefix: string
  denominations: readonly number[]
  quantities: Record<number, number>
  onChange: (denomination: number, qty: number) => void
}>) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {denominations.map((d) => (
          <div key={d} className="space-y-1">
            <Label htmlFor={denominationFieldName(prefix, d)} className="text-xs">
              ₱{d}
            </Label>
            <Input
              id={denominationFieldName(prefix, d)}
              name={denominationFieldName(prefix, d)}
              type="number"
              min="0"
              step="1"
              defaultValue={0}
              onChange={(e) => onChange(d, Number(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Total: {formatPHP(denominations.reduce((sum, d) => sum + (quantities[d] ?? 0) * d, 0))}
      </p>
    </fieldset>
  )
}

/** "Direct Payments & Change" — Handed Over minus the expense must equal Change. */
export function ExpenseDenominationFields({
  denominations,
  amount,
}: Readonly<{ denominations: readonly number[]; amount: number }>) {
  const handedOver = useQuantities(denominations)
  const change = useQuantities(denominations)
  const expected = Math.round((handedOver.total - amount) * 100) / 100
  const matches = Math.abs(expected - change.total) < 0.001

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">Physical Cash Breakdown</p>
      <DenominationGrid
        legend="Handed Over"
        prefix="handed"
        denominations={denominations}
        quantities={handedOver.quantities}
        onChange={(d, qty) => handedOver.setQuantities((q) => ({ ...q, [d]: qty }))}
      />
      <DenominationGrid
        legend="Change Received"
        prefix="change"
        denominations={denominations}
        quantities={change.quantities}
        onChange={(d, qty) => change.setQuantities((q) => ({ ...q, [d]: qty }))}
      />
      <p className={`text-xs ${matches ? "text-muted-foreground" : "text-destructive"}`}>
        {matches
          ? "Handed over − expense = change. ✓"
          : `Handed over (${formatPHP(handedOver.total)}) − expense (${formatPHP(amount)}) should equal change — expected ${formatPHP(expected)}, got ${formatPHP(change.total)}.`}
      </p>
    </div>
  )
}

/** "Breaking Bills" — money out of one physical account, in as different denominations to another. */
export function BreakingBillsFields({
  sourceDenominations,
  destDenominations,
  amount,
}: Readonly<{
  sourceDenominations: readonly number[]
  destDenominations: readonly number[]
  amount: number
}>) {
  const out = useQuantities(sourceDenominations)
  const inn = useQuantities(destDenominations)
  const matches = Math.abs(out.total - amount) < 0.001 && Math.abs(inn.total - amount) < 0.001

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">Breaking Bills Breakdown</p>
      <DenominationGrid
        legend="Take Out (from source)"
        prefix="out"
        denominations={sourceDenominations}
        quantities={out.quantities}
        onChange={(d, qty) => out.setQuantities((q) => ({ ...q, [d]: qty }))}
      />
      <DenominationGrid
        legend="Put In (to destination)"
        prefix="in"
        denominations={destDenominations}
        quantities={inn.quantities}
        onChange={(d, qty) => inn.setQuantities((q) => ({ ...q, [d]: qty }))}
      />
      <p className={`text-xs ${matches ? "text-muted-foreground" : "text-destructive"}`}>
        {matches
          ? "Both sides match the transfer amount. ✓"
          : `Both sides must total the transfer amount (${formatPHP(amount)}).`}
      </p>
    </div>
  )
}
