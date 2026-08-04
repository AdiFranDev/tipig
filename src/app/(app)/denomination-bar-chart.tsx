"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartConfig = {
  quantity: { label: "Quantity", color: "var(--chart-1)" },
} satisfies ChartConfig

export function DenominationBarChart({
  data,
}: Readonly<{ data: { denomination: number; quantity: number }[] }>) {
  const chartData = data.map((d) => ({
    label: `₱${d.denomination}`,
    quantity: d.quantity,
  }))

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4}>
          <LabelList dataKey="quantity" position="top" className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
