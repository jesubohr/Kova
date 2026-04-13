import { describe, it, expect } from "vitest"
import { buildPaymentPayload } from "../x402/build-payment.js"
import type { PaymentRequirements } from "../x402/types.js"
import type { SignedAuthEntry } from "../wallet/types.js"

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

const SIGNED: SignedAuthEntry = {
  authEntryBase64: "AAAA_fake_xdr_base64==",
  publicKey: "GABC1234567890123456789012345678901234567890123456789012",
}

describe("buildPaymentPayload", () => {
  it("creates PaymentPayload from requirements and signed auth entry", () => {
    const payload = buildPaymentPayload(REQUIREMENTS, SIGNED)
    expect(payload).toEqual({
      scheme: "x402",
      network: "testnet",
      authEntry: "AAAA_fake_xdr_base64==",
      from: "GABC1234567890123456789012345678901234567890123456789012",
    })
  })

  it("uses scheme and network from requirements", () => {
    const mainnetReqs = { ...REQUIREMENTS, network: "mainnet" as const }
    const payload = buildPaymentPayload(mainnetReqs, SIGNED)
    expect(payload.network).toBe("mainnet")
    expect(payload.scheme).toBe("x402")
  })
})
