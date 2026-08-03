"use client"

import { useActionToast } from "@/hooks/use-action-toast"
import type { ActionResult } from "@/lib/action-result"

/**
 * Drop-in replacement for a plain `<form action={fn}>` in a Server
 * Component page. `fn` must return an ActionResult (see toActionResult) so
 * this can show a toast instead of letting the error crash to error.tsx.
 */
export function ActionForm({
  action,
  successMessage,
  className,
  children,
}: Readonly<{
  action: (formData: FormData) => Promise<ActionResult>
  successMessage?: string
  className?: string
  children: React.ReactNode
}>) {
  const [formAction] = useActionToast(action, successMessage)

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  )
}
