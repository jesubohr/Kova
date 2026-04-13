import type { PaymentPayload } from "./x402/types.js"

/**
 * Convert decimal string (e.g. "0.001") to Stellar stroops (bigint, 7 decimals).
 */
export function decimalToStroops(decimal: string): bigint {
  const [whole, frac = ""] = decimal.split(".")
  const fracPadded = frac.padEnd(7, "0").slice(0, 7)
  return BigInt(whole) * 10_000_000n + BigInt(fracPadded)
}

/**
 * Encode a PaymentPayload as base64 string for X-PAYMENT header.
 */
export function encodePaymentHeader(payload: PaymentPayload): string {
  const json = JSON.stringify(payload)
  return Buffer.from(json, "utf-8").toString("base64")
}

/**
 * Decode a base64 X-PAYMENT header back to PaymentPayload.
 * Returns null if decoding or parsing fails.
 */
export function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const json = Buffer.from(header, "base64").toString("utf-8")
    return JSON.parse(json) as PaymentPayload
  } catch {
    return null
  }
}
