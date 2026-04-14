import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Navbar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <span className="text-lg tracking-tight">Kova</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
          <Link href="#how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="#why-stellar" className="hover:text-white transition-colors">Why Stellar</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/login" />}>
            Log in
          </Button>
          <Button size="sm" render={<Link href="/signup" />}>
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  )
}
