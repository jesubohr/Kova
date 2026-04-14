import Link from "next/link"
import { Button } from "@/components/ui/button"

const codeSnippet = `import { kovaPlugin } from "@onkova/sdk-server"

app.register(kovaPlugin, {
  apiKey: process.env.KOVA_API_KEY,
  payTo: "GCEZ...STELLAR_ADDRESS",
  routes: {
    "GET /api/weather": { price: "$0.001" },
  },
})`

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-4">
      <div className="mx-auto max-w-6xl text-center">
        <div className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/60 mb-6">
          Built on Stellar · Sub-cent micropayments · 5s finality
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
          API Payments for the<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Agent Economy</span>
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10">
          Protect any endpoint behind an x402 paywall. AI agents pay per request — no subscriptions, no keys, no friction.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Button size="lg" render={<Link href="/signup" />}>
            Start monetizing →
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/docs" />}>
            Read the docs
          </Button>
        </div>
        <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/5 p-4 text-left">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-red-500/70" />
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-2 text-xs text-white/30">server.ts</span>
          </div>
          <pre className="text-sm text-white/80 overflow-x-auto">
            <code>{codeSnippet}</code>
          </pre>
        </div>
      </div>
    </section>
  )
}
