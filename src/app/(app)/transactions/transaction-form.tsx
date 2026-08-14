"use client"

import { useRef, useState } from "react"
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
import { formatEnumLabel, formatPHP } from "@/lib/format"
import { denominationsFor } from "@/lib/denominations"
import {
  ExpenseDenominationFields,
  IncomeDenominationFields,
  BreakingBillsFields,
  TransferOutDenominationFields,
  TransferInDenominationFields,
} from "./denomination-fields"
import { NamedSelectValue } from "@/components/enum-select-value"
import { useActionToast } from "@/hooks/use-action-toast"
import type { ActionResult } from "@/lib/action-result"

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
  denominationRows?: { account_id: string; denomination: number; quantity: number; direction: "IN" | "OUT" }[]
}

/**
 * Filters existing denomination rows down to one account+direction —
 * account_id matters now that an EXPENSE's change can span two accounts
 * (Coin Pouch change for a Paper Cash payment), so direction alone is no
 * longer enough to tell "this account's change" from "the other account's".
 */
function quantitiesFor(
  rows: TransactionFormDefaults["denominationRows"],
  accountId: string | undefined,
  direction: "IN" | "OUT"
): Record<number, number> | undefined {
  if (!rows || !accountId) return undefined
  const filtered = rows.filter((r) => r.account_id === accountId && r.direction === direction)
  if (filtered.length === 0) return undefined
  return Object.fromEntries(filtered.map((r) => [r.denomination, r.quantity]))
}

