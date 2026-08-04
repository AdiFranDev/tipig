import { Landmark, Building2, Wallet, Banknote, Coins } from "lucide-react"

export const ACCOUNT_TYPES = [
  { value: "DIGITAL_BANK", label: "Digital Bank", group: "digital" },
  { value: "TRADITIONAL_BANK", label: "Traditional Bank", group: "digital" },
  { value: "E_WALLET", label: "E-Wallet", group: "digital" },
  { value: "PAPER_CASH", label: "Paper Cash", group: "physical" },
  { value: "COIN_POUCH", label: "Coin Pouch", group: "physical" },
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"]

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}

export function isPhysicalAccount(type: AccountType): boolean {
  return type === "PAPER_CASH" || type === "COIN_POUCH"
}

export const ACCOUNT_ICONS: Record<AccountType, typeof Landmark> = {
  DIGITAL_BANK: Landmark,
  TRADITIONAL_BANK: Building2,
  E_WALLET: Wallet,
  PAPER_CASH: Banknote,
  COIN_POUCH: Coins,
}

export const DEFAULT_ACCOUNTS: { name: string; account_type: AccountType }[] = [
  { name: "MariBank", account_type: "DIGITAL_BANK" },
  { name: "GoTyme", account_type: "DIGITAL_BANK" },
  { name: "LandBank", account_type: "TRADITIONAL_BANK" },
  { name: "Maya", account_type: "E_WALLET" },
  { name: "Wise", account_type: "DIGITAL_BANK" },
  { name: "Paper Cash", account_type: "PAPER_CASH" },
  { name: "Coin Pouch", account_type: "COIN_POUCH" },
]

export async function ensureDefaultAccounts(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string
) {
  const { count } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })

  if (count === 0) {
    await supabase
      .from("accounts")
      .insert(DEFAULT_ACCOUNTS.map((a) => ({ ...a, user_id: userId })))
  }
}

export type AccountOption = { id: string; name: string; account_type: AccountType }

export type AccountBalance = {
  account_id: string
  name: string
  account_type: AccountType
  opening_balance: number
  is_active: boolean
  balance: number
}

/** The Hard Floor: blocks an EXPENSE/SAVINGS that would exceed the account's current balance. */
export function assertSufficientBalance(balance: number, amount: number, accountName: string) {
  if (amount > balance) {
    throw new Error(
      `Insufficient funds in ${accountName} (available ₱${balance.toFixed(2)}, needed ₱${amount.toFixed(2)})`
    )
  }
}
