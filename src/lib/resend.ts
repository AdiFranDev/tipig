import { Resend } from "resend"

let client: Resend | null = null

/**
 * Constructed lazily, not at module scope — Next.js evaluates route modules
 * during the build's "Collecting page data" step, so an eager `new Resend()`
 * here would throw on missing RESEND_API_KEY and fail the entire production
 * build, not just the email routes.
 */
export function getResendClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY!)
  return client
}
