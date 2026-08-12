"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { currentMonth } from "@/lib/transactions"

const MONTH_SCOPED_PATHS = ["/", "/transactions", "/analytics"]

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function adjacentMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number)
  return currentMonth(new Date(year, mon - 1 + delta, 1))
}

/**
 * Lives in the shell header now instead of per-page, so it must round-trip
 * every other search param a page cares about (account/limit/q/type/bucket/
 * category on Transactions) — only `month` gets rewritten.
 */
export function MonthStepper() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (!MONTH_SCOPED_PATHS.includes(pathname)) return null

  const month = searchParams.get("month") ?? currentMonth()

  function hrefFor(delta: number) {
    const params = new URLSearchParams(searchParams)
    params.set("month", adjacentMonth(month, delta))
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={hrefFor(-1)} />}>
        ‹
      </Button>
      <span className="w-32 text-center text-sm font-medium text-foreground">{monthLabel(month)}</span>
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={hrefFor(1)} />}>
        ›
      </Button>
    </div>
  )
}
