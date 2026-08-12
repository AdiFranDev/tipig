"use client"

import { useTheme } from "next-themes"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export type TrendDatum = { month: string; needs: number; wants: number; savings: number }
export type CumulativeDatum = { month: string; cumulativeSavings: number; cumulativeExpenses: number }
export type TopCategoryDatum = { name: string; total: number }

function useTooltipStyles() {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  return {
    tooltipStyles: {
      contentStyle: {
        backgroundColor: isDark ? "#09090b" : "#ffffff",
        borderColor: isDark ? "#27272a" : "#e4e4e7",
        borderRadius: "8px",
        padding: "12px",
      },
      labelStyle: { color: isDark ? "#a1a1aa" : "#52525b", fontWeight: 500, paddingBottom: "4px" },
      itemStyle: { fontSize: "14px" },
    },
    cursorFill: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
  }
}

function ChartBox({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="border border-border bg-transparent rounded-xl p-4">
      <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function CumulativeAreaChart({ data }: Readonly<{ data: CumulativeDatum[] }>) {
  const { tooltipStyles } = useTooltipStyles()
  return (
    <ChartBox title="Cumulative Savings vs Expenses">
      <AreaChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--surface-line)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={60} />
        <Tooltip {...tooltipStyles} />
        <Area
          type="monotone"
          dataKey="cumulativeSavings"
          name="Savings"
          stroke="var(--chart-4)"
          fill="var(--chart-4)"
          fillOpacity={0.2}
        />
        <Area
          type="monotone"
          dataKey="cumulativeExpenses"
          name="Expenses"
          stroke="var(--chart-2)"
          fill="var(--chart-2)"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartBox>
  )
}

export function BudgetSplitBarChart({ data }: Readonly<{ data: TrendDatum[] }>) {
  const { tooltipStyles, cursorFill } = useTooltipStyles()
  return (
    <ChartBox title="Budget Split (Needs / Wants / Savings)">
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--surface-line)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={60} />
        <Tooltip {...tooltipStyles} cursor={{ fill: cursorFill }} />
        <Bar dataKey="needs" name="Needs" stackId="a" fill="var(--chart-2)" />
        <Bar dataKey="wants" name="Wants" stackId="a" fill="var(--chart-3)" />
        <Bar dataKey="savings" name="Savings" stackId="a" fill="var(--chart-4)" />
      </BarChart>
    </ChartBox>
  )
}

export function TopCategoriesBarChart({ data }: Readonly<{ data: TopCategoryDatum[] }>) {
  const { tooltipStyles, cursorFill } = useTooltipStyles()
  return (
    <ChartBox title="Top 10 Spending Categories">
      <BarChart data={data} layout="vertical">
        <CartesianGrid horizontal={false} stroke="var(--surface-line)" />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} />
        <Tooltip {...tooltipStyles} cursor={{ fill: cursorFill }} />
        <Bar dataKey="total" name="Total" fill="var(--chart-2)" radius={4} />
      </BarChart>
    </ChartBox>
  )
}
