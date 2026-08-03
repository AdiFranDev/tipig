"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TRANSACTION_TYPES,
  EXPENSE_CLASSIFICATIONS,
  FUNDING_SOURCES,
  type TransactionType,
  type FundingSource,
  type ExpenseClassification,
} from "@/lib/transactions"
import type { Category } from "@/lib/categories"
import { isPhysicalAccount, type AccountOption } from "@/lib/accounts"
import { formatEnumLabel } from "@/lib/format"
import { denominationsFor } from "@/lib/denominations"
import { ExpenseDenominationFields, BreakingBillsFields } from "./denomination-fields"

type SavingsGoalOption = { id: string; name: string }

export type TransactionFormDefaults = {
  type?: TransactionType
  transaction_date?: string
  amount?: number
  account_id?: string
  destination_account_id?: string
  category_id?: string
  expense_classification?: ExpenseClassification
  funding_source?: FundingSource
  savings_goal_id?: string
  description?: string
}

export function TransactionForm({
  accounts,
  categories,
  savingsGoals,
  action,
  defaults,
  submitLabel = "Add Transaction",
}: Readonly<{
  accounts: AccountOption[]
  categories: Category[]
  savingsGoals: SavingsGoalOption[]
  action: (formData: FormData) => void | Promise<void>
  defaults?: TransactionFormDefaults
  submitLabel?: string
}>) {
  const [type, setType] = useState<TransactionType>(defaults?.type ?? "EXPENSE")
  const [fundingSource, setFundingSource] = useState<FundingSource>(
    defaults?.funding_source ?? "AVAILABLE_MONEY"
  )
  const [accountId, setAccountId] = useState(defaults?.account_id ?? "")
  const [destinationAccountId, setDestinationAccountId] = useState(
    defaults?.destination_account_id ?? ""
  )
  const [amount, setAmount] = useState(defaults?.amount ?? 0)

  const relevantCategories = categories.filter((c) =>
    type === "INCOME" ? c.category_type === "INCOME" : c.category_type === "EXPENSE"
  )

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const selectedDestAccount = accounts.find((a) => a.id === destinationAccountId)
  // Physical cash ledger entries are only recorded when a transaction is
  // first created — corrections happen via a new adjustment transaction,
  // not by editing old denomination entries (see project spec: physical
  // reconciliation requires an explicit Physical Adjustment transaction).
  const isEdit = Boolean(defaults)
  const showExpenseDenoms =
    !isEdit &&
    type === "EXPENSE" &&
    !!selectedAccount &&
    isPhysicalAccount(selectedAccount.account_type)
  const showBreakingBills =
    !isEdit &&
    type === "TRANSFER" &&
    !!selectedAccount &&
    !!selectedDestAccount &&
    isPhysicalAccount(selectedAccount.account_type) &&
    isPhysicalAccount(selectedDestAccount.account_type)

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="type">Type</Label>
        <Select
          name="type"
          value={type}
          onValueChange={(v) => setType(v as TransactionType)}
        >
          <SelectTrigger id="type" className="w-full">
            <SelectValue>{(v: TransactionType) => formatEnumLabel(v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {formatEnumLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="transaction_date">Date</Label>
          <Input
            id="transaction_date"
            name="transaction_date"
            type="date"
            required
            defaultValue={defaults?.transaction_date ?? new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaults?.amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="account_id">{type === "TRANSFER" ? "From Account" : "Account"}</Label>
        <Select name="account_id" value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
          <SelectTrigger id="account_id" className="w-full">
            <SelectValue placeholder="Select an account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type === "TRANSFER" && (
        <div className="space-y-1.5">
          <Label htmlFor="destination_account_id">To Account</Label>
          <Select
            name="destination_account_id"
            value={destinationAccountId}
            onValueChange={(v) => setDestinationAccountId(v ?? "")}
          >
            <SelectTrigger id="destination_account_id" className="w-full">
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showBreakingBills && selectedAccount && selectedDestAccount && (
        <BreakingBillsFields
          sourceDenominations={denominationsFor(selectedAccount.account_type)}
          destDenominations={denominationsFor(selectedDestAccount.account_type)}
          amount={amount}
        />
      )}

      {(type === "INCOME" || type === "EXPENSE") && (
        <div className="space-y-1.5">
          <Label htmlFor="category_id">Category</Label>
          <Select name="category_id" defaultValue={defaults?.category_id}>
            <SelectTrigger id="category_id" className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {relevantCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {type === "EXPENSE" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="expense_classification">Needs or Wants?</Label>
            <Select
              name="expense_classification"
              defaultValue={defaults?.expense_classification ?? "NEED"}
            >
              <SelectTrigger id="expense_classification" className="w-full">
                <SelectValue>{(v: ExpenseClassification) => formatEnumLabel(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {formatEnumLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="funding_source">Paid From</Label>
            <Select
              name="funding_source"
              value={fundingSource}
              onValueChange={(v) => setFundingSource(v as FundingSource)}
            >
              <SelectTrigger id="funding_source" className="w-full">
                <SelectValue>{(v: FundingSource) => formatEnumLabel(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FUNDING_SOURCES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {formatEnumLabel(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {showExpenseDenoms && selectedAccount && (
        <ExpenseDenominationFields
          denominations={denominationsFor(selectedAccount.account_type)}
          amount={amount}
        />
      )}

      {type === "EXPENSE" && fundingSource === "SAVED_MONEY" && (
        <div className="space-y-1.5">
          <Label htmlFor="savings_goal_id">Savings Goal</Label>
          <Select name="savings_goal_id" defaultValue={defaults?.savings_goal_id}>
            <SelectTrigger id="savings_goal_id" className="w-full">
              <SelectValue placeholder="Select a goal" />
            </SelectTrigger>
            <SelectContent>
              {savingsGoals.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {type === "SAVINGS" && (
        <p className="text-xs text-muted-foreground">
          Automatically split across your savings goals by their configured percentage
          (leftover goes to Unallocated Savings). Adjust percentages on the Savings page.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          placeholder="Optional"
          defaultValue={defaults?.description}
        />
      </div>

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
