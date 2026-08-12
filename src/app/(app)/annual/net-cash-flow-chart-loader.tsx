"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const NetCashFlowChart = dynamic(
  () => import("./net-cash-flow-chart").then((mod) => mod.NetCashFlowChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)

export { NetCashFlowChart }
