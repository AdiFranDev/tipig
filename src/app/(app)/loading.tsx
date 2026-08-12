import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const KPI_KEYS = ["kpi-total", "kpi-saved", "kpi-available"]
const ROW_KEYS = ["row-1", "row-2", "row-3", "row-4"]

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {KPI_KEYS.map((key) => (
          <Card key={key}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {ROW_KEYS.map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
