import Fastify from "fastify"
import { kovaPlugin } from "@onkova/sdk-server"
import type { StellarNetwork } from "@onkova/sdk-server"
import { config as dotenvConfig } from "dotenv"
dotenvConfig({ path: "../../.env" })

const PORT = parseInt(process.env.PORT ?? "4022", 10)
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4021"
const PAY_TO = process.env.PAY_TO ?? ""
const NETWORK = (process.env.NETWORK ?? "testnet") as StellarNetwork
const KOVA_API_KEY = process.env.KOVA_API_KEY ?? ""

if (!PAY_TO || !/^G[A-Z2-7]{55}$/.test(PAY_TO)) {
  console.error("Error: PAY_TO must be a valid Stellar public key (starts with G, 56 chars)")
  process.exit(1)
}

if (!KOVA_API_KEY) {
  console.error("Error: KOVA_API_KEY is required. Get one from the Kova dashboard.")
  process.exit(1)
}

const app = Fastify({ logger: true })

await app.register(kovaPlugin, {
  apiKey: KOVA_API_KEY,
  facilitatorUrl: FACILITATOR_URL,
  payTo: PAY_TO,
  network: NETWORK,
  routes: [
    {
      method: "GET",
      path: "/api/weather",
      price: "$0.001",
      description: "Get current weather data",
    },
  ],
})

app.get("/api/weather", async () => {
  return { weather: "sunny", temp: 72 }
})

app.get("/health", async () => {
  return { status: "ok" }
})

await app.listen({ port: PORT, host: "0.0.0.0" })
console.log(`Weather API running on http://localhost:${PORT}`)
