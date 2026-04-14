"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Zap, ArrowLeftRight, Key, Wallet, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/endpoints", label: "Endpoints", icon: Zap },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const { error } = await authClient.signOut()
    if (!error) router.push("/login")
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/10 bg-black/50 sticky top-0">
      <div className="flex h-14 items-center px-6 border-b border-white/10">
        <Link href="/overview" className="font-bold text-white text-lg tracking-tight">Kova</Link>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-white/10 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
