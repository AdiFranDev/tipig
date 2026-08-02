import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TopNav, MobileHeader, BottomNav } from "@/components/nav-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav email={user.email ?? ""} />
      <MobileHeader />
      <main className="mx-auto max-w-4xl px-4 py-6 pb-20 md:pb-6">{children}</main>
      <BottomNav />
    </div>
  )
}
