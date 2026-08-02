import { sendMagicLink } from "./actions"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PiggyBank } from "lucide-react"

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string; sent?: string }>
}>) {
  const { error, sent } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PiggyBank className="size-5" />
          </div>
          <CardTitle className="text-2xl">Tipig</CardTitle>
          <CardDescription>Private Personal Finance Tracker</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "unauthorized" && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center">
              That email isn&apos;t authorized for this account.
            </div>
          )}
          {error === "auth-callback-failed" && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center">
              Sign-in link expired or already used. Please request a new one.
            </div>
          )}
          {error === "send-failed" && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center">
              Could not send the sign-in link. Please try again.
            </div>
          )}

          {sent ? (
            <p className="text-center text-sm text-muted-foreground">
              Check your email for a sign-in link.
            </p>
          ) : (
            <form action={sendMagicLink} className="space-y-3">
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
              <Button type="submit" className="w-full">
                Send me a sign-in link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
