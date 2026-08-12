"use client"

import { useState } from "react"
import Link from "next/link"
import { Pencil, Trash2, Plus } from "lucide-react"
import { accountTypeLabel, isPhysicalAccount, type AccountBalance } from "@/lib/accounts"
import { formatPHP } from "@/lib/format"
import { archiveAccount } from "./actions"
import { AccountForm } from "./account-form"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ActionForm } from "@/components/action-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function AccountGrids({
  digital,
  physical,
}: Readonly<{ digital: AccountBalance[]; physical: AccountBalance[] }>) {
  const [isAddDigitalOpen, setIsAddDigitalOpen] = useState(false)
  const [isAddPhysicalOpen, setIsAddPhysicalOpen] = useState(false)

  return (
    <>
      <AccountGroup
        title="Digital Accounts"
        accounts={digital}
        trailing={<AddAccountCard onClick={() => setIsAddDigitalOpen(true)} />}
      />
      <AccountGroup
        title="Physical Accounts"
        accounts={physical}
        trailing={<AddAccountCard onClick={() => setIsAddPhysicalOpen(true)} />}
      />

      <Dialog open={isAddDigitalOpen} onOpenChange={setIsAddDigitalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Digital Account</DialogTitle>
          </DialogHeader>
          <AccountForm defaultType="DIGITAL" onSuccess={() => setIsAddDigitalOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isAddPhysicalOpen} onOpenChange={setIsAddPhysicalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Physical Account</DialogTitle>
          </DialogHeader>
          <AccountForm defaultType="PHYSICAL" onSuccess={() => setIsAddPhysicalOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function AccountGroup({
  title,
  accounts,
  trailing,
}: Readonly<{ title: string; accounts: AccountBalance[]; trailing: React.ReactNode }>) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <AccountCard key={a.account_id} account={a} />
        ))}
        {trailing}
      </div>
    </div>
  )
}

function AddAccountCard({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <div
      onClick={onClick}
      className="border border-dashed border-zinc-800 rounded-xl p-6 h-full min-h-[120px] flex flex-col justify-center items-start text-left hover:bg-zinc-900/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2 text-base font-medium text-foreground">
        <Plus size={16} />
        Add Account
      </div>
      <p className="text-sm text-muted-foreground mt-1.5">Name, type, and opening balance</p>
    </div>
  )
}

function AccountCard({ account: a }: Readonly<{ account: AccountBalance }>) {
  const archiveWithId = archiveAccount.bind(null, a.account_id)

  return (
    <Card className="group">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <Link href={`/accounts/${a.account_id}/edit`} className="min-w-0 flex-1 hover:opacity-80">
            <CardTitle className="truncate">{a.name}</CardTitle>
            <CardDescription>{accountTypeLabel(a.account_type)}</CardDescription>
          </Link>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={<Link href={`/accounts/${a.account_id}/edit`} />}
              aria-label="Edit account"
            >
              <Pencil />
            </Button>
            <ActionForm action={archiveWithId} successMessage="Account archived">
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Archive account">
                <Trash2 />
              </Button>
            </ActionForm>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p
          className={`text-2xl font-semibold tabular-nums ${
            a.balance < 0 ? "text-red-500" : "text-foreground"
          }`}
        >
          {formatPHP(a.balance)}
        </p>
        {isPhysicalAccount(a.account_type) && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            nativeButton={false}
            render={<Link href={`/accounts/${a.account_id}/reconcile`} />}
          >
            Reconcile
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
