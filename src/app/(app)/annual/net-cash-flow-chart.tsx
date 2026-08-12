"use client"

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  net: { label: "Net Cash Flow", color: "var(--chart-1)" },
} satisfies ChartConfig

export function NetCashFlowChart({
  data,
}: Readonly<{ data: { month: string; net: number }[] }>) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} stroke="var(--surface-line)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="net"
          type="monotone"
          stroke="var(--color-net)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-net)" }}
        />
      </LineChart>
    </ChartContainer>
  )
}
