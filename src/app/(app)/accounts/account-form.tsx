"use client"

import { ACCOUNT_TYPES } from "@/lib/accounts"
import { createAccount } from "./actions"
import { ActionForm } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { AccountTypeSelectValue } from "@/components/enum-select-value"

export function AccountForm({
  defaultType,
  onSuccess,
}: Readonly<{ defaultType: "DIGITAL" | "PHYSICAL"; onSuccess?: () => void }>) {
  const types = ACCOUNT_TYPES.filter((t) => t.group === defaultType.toLowerCase())

  return (
    <ActionForm action={createAccount} successMessage="Account added" onSuccess={onSuccess} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="e.g. BPI" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account_type">Type</Label>
        <Select name="account_type" defaultValue={types[0].value}>
          <SelectTrigger id="account_type" className="w-full">
            <AccountTypeSelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="opening_balance">Opening Balance</Label>
        <Input
          id="opening_balance"
          name="opening_balance"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
        />
      </div>
      <Button type="submit" className="w-full">
        Add Account
      </Button>
    </ActionForm>
  )
}
