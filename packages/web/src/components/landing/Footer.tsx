import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-4">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">Kova</span>
          <span className="text-white/30 text-sm">· API payments for AI agents</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <a href="https://github.com/onkova" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <Link href="/overview" className="hover:text-white transition-colors">Dashboard</Link>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>Built on</span>
          <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors font-medium">Stellar</a>
        </div>
      </div>
    </footer>
  )
}
