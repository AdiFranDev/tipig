"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutGrid,
  ArrowRightLeft,
  BarChart2,
  Landmark,
  PiggyBank,
  Calendar,
  Settings,
  Search,
  LogOut,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"

const LEDGER_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/savings", label: "Savings", icon: PiggyBank },
] as const

const REVIEW_ITEMS = [
  { href: "/annual", label: "Annual", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

export const NAV_ITEMS = [...LEDGER_ITEMS, ...REVIEW_ITEMS]

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar({ email, name }: Readonly<{ email: string; name: string }>) {
  const pathname = usePathname()
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState("")
  const initials = name.slice(0, 2).toUpperCase()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && search.trim()) {
      router.push(`/transactions?q=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-foreground">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-5 shrink-0 text-emerald-500" />
            <span className="text-lg font-bold group-data-[collapsible=icon]:hidden">Tipig</span>
          </div>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>

      <div className="px-2 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search ledger"
            className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
          <kbd className="shrink-0 rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Ledger
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {LEDGER_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isNavItemActive(pathname, item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                    className="data-active:bg-emerald-500/10 data-active:text-emerald-500"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Review
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {REVIEW_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isNavItemActive(pathname, item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                    className="data-active:bg-emerald-500/10 data-active:text-emerald-500"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-100">
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out">
                <LogOut size={16} className="text-muted-foreground" />
              </Button>
            </form>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
