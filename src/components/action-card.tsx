import type { ComponentProps } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ActionCard({
  icon: Icon,
  title,
  description,
  className,
  ...props
}: Readonly<{ icon: LucideIcon; title: string; description: string }> &
  ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "group/card flex w-full flex-col gap-(--card-spacing) overflow-hidden rounded-xl border border-border bg-transparent py-(--card-spacing) text-left text-sm text-card-foreground [--card-spacing:--spacing(4)] cursor-pointer transition-colors hover:bg-accent/50",
        className
      )}
      {...props}
    >
      <div className="grid auto-rows-min items-start gap-1 px-(--card-spacing)">
        <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="font-heading text-base leading-snug font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </button>
  )
}
