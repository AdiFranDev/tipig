"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPHP } from "@/lib/format"
import { denominationFieldName } from "@/lib/denominations"

function useQuantities(denominations: readonly number[], initial?: Record<number, number>) {
  const [quantities, setQuantities] = useState<Record<number, number>>(() => initial ?? {})
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
  // Captured once on mount — `defaultValue` must never change after an
  // uncontrolled input is initialized, unlike `quantities` (which updates
  // live on every keystroke, driving the Total text below).
  const [initialQuantities] = useState(quantities)

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
              defaultValue={initialQuantities[d] ?? 0}
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

/**
 * "Direct Payments & Change" — Handed Over minus the expense must equal
 * Change. Change can come back in the *other* physical account's
 * denominations too (e.g. coins as change for a Paper Cash payment) — those
 * rows post to that other account, not this one, so a second grid only
 * renders when the user has an active complementary physical account.
 */
export function ExpenseDenominationFields({
  denominations,
  amount,
  initialHandedOver,
  initialChange,
  otherDenominations,
  otherAccountLabel,
  initialChangeOther,
  onValidityChange,
}: Readonly<{
  denominations: readonly number[]
  amount: number
  initialHandedOver?: Record<number, number>
  initialChange?: Record<number, number>
  otherDenominations?: readonly number[]
  otherAccountLabel?: string
  initialChangeOther?: Record<number, number>
  onValidityChange?: (valid: boolean) => void
}>) {
  const handedOver = useQuantities(denominations, initialHandedOver)
  const changeOwn = useQuantities(denominations, initialChange)
  const changeOther = useQuantities(otherDenominations ?? [], initialChangeOther)
  const changeTotal = Math.round((changeOwn.total + changeOther.total) * 100) / 100
  const expected = Math.round((handedOver.total - amount) * 100) / 100
  const insufficient = handedOver.total < amount
  const changeMatches = Math.abs(expected - changeTotal) < 0.001
  const valid = !insufficient && changeMatches

  useEffect(() => {
    onValidityChange?.(valid)
  }, [valid, onValidityChange])

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
        quantities={changeOwn.quantities}
        onChange={(d, qty) => changeOwn.setQuantities((q) => ({ ...q, [d]: qty }))}
      />
      {otherDenominations && otherDenominations.length > 0 && (
        <DenominationGrid
          legend={`Change Received (${otherAccountLabel ?? "other"})`}
          prefix="change_other"
          denominations={otherDenominations}
          quantities={changeOther.quantities}
          onChange={(d, qty) => changeOther.setQuantities((q) => ({ ...q, [d]: qty }))}
        />
      )}
      {insufficient ? (
        <p className="text-xs text-destructive">
          Handed over ({formatPHP(handedOver.total)}) is less than the expense ({formatPHP(amount)}) —
          hand over enough to cover it.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Change Due: {formatPHP(expected)}</p>
          {changeMatches ? (
            <p className="text-xs text-muted-foreground">✓ Handed over − expense = change.</p>
          ) : (
            <p className="text-xs text-destructive">
              Change received doesn&apos;t match — expected {formatPHP(expected)}, got{" "}
              {formatPHP(changeTotal)}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Physical INCOME — the denomination breakdown of exactly what was
 * received. Money received can span both physical accounts too (e.g. a
 * ₱1000 bill plus a ₱20 coin as one allowance) — those "other account" rows
 * post there, not to the receiving account, mirroring how EXPENSE change
 * can cross into a complementary account above.
 */
export function IncomeDenominationFields({
  denominations,
  amount,
  initialReceived,
  otherDenominations,
  otherAccountLabel,
  initialReceivedOther,
  onValidityChange,
}: Readonly<{
  denominations: readonly number[]
  amount: number
  initialReceived?: Record<number, number>
  otherDenominations?: readonly number[]
  otherAccountLabel?: string
  initialReceivedOther?: Record<number, number>
  onValidityChange?: (valid: boolean) => void
}>) {
  const receivedOwn = useQuantities(denominations, initialReceived)
  const receivedOther = useQuantities(otherDenominations ?? [], initialReceivedOther)
  const receivedTotal = Math.round((receivedOwn.total + receivedOther.total) * 100) / 100
  const valid = Math.abs(receivedTotal - amount) < 0.001

  useEffect(() => {
    onValidityChange?.(valid)
  }, [valid, onValidityChange])

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">Physical Cash Received</p>
      <DenominationGrid
        legend="Received"
        prefix="received"
        denominations={denominations}
        quantities={receivedOwn.quantities}
        onChange={(d, qty) => receivedOwn.setQuantities((q) => ({ ...q, [d]: qty }))}
      />
      {otherDenominations && otherDenominations.length > 0 && (
        <DenominationGrid
          legend={`Received (${otherAccountLabel ?? "other"})`}
          prefix="received_other"
          denominations={otherDenominations}
          quantities={receivedOther.quantities}
          onChange={(d, qty) => receivedOther.setQuantities((q) => ({ ...q, [d]: qty }))}
        />
      )}
      {valid ? (
        <p className="text-xs text-muted-foreground">✓ Matches the income amount.</p>
      ) : (
        <p className="text-xs text-destructive">
          Doesn&apos;t match the income amount ({formatPHP(amount)}) — got {formatPHP(receivedTotal)}.
        </p>
      )}
    </div>
  )
}

/** "Breaking Bills" — money out of one physical account, in as different denominations to another. */
export function BreakingBillsFields({
  sourceDenominations,
  destDenominations,
  amount,
  initialOut,
  initialIn,
  onValidityChange,
}: Readonly<{
  sourceDenominations: readonly number[]
  destDenominations: readonly number[]
  amount: number
  initialOut?: Record<number, number>
  initialIn?: Record<number, number>
  onValidityChange?: (valid: boolean) => void
}>) {
  const out = useQuantities(sourceDenominations, initialOut)
  const inn = useQuantities(destDenominations, initialIn)
  const outMatches = Math.abs(out.total - amount) < 0.001
  const inMatches = Math.abs(inn.total - amount) < 0.001
  const valid = outMatches && inMatches

  useEffect(() => {
    onValidityChange?.(valid)
  }, [valid, onValidityChange])

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
      {valid ? (
        <p className="text-xs text-muted-foreground">✓ Both sides match the transfer amount.</p>
      ) : (
        <>
          {!outMatches && (
            <p className="text-xs text-destructive">
              Take Out doesn&apos;t match the transfer amount ({formatPHP(amount)}) — got{" "}
              {formatPHP(out.total)}.
            </p>
          )}
          {!inMatches && (
            <p className="text-xs text-destructive">
              Put In doesn&apos;t match the transfer amount ({formatPHP(amount)}) — got{" "}
              {formatPHP(inn.total)}.
            </p>
          )}
        </>
      )}
    </div>
  )
}
