export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black pt-20">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-4">Quick Start</h1>
        <p className="text-white/60 mb-12 text-lg">Get paid API responses in minutes.</p>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">1. Install the server SDK</h2>
          <pre className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 overflow-x-auto">
            <code>pnpm add @onkova/sdk-server</code>
          </pre>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">2. Protect a route (Fastify)</h2>
          <pre className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 overflow-x-auto">
            <code>{`import Fastify from "fastify"
import { kovaPlugin } from "@onkova/sdk-server"

const app = Fastify()

app.register(kovaPlugin, {
  apiKey: process.env.KOVA_API_KEY,
  payTo: "GCEZ...YOUR_STELLAR_ADDRESS",
  facilitatorUrl: "https://facilitator.onkova.io",
  network: "testnet",
  routes: {
    "GET /api/data": { price: "$0.001", description: "Fetch data" },
  },
})

app.get("/api/data", async () => ({ data: "hello" }))
app.listen({ port: 3001 })`}</code>
          </pre>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">3. Call from an AI agent</h2>
          <pre className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 overflow-x-auto">
            <code>{`import { KovaClient } from "@onkova/sdk-client"

const client = new KovaClient({
  stellarSecret: process.env.STELLAR_SECRET,
  network: "testnet",
  maxPaymentPerRequest: "$0.01",
})

const res = await client.fetch("http://localhost:3001/api/data")
const data = await res.json()
console.log(data) // { data: "hello" }
console.log(client.getSpending()) // { totalSpent, requestsCount }`}</code>
          </pre>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">4. Express support</h2>
          <pre className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 overflow-x-auto">
            <code>{`import express from "express"
import { kovaMiddleware } from "@onkova/sdk-server"

const app = express()

app.use(kovaMiddleware({
  apiKey: process.env.KOVA_API_KEY,
  payTo: "GCEZ...YOUR_STELLAR_ADDRESS",
  routes: {
    "GET /api/data": { price: "$0.001" },
  },
}))

app.get("/api/data", (req, res) => res.json({ data: "hello" }))
app.listen(3001)`}</code>
          </pre>
        </section>
      </div>
    </div>
  )
}
