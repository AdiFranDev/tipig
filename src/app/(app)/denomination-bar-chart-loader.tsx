"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const DenominationBarChart = dynamic(
  () => import("./denomination-bar-chart").then((mod) => mod.DenominationBarChart),
  { ssr: false, loading: () => <Skeleton className="h-36 w-full" /> }
)

export { DenominationBarChart }
