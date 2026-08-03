import { unstable_rethrow } from "next/navigation"

export type ActionResult = { success: true; message?: string } | { success: false; error: string }

/**
 * Wraps a Server Action body in try/catch and turns thrown errors into a
 * readable ActionResult instead of an uncaught exception. `unstable_rethrow`
 * lets Next.js's own control-flow errors (redirect/notFound) pass through
 * untouched — those must never be swallowed here.
 */
export async function toActionResult(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn()
    return { success: true, message: message ?? undefined }
  } catch (err) {
    unstable_rethrow(err)
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong" }
  }
}

