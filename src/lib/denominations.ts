import type { AccountType } from "@/lib/accounts"

export const PAPER_CASH_DENOMINATIONS = [1000, 500, 200, 100, 50, 20] as const
export const COIN_POUCH_DENOMINATIONS = [20, 10, 5, 1, 0.25] as const

export function denominationsFor(type: AccountType): readonly number[] {
  if (type === "PAPER_CASH") return PAPER_CASH_DENOMINATIONS
  if (type === "COIN_POUCH") return COIN_POUCH_DENOMINATIONS
  return []
}

export function denominationFieldName(prefix: string, denomination: number): string {
  return `${prefix}_${String(denomination).replace(".", "_")}`
}

export type DenominationBalance = {
  account_id: string
  denomination: number
  on_hand: number
}
