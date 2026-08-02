"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PiggyBank } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

const NAV_ITEMS = [
  { href: "/", label: "Overview", short: "Overview" },
  { href: "/transactions", label: "Transactions", short: "Txns" },
  { href: "/accounts", label: "Accounts", short: "Accounts" },
  { href: "/savings", label: "Savings", short: "Savings" },
  { href: "/annual", label: "Annual", short: "Annual" },
  { href: "/settings", label: "Settings", short: "Settings" },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function Brand() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold text-foreground">
      <PiggyBank className="size-5" />
      Tipig
    </span>
  )
}

export function TopNav({ email }: Readonly<{ email: string }>) {
  const pathname = usePathname()

  return (
    <header className="hidden md:flex items-center justify-between border-b border-border bg-background px-6 py-3">
      <div className="flex items-center gap-8">
        <Brand />
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(pathname, item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{email}</span>
        <ThemeToggle />
        <form action="/auth/signout" method="post">
          <Button variant="ghost" size="sm" type="submit">
            Sign Out
          </Button>
        </form>
      </div>
    </header>
  )
}

export function MobileHeader() {
  return (
    <header className="flex md:hidden items-center justify-between border-b border-border bg-background px-4 py-3">
      <Brand />
      <ThemeToggle />
    </header>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
            isActive(pathname, item.href) ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {item.short}
        </Link>
      ))}
    </nav>
  )
}
