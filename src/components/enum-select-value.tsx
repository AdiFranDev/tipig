"use client"

import { SelectValue } from "@/components/ui/select"
import { formatEnumLabel } from "@/lib/format"
import { accountTypeLabel, type AccountType } from "@/lib/accounts"

/**
 * Base UI's SelectValue only resolves a label automatically when an `items`
 * map is passed to Select.Root (which this codebase doesn't do), so it falls
 * back to showing the raw stored value. These render the formatted label via
 * SelectValue's children function instead — kept as client components since
 * a function prop can't cross the Server->Client boundary from a server page.
 */
export function EnumSelectValue({ allLabel }: Readonly<{ allLabel?: string }> = {}) {
  return (
    <SelectValue>
      {(v: string) => (allLabel && v === "ALL" ? allLabel : formatEnumLabel(v))}
    </SelectValue>
  )
}

export function AccountTypeSelectValue() {
  return <SelectValue>{(v: AccountType) => accountTypeLabel(v)}</SelectValue>
}

/**
 * Same fix as above, for selects whose options are database rows (id/name)
 * rather than enum values — Accounts, Categories, Savings Goals.
 */
export function NamedSelectValue({
  items,
  extra,
  placeholder,
}: Readonly<{
  items: readonly { id: string; name: string }[]
  extra?: { value: string; label: string }
  placeholder?: string
}>) {
  return (
    <SelectValue>
      {(v: string) =>
        extra && v === extra.value ? extra.label : items.find((i) => i.id === v)?.name ?? placeholder ?? ""
      }
    </SelectValue>
  )
}
