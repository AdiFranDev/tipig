"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const MonthlyBarChart = dynamic(
  () => import("./monthly-bar-chart").then((mod) => mod.MonthlyBarChart),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)

export { MonthlyBarChart }
