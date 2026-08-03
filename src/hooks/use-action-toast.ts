"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { ActionResult } from "@/lib/action-result"

/**
 * Runs a Server Action that returns an ActionResult through useActionState
 * and fires a toast when it settles — green on success, red on failure.
 * Redirect-on-success actions never produce a state here (the redirect
 * throw wins the race), so only actions that stay on the page show a toast.
 */
export function useActionToast(
  action: (formData: FormData) => Promise<ActionResult>,
  successMessage?: string
) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    (_prevState, formData) => action(formData),
    null
  )
  const handled = useRef<ActionResult | null>(null)

  useEffect(() => {
    if (!state || state === handled.current) return
    handled.current = state
    if (state.success) {
      toast.success(state.message ?? successMessage ?? "Saved")
    } else {
      toast.error(state.error)
    }
  }, [state, successMessage])

  return [formAction, pending] as const
}
