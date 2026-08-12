"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { NAV_ITEMS } from "@/components/app-sidebar"

const SUB_SEGMENT_LABEL: Record<string, string> = {
  edit: "Edit",
  reconcile: "Reconcile",
  categories: "Categories",
}

function currentNavItem(pathname: string) {
  if (pathname === "/") return NAV_ITEMS[0]
  return (
    [...NAV_ITEMS].reverse().find((item) => item.href !== "/" && pathname.startsWith(item.href)) ??
    NAV_ITEMS[0]
  )
}

export function AppBreadcrumbs() {
  const pathname = usePathname()
  const current = currentNavItem(pathname)
  const isSubPage = pathname !== current.href

  const segments = pathname.split("/").filter(Boolean)
  const lastSegment = segments[segments.length - 1]
  const subLabel = lastSegment ? SUB_SEGMENT_LABEL[lastSegment] : undefined

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>Tipig</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {isSubPage ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={current.href} />}>{current.label}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{subLabel ?? "Detail"}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{current.label}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
