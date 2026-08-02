"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  income: { label: "Income", color: "var(--chart-1)" },
  needs: { label: "Needs", color: "var(--chart-2)" },
  wants: { label: "Wants", color: "var(--chart-3)" },
  savings: { label: "Savings", color: "var(--chart-4)" },
} satisfies ChartConfig

export function MonthlyBarChart({
  month,
  income,
  needs,
  wants,
  savings,
}: Readonly<{
  month: string
  income: number
  needs: number
  wants: number
  savings: number
}>) {
  const data = [{ month, income, needs, wants, savings }]

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={4} />
        <Bar dataKey="needs" fill="var(--color-needs)" radius={4} />
        <Bar dataKey="wants" fill="var(--color-wants)" radius={4} />
        <Bar dataKey="savings" fill="var(--color-savings)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
