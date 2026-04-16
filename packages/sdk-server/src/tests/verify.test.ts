import { describe, it, expect, vi, beforeEach } from "vitest"
import { verifyPayment } from "../x402/verify.js"
import type { PaymentPayload, PaymentRequirements, RouteInfo } from "../x402/types.js"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

const PAYLOAD: PaymentPayload = {
  scheme: "x402",
  network: "testnet",
  authEntry: "base64xdr==",
  from: "GABC1234567890123456789012345678901234567890123456789012",
}

const REQUIREMENTS: PaymentRequirements = {
  scheme: "x402",
  network: "testnet",
  maxAmountRequired: "0.001",
  asset: {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  },
  payTo: "GPAY1234567890123456789012345678901234567890123456789012",
  facilitatorUrl: "http://localhost:4021",
  maxLedgerOffset: 12,
}

const API_KEY = "kova_test_key_abc123"

const ROUTE: RouteInfo = {
  method: "GET",
  path: "/api/weather",
}

describe("verifyPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns valid=true when facilitator confirms", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ valid: true, context: { userId: "u1", endpointId: "e1" } }),
    })

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS, API_KEY, ROUTE)

    expect(result).toEqual({ valid: true, context: { userId: "u1", endpointId: "e1" } })
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4021/verify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: PAYLOAD, requirements: REQUIREMENTS, apiKey: API_KEY, route: ROUTE }),
      }),
    )
  })

  it("returns valid=false with error from facilitator", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ valid: false, error: "Amount too low" }),
    })

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS, API_KEY, ROUTE)

    expect(result).toEqual({ valid: false, error: "Amount too low" })
  })

  it("returns valid=false when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS, API_KEY, ROUTE)

    expect(result).toEqual({ valid: false, error: "Verification failed: Network error" })
  })

  it("returns valid=false when response is not ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })

    const result = await verifyPayment(PAYLOAD, REQUIREMENTS, API_KEY, ROUTE)

    expect(result).toEqual({ valid: false, error: "Facilitator returned status 500" })
  })
})
