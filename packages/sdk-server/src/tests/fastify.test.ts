import { describe, it, expect, vi, beforeEach } from "vitest"
import Fastify from "fastify"

vi.mock("../x402/verify.js", () => ({
  verifyPayment: vi.fn(),
}))

vi.mock("../x402/settle.js", () => ({
  settlePayment: vi.fn(),
}))

import { kovaPlugin } from "../middleware/fastify.js"
import { verifyPayment } from "../x402/verify.js"
import { settlePayment } from "../x402/settle.js"
import type { KovaServerOptions } from "../config.js"

const OPTIONS: KovaServerOptions = {
  apiKey: "kova_test_key_abc123",
  facilitatorUrl: "http://localhost:4021",
  payTo: "GPAY1234567890123456789012345678901234567890123456789012",
  network: "testnet",
  routes: [{ method: "GET", path: "/api/weather", price: "$0.001" }],
}

describe("kovaPlugin (Fastify)", () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = Fastify()
    await app.register(kovaPlugin, OPTIONS)

    app.get("/api/weather", async () => ({ weather: "sunny" }))
    app.get("/api/free", async () => ({ free: true }))

    await app.ready()
  })

  it("returns 402 when no X-PAYMENT header on protected route", async () => {
    const res = await app.inject({ method: "GET", url: "/api/weather" })

    expect(res.statusCode).toBe(402)
    const body = res.json()
    expect(body.error).toBe("payment_required")
    expect(body.requirements.maxAmountRequired).toBe("0.001")
  })

  it("passes through unprotected routes without payment", async () => {
    const res = await app.inject({ method: "GET", url: "/api/free" })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ free: true })
  })

  it("returns 402 when verification fails", async () => {
    vi.mocked(verifyPayment).mockResolvedValue({ valid: false, error: "Bad auth" })

    const payment = Buffer.from(
      JSON.stringify({
        scheme: "x402",
        network: "testnet",
        authEntry: "base64==",
        from: "GABC...",
      }),
    ).toString("base64")

    const res = await app.inject({
      method: "GET",
      url: "/api/weather",
      headers: { "x-payment": payment },
    })

    expect(res.statusCode).toBe(402)
    expect(res.json().error).toBe("payment_required")
  })

  it("passes through and settles when verification succeeds", async () => {
    vi.mocked(verifyPayment).mockResolvedValue({
      valid: true,
      context: { userId: "u1", endpointId: "e1" },
    })
    vi.mocked(settlePayment).mockResolvedValue(undefined)

    const payment = Buffer.from(
      JSON.stringify({
        scheme: "x402",
        network: "testnet",
        authEntry: "base64==",
        from: "GABC...",
      }),
    ).toString("base64")

    const res = await app.inject({
      method: "GET",
      url: "/api/weather",
      headers: { "x-payment": payment },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ weather: "sunny" })
    expect(verifyPayment).toHaveBeenCalledOnce()
    expect(settlePayment).toHaveBeenCalledOnce()
  })

  it("returns 402 when X-PAYMENT header is not valid base64 JSON", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/weather",
      headers: { "x-payment": "not-valid-base64!!!" },
    })

    expect(res.statusCode).toBe(402)
  })
})
