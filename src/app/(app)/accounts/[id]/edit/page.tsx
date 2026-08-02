import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ACCOUNT_TYPES } from "@/lib/accounts"
import { updateAccount } from "../../actions"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default async function EditAccountPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  const supabase = await createClient()

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, account_type, is_active")
    .eq("id", id)
    .single()

  if (!account) notFound()

  const updateAccountWithId = updateAccount.bind(null, account.id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Edit Account</h1>

      <Card>
        <CardHeader>
          <CardTitle>{account.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAccountWithId} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={account.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account_type">Type</Label>
              <Select name="account_type" defaultValue={account.account_type}>
                <SelectTrigger id="account_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="is_active" name="is_active" defaultChecked={account.is_active} />
              <Label htmlFor="is_active">Active (uncheck to archive)</Label>
            </div>
            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
