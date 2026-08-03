"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { EnumSelectValue } from "@/components/enum-select-value"
import { formatEnumLabel } from "@/lib/format"
import { useActionToast } from "@/hooks/use-action-toast"
import { createCategory } from "./actions"
import type { CategoryType } from "@/lib/categories"

export function AddCategoryForm() {
  const [categoryType, setCategoryType] = useState<CategoryType>("EXPENSE")
  const [formAction] = useActionToast(createCategory)

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="e.g. Subscriptions" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category_type">Type</Label>
        <Select
          name="category_type"
          value={categoryType}
          onValueChange={(v) => setCategoryType(v as CategoryType)}
        >
          <SelectTrigger id="category_type" className="w-full">
            <EnumSelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INCOME">{formatEnumLabel("INCOME")}</SelectItem>
            <SelectItem value="EXPENSE">{formatEnumLabel("EXPENSE")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {categoryType === "EXPENSE" && (
        <div className="space-y-1.5">
          <Label htmlFor="default_expense_classification">Default Needs/Wants</Label>
          <Select name="default_expense_classification" defaultValue="NEED">
            <SelectTrigger id="default_expense_classification" className="w-full">
              <EnumSelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEED">{formatEnumLabel("NEED")}</SelectItem>
              <SelectItem value="WANT">{formatEnumLabel("WANT")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" className="w-full">
        Add Category
      </Button>
    </form>
  )
}
