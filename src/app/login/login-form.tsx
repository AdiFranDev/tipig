"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActionToast } from "@/hooks/use-action-toast"
import { login } from "./actions"

function FormFields() {
  const { pending } = useFormStatus()

  if (pending) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading...
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secretKey">Secret Key</Label>
        <Input id="secretKey" name="secretKey" type="password" required />
      </div>
      <Button type="submit" className="w-full">
        Sign In
      </Button>
    </>
  )
}

export function LoginForm() {
  const [formAction] = useActionToast(login)

  return (
    <form action={formAction} className="space-y-3">
      <FormFields />
    </form>
  )
}
