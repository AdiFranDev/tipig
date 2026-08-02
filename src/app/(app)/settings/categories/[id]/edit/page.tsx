import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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
import { updateCategory } from "../../../actions"

export default async function EditCategoryPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params
  const supabase = await createClient()

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, category_type, default_expense_classification, is_active")
    .eq("id", id)
    .single()

  if (!category) notFound()

  const updateWithId = updateCategory.bind(null, category.id)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Edit Category</h1>

      <Card>
        <CardHeader>
          <CardTitle>{category.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateWithId} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={category.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category_type">Type</Label>
              <Select name="category_type" defaultValue={category.category_type}>
                <SelectTrigger id="category_type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Income</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default_expense_classification">Default Needs/Wants</Label>
              <Select
                name="default_expense_classification"
                defaultValue={category.default_expense_classification ?? "NEED"}
              >
                <SelectTrigger id="default_expense_classification" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEED">Need</SelectItem>
                  <SelectItem value="WANT">Want</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only applies to expense categories.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="is_active" name="is_active" defaultChecked={category.is_active} />
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
