import type { AccountType } from "@/lib/accounts"
import type { Database } from "@/types/supabase"

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

/** `denomination_balances` is a view; see the comment on `toAccountBalance` for why this exists. */
export function toDenominationBalance(
  row: Pick<
    Database["public"]["Views"]["denomination_balances"]["Row"],
    "account_id" | "denomination" | "on_hand"
  >
): DenominationBalance {
  return {
    account_id: row.account_id!,
    denomination: row.denomination!,
    on_hand: row.on_hand!,
  }
}
