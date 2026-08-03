import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PiggyBank } from "lucide-react"
import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string }>
}>) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PiggyBank className="size-5" />
          </div>
          <CardTitle className="text-2xl">Hi Adrian, Welcome to Tipig!</CardTitle>
          <CardDescription>Please input your secret key &amp; email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "invalid" && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center">
              Incorrect email or secret key.
            </div>
          )}
          {error === "unauthorized" && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center">
              That account isn&apos;t authorized for this app.
            </div>
          )}

          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
