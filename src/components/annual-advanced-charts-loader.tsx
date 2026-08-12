"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const CumulativeAreaChart = dynamic(
  () => import("./annual-advanced-charts").then((m) => m.CumulativeAreaChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)

const BudgetSplitBarChart = dynamic(
  () => import("./annual-advanced-charts").then((m) => m.BudgetSplitBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)

const TopCategoriesBarChart = dynamic(
  () => import("./annual-advanced-charts").then((m) => m.TopCategoriesBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)

export { CumulativeAreaChart, BudgetSplitBarChart, TopCategoriesBarChart }
