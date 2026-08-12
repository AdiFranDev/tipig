import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ensureDefaultSettings } from "@/lib/settings"
import { ensureDefaultCategories, type Category } from "@/lib/categories"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatPHP } from "@/lib/format"
import { monthlyAllowance, coveredMonthRange, type ScholarshipAllocation } from "@/lib/scholarship"
import {
  archiveCategory,
  restoreCategory,
  createScholarshipAllocation,
  deleteScholarshipAllocation,
} from "./actions"
import { BudgetRatiosForm } from "./budget-ratios-form"
import { AddCategoryForm } from "./add-category-form"
import { ActionForm } from "@/components/action-form"
import { Pencil, Trash2, RefreshCcw } from "lucide-react"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [settings] = await Promise.all([
    ensureDefaultSettings(supabase, user.id),
    ensureDefaultCategories(supabase, user.id),
  ])

  const { data: categoriesData } = await supabase
    .from("categories")
    .select("*")
    .order("name")

  const categories: Category[] = categoriesData ?? []
  const incomeCategories = categories.filter((c) => c.category_type === "INCOME" && c.is_active)
  const expenseCategories = categories.filter((c) => c.category_type === "EXPENSE" && c.is_active)
  const archivedCategories = categories.filter((c) => !c.is_active)

  const { data: scholarshipsData } = await supabase
    .from("scholarship_allocations")
    .select("*")
    .order("starting_month", { ascending: false })
  const scholarships: ScholarshipAllocation[] = scholarshipsData ?? []

  return (
    <div className="flex flex-col gap-8 px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Budget Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetRatiosForm
              needs={settings.needs_target_percentage}
              wants={settings.wants_target_percentage}
              savings={settings.savings_target_percentage}
            />
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Scholarship / Allowance Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scholarships.length > 0 && (
              <div className="divide-y divide-border rounded-lg border border-border">
                {scholarships.map((s) => (
                  <ScholarshipRow key={s.id} scholarship={s} />
                ))}
              </div>
            )}
            <ActionForm action={createScholarshipAllocation} successMessage="Allocation added" className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="scholarship_name">Name</Label>
                <Input
                  id="scholarship_name"
                  name="name"
                  required
                  placeholder="e.g. 1st Sem AY 2026-2027 Allowance"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="total_amount">Total Amount</Label>
                  <Input
                    id="total_amount"
                    name="total_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="starting_month">Starting Month</Label>
                  <Input
                    id="starting_month"
                    name="starting_month"
                    type="month"
                    required
                    defaultValue={new Date().toISOString().slice(0, 7)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="covered_months">Covered Months</Label>
                  <Input
                    id="covered_months"
                    name="covered_months"
                    type="number"
                    step="1"
                    min="1"
                    required
                    defaultValue={6}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Add Allocation
              </Button>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCategoryForm />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CategoryGroup title="Income Categories" categories={incomeCategories} />
        <CategoryGroup title="Expense Categories" categories={expenseCategories} />

        {archivedCategories.length > 0 && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Archived Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {archivedCategories.map((c) => {
                const restoreWithId = restoreCategory.bind(null, c.id)
                return (
                  <div key={c.id} className="flex items-center gap-2 px-(--card-spacing) py-3">
                    <span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground truncate">
                      {c.name}
                    </span>
                    <ActionForm action={restoreWithId} successMessage="Category restored">
                      <Button variant="ghost" size="icon-sm" type="submit" aria-label="Restore category">
                        <RefreshCcw />
                      </Button>
                    </ActionForm>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function ScholarshipRow({
  scholarship: s,
}: Readonly<{ scholarship: ScholarshipAllocation }>) {
  const deleteWithId = deleteScholarshipAllocation.bind(null, s.id)

  return (
    <div className="flex items-center justify-between gap-3 px-(--card-spacing) py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatPHP(s.total_amount)} over {s.covered_months} month
          {s.covered_months === 1 ? "" : "s"} ({coveredMonthRange(s)})
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatPHP(monthlyAllowance(s))}/mo
      </span>
      <ActionForm action={deleteWithId} successMessage="Allocation deleted">
        <Button variant="ghost" size="icon-sm" type="submit" aria-label="Delete allocation">
          ×
        </Button>
      </ActionForm>
    </div>
  )
}

function CategoryGroup({
  title,
  categories,
}: Readonly<{ title: string; categories: Category[] }>) {
  if (categories.length === 0) return null

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {categories.map((c) => {
          const archiveWithId = archiveCategory.bind(null, c.id)
          return (
            <div key={c.id} className="group flex items-center gap-2 px-(--card-spacing) py-3">
              <Link
                href={`/settings/categories/${c.id}/edit`}
                className="min-w-0 flex-1 flex items-center justify-between gap-3 hover:opacity-80"
              >
                <span className="text-sm font-medium text-foreground">{c.name}</span>
                {c.default_expense_classification && (
                  <Badge variant="outline">{c.default_expense_classification}</Badge>
                )}
              </Link>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={<Link href={`/settings/categories/${c.id}/edit`} />}
                  aria-label="Edit category"
                >
                  <Pencil />
                </Button>
                <ActionForm action={archiveWithId} successMessage="Category archived">
                  <Button variant="ghost" size="icon-sm" type="submit" aria-label="Archive category">
                    <Trash2 />
                  </Button>
                </ActionForm>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
