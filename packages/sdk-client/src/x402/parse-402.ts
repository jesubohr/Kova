import type { PaymentRequirements } from "./types.js"

export class Parse402Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = "Parse402Error"
  }
}

/**
 * Parse and validate an HTTP 402 response body into PaymentRequirements.
 * Throws Parse402Error if body is malformed or has unsupported values.
 */
export function parse402Response(body: unknown): PaymentRequirements {
  if (!body || typeof body !== "object") {
    throw new Parse402Error("Invalid 402 body: not an object")
  }

  const obj = body as Record<string, unknown>

  if (obj.error !== "payment_required") {
    throw new Parse402Error(`Invalid 402 body: expected error="payment_required", got "${String(obj.error)}"`)
  }

  if (!obj.requirements || typeof obj.requirements !== "object") {
    throw new Parse402Error("Invalid 402 body: missing requirements")
  }

  const req = obj.requirements as Record<string, unknown>

  if (req.scheme !== "x402") {
    throw new Parse402Error(`Unsupported scheme: "${String(req.scheme)}"`)
  }

  if (req.network !== "testnet" && req.network !== "mainnet") {
    throw new Parse402Error(`Unsupported network: "${String(req.network)}"`)
  }

  if (!req.payTo || typeof req.payTo !== "string") {
    throw new Parse402Error("Missing or empty payTo address")
  }

  const asset = req.asset as Record<string, unknown> | undefined
  if (!asset || !asset.contractId) {
    throw new Parse402Error("Missing or empty asset.contractId")
  }

  return obj.requirements as PaymentRequirements
}
