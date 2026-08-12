import type { ComponentProps } from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function ActionCard({
  icon: Icon,
  title,
  description,
  className,
  ...props
}: Readonly<{ icon: LucideIcon; title: string; description: string }> &
  ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "cursor-pointer border border-border bg-transparent transition-colors hover:bg-accent/50",
        className
      )}
      {...props}
    >
      <CardHeader>
        <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted">
          <Icon className="size-4 text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
