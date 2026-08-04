import { formatPHP } from "@/lib/format"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function KpiCard({
  label,
  hint,
  value,
  emphasize,
  highlight,
}: Readonly<{
  label: string
  hint: string
  value: number
  emphasize?: boolean
  highlight?: boolean
}>) {
  const valueColor = value < 0 ? "text-destructive" : emphasize ? "text-primary" : "text-foreground"

  return (
    <Card className={highlight ? "border-primary/40 ring-1 ring-primary/15" : undefined}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${valueColor}`}>
          {formatPHP(value)}
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function MiniStat({
  label,
  value,
  tone,
  subtitle,
}: Readonly<{
  label: string
  value: number
  tone?: "emerald" | "destructive" | "net"
  subtitle?: string
}>) {
  const color =
    tone === "net"
      ? value > 0
        ? "text-emerald-600 dark:text-emerald-500"
        : value < 0
          ? "text-destructive"
          : "text-foreground"
      : value < 0
        ? "text-destructive"
        : tone === "emerald"
          ? "text-emerald-600 dark:text-emerald-500"
          : tone === "destructive"
            ? "text-destructive"
            : "text-foreground"

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{formatPHP(value)}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

export function BudgetSplitStat({
  label,
  percentage,
  amount,
  swatch,
}: Readonly<{ label: string; percentage: number; amount: number; swatch: string }>) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`size-2 rounded-full ${swatch}`} />
        {label} ({percentage}%)
      </p>
      <p className="text-lg font-semibold tabular-nums text-foreground">{formatPHP(amount)}</p>
    </div>
  )
}