export function TransactionForm({
  accounts,
  categories,
  savingsGoals,
  action,
  defaults,
  defaultType,
  defaultAccountId,
  submitLabel = "Add Transaction",
  onSuccess,
  availableToSpend,
}: Readonly<{
  accounts: AccountOption[]
  categories: Category[]
  savingsGoals: SavingsGoalOption[]
  action: (formData: FormData) => Promise<ActionResult>
  defaults?: TransactionFormDefaults
  defaultType?: TransactionType
  defaultAccountId?: string
  submitLabel?: string
  onSuccess?: () => void
  availableToSpend?: number
}>) {
  // The "idle" shape to return to after a successful add.
  const initial = {
    type: defaults?.type ?? defaultType ?? "EXPENSE",
    fundingSource: defaults?.funding_source ?? "AVAILABLE_MONEY",
    accountId: defaults?.account_id ?? defaultAccountId ?? "",
    destinationAccountId: defaults?.destination_account_id ?? "",
    amount: defaults?.amount ?? 0,
    categoryId: defaults?.category_id ?? "",
    expenseClassification: defaults?.expense_classification ?? "NEED",
    savingsGoalId: defaults?.savings_goal_id ?? "",
  }

  const formRef = useRef<HTMLFormElement>(null)
  const [type, setType] = useState<TransactionType>(initial.type)
  const [fundingSource, setFundingSource] = useState<FundingSource>(initial.fundingSource)
  const [accountId, setAccountId] = useState(initial.accountId)
  const [destinationAccountId, setDestinationAccountId] = useState(initial.destinationAccountId)
  const [amount, setAmount] = useState(initial.amount)
  const [categoryId, setCategoryId] = useState(initial.categoryId)
  const [expenseClassification, setExpenseClassification] = useState<ExpenseClassification>(
    initial.expenseClassification
  )
  const [savingsGoalId, setSavingsGoalId] = useState(initial.savingsGoalId)
  // Not proven valid until a physical breakdown component reports in — the
  // safer default for a money-integrity gate (see submit button below).
  const [physicalValid, setPhysicalValid] = useState(false)

  const [formAction] = useActionToast(
    action,
    defaults ? "Transaction saved" : "Transaction added",
    // Redirect-on-success edits never reach this (the redirect wins the
    // race), so this only fires for the persistent Add Transaction form —
    // reset it back to idle instead of leaving the last entry on screen.
    () => {
      formRef.current?.reset()
      setType(initial.type)
      setFundingSource(initial.fundingSource)
      setAccountId(initial.accountId)
      setDestinationAccountId(initial.destinationAccountId)
      setAmount(initial.amount)
      setCategoryId(initial.categoryId)
      setExpenseClassification(initial.expenseClassification)
      setSavingsGoalId(initial.savingsGoalId)
      setPhysicalValid(false)
      onSuccess?.()
    }
  )

  const relevantCategories = categories.filter((c) =>
    type === "INCOME" ? c.category_type === "INCOME" : c.category_type === "EXPENSE"
  )

  // Live Preview / Soft Confirm (Phase 10): only meaningful for a type that
  // actually draws against the available pool. A Saved Money expense has no
  // marginal effect — it's tracked separately so it never trips the warning
  // styling, even if availableToSpend is already negative from something else.
  const isProjectable = availableToSpend !== undefined && (type === "SAVINGS" || type === "EXPENSE")
  const isSavedExpense = type === "EXPENSE" && fundingSource === "SAVED_MONEY"
  const projectedBalance = isProjectable
    ? isSavedExpense
      ? availableToSpend
      : availableToSpend - amount
    : undefined
  const showWarning = isProjectable && !isSavedExpense && projectedBalance! < 0

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const selectedDestAccount = accounts.find((a) => a.id === destinationAccountId)
  const showExpenseDenoms =
    type === "EXPENSE" && !!selectedAccount && isPhysicalAccount(selectedAccount.account_type)
  const showIncomeDenoms =
    type === "INCOME" && !!selectedAccount && isPhysicalAccount(selectedAccount.account_type)
  const showBreakingBills =
    type === "TRANSFER" &&
    !!selectedAccount &&
    !!selectedDestAccount &&
    isPhysicalAccount(selectedAccount.account_type) &&
    isPhysicalAccount(selectedDestAccount.account_type)
  const showTransferOut =
    type === "TRANSFER" &&
    !!selectedAccount &&
    isPhysicalAccount(selectedAccount.account_type) &&
    !showBreakingBills
  const showReceivedDenoms =
    type === "TRANSFER" &&
    !!selectedDestAccount &&
    isPhysicalAccount(selectedDestAccount.account_type) &&
    !showBreakingBills

  // The complementary physical account (Paper Cash <-> Coin Pouch) — an
  // EXPENSE's change can land here too, e.g. coins as change for a Paper
  // Cash payment. Undefined if there's no active account of that type.
  const otherPhysicalAccount =
    selectedAccount && isPhysicalAccount(selectedAccount.account_type)
      ? accounts.find(
          (a) => isPhysicalAccount(a.account_type) && a.account_type !== selectedAccount.account_type
        )
      : undefined

  // Same idea, but relative to the TRANSFER destination rather than the
  // source — a Digital-to-Physical withdrawal can also arrive split across
  // both physical accounts (e.g. mostly bills plus a few coins).
  const otherPhysicalAccountForDest =
    selectedDestAccount && isPhysicalAccount(selectedDestAccount.account_type)
      ? accounts.find(
          (a) => isPhysicalAccount(a.account_type) && a.account_type !== selectedDestAccount.account_type
        )
      : undefined

  // "OUT" rows are Handed Over for an expense / Take Out for breaking bills.
  // "IN" rows split by account: the paying/source account's own change vs.
  // the complementary account's change vs. a breaking-bills destination.
  const initialOutRows = quantitiesFor(defaults?.denominationRows, accountId, "OUT")
  const initialChangeRows = quantitiesFor(defaults?.denominationRows, accountId, "IN")
  const initialChangeOtherRows = quantitiesFor(defaults?.denominationRows, otherPhysicalAccount?.id, "IN")
  const initialOutOtherRows = quantitiesFor(defaults?.denominationRows, otherPhysicalAccount?.id, "OUT")
  const initialInRows = quantitiesFor(defaults?.denominationRows, destinationAccountId, "IN")
  const initialInOtherRows = quantitiesFor(defaults?.denominationRows, otherPhysicalAccountForDest?.id, "IN")

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
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

      {type === "EXPENSE" && (
        <div className="space-y-1.5">
          <Label htmlFor="funding_source">Paid From</Label>
          <input type="hidden" name="funding_source" value={fundingSource} />
          <div
            id="funding_source"
            className="grid grid-cols-2 gap-1 rounded-lg border border-input bg-transparent p-1"
          >
            {FUNDING_SOURCES.map((f) => {
              const active = fundingSource === f
              const activeColor = f === "SAVED_MONEY" ? "bg-blue-500 text-zinc-950" : "bg-emerald-500 text-zinc-950"
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFundingSource(f)}
                  className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                    active ? activeColor : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  {formatEnumLabel(f)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isSavedExpense && (
        <div className="space-y-1.5">
          <Label htmlFor="savings_goal_id">Savings Goal</Label>
          <Select
            name="savings_goal_id"
            value={savingsGoalId}
            onValueChange={(v) => setSavingsGoalId(v ?? "")}
          >
            <SelectTrigger id="savings_goal_id" className="w-full">
              <NamedSelectValue items={savingsGoals} placeholder="Select a goal" />
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
          {isProjectable && (
            <p className={`text-xs ${!isSavedExpense && projectedBalance! < 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {isSavedExpense
                ? "No impact on available balance"
                : `Available to Spend after this: ${formatPHP(projectedBalance!)}`}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="account_id">{type === "TRANSFER" ? "From Account" : "Account"}</Label>
        <Select name="account_id" value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
          <SelectTrigger id="account_id" className="w-full">
            <NamedSelectValue items={accounts} placeholder="Select an account" />
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
              <NamedSelectValue items={accounts} placeholder="Select an account" />
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
          sourceAccountName={selectedAccount.name}
          destAccountName={selectedDestAccount.name}
          amount={amount}
          initialOut={initialOutRows}
          initialIn={initialInRows}
          onValidityChange={setPhysicalValid}
        />
      )}

      {showTransferOut && selectedAccount && (
        <TransferOutDenominationFields
          denominations={denominationsFor(selectedAccount.account_type)}
          amount={amount}
          initialOut={initialOutRows}
          onValidityChange={setPhysicalValid}
        />
      )}

      {showReceivedDenoms && selectedDestAccount && (
        <TransferInDenominationFields
          denominations={denominationsFor(selectedDestAccount.account_type)}
          amount={amount}
          initialIn={initialInRows}
          otherDenominations={
            otherPhysicalAccountForDest ? denominationsFor(otherPhysicalAccountForDest.account_type) : undefined
          }
          otherAccountLabel={otherPhysicalAccountForDest?.name}
          initialInOther={initialInOtherRows}
          onValidityChange={setPhysicalValid}
        />
      )}

      {(type === "INCOME" || type === "EXPENSE") && (
        <div className="space-y-1.5">
          <Label htmlFor="category_id">Category</Label>
          <Select name="category_id" value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
            <SelectTrigger id="category_id" className="w-full">
              <NamedSelectValue items={relevantCategories} placeholder="Select a category" />
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

      {showIncomeDenoms && selectedAccount && (
        <IncomeDenominationFields
          denominations={denominationsFor(selectedAccount.account_type)}
          amount={amount}
          initialReceived={initialChangeRows}
          otherDenominations={
            otherPhysicalAccount ? denominationsFor(otherPhysicalAccount.account_type) : undefined
          }
          otherAccountLabel={otherPhysicalAccount?.name}
          initialReceivedOther={initialChangeOtherRows}
          onValidityChange={setPhysicalValid}
        />
      )}

      {type === "EXPENSE" && (
        <div className="space-y-1.5">
          <Label htmlFor="expense_classification">Needs or Wants?</Label>
          <Select
            name="expense_classification"
            value={expenseClassification}
            onValueChange={(v) => setExpenseClassification(v as ExpenseClassification)}
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
      )}

      {showExpenseDenoms && selectedAccount && (
        <ExpenseDenominationFields
          denominations={denominationsFor(selectedAccount.account_type)}
          amount={amount}
          initialHandedOver={initialOutRows}
          initialChange={initialChangeRows}
          otherDenominations={
            otherPhysicalAccount ? denominationsFor(otherPhysicalAccount.account_type) : undefined
          }
          otherAccountLabel={otherPhysicalAccount?.name}
          initialHandedOverOther={initialOutOtherRows}
          initialChangeOther={initialChangeOtherRows}
          onValidityChange={setPhysicalValid}
        />
      )}

      {type === "SAVINGS" && (
        <p className="text-xs text-muted-foreground">
          Automatically split evenly across your active savings goals (any rounding remainder
          goes to Unallocated Savings).
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

      <Button
        type="submit"
        className={
          showWarning
            ? "w-full border border-red-500/50 bg-red-500/20 font-medium text-red-500 hover:bg-red-500/30"
            : "w-full bg-emerald-500 font-medium text-zinc-950 hover:bg-emerald-600"
        }
        disabled={
          (showExpenseDenoms ||
            showIncomeDenoms ||
            showBreakingBills ||
            showTransferOut ||
            showReceivedDenoms) &&
          !physicalValid
        }
      >
        {showWarning ? `Add Anyway (Available Balance will drop to ${formatPHP(projectedBalance!)})` : submitLabel}
      </Button>
    </form>
  )
}
