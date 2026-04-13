import Fastify from "fastify"
import cors from "@fastify/cors"
import rateLimit from "@fastify/rate-limit"
import { config } from "./config.js"
import { supportedRoute } from "./routes/supported.js"
import { verifyRoute } from "./routes/verify.js"
import { settleRoute } from "./routes/settle.js"

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
})

await app.register(supportedRoute)
await app.register(verifyRoute)
await app.register(settleRoute)

await app.listen({ port: config.port, host: "0.0.0.0" })
