import type { PaymentPayload, PaymentRequirements } from "./types.js"
import type { SignedAuthEntry } from "../wallet/types.js"

/**
 * Build a PaymentPayload from payment requirements and a signed auth entry.
 */
export function buildPaymentPayload(requirements: PaymentRequirements, signed: SignedAuthEntry): PaymentPayload {
  return {
    scheme: requirements.scheme,
    network: requirements.network,
    authEntry: signed.authEntryBase64,
    from: signed.publicKey,
  }
}
