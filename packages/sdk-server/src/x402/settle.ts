import type { PaymentPayload, PaymentRequirements, RequestContext } from "./types.js"

/**
 * Call the facilitator's POST /settle endpoint.
 * This is fire-and-forget — errors are silently swallowed since
 * the API response has already been sent to the client.
 */
export async function settlePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  context: RequestContext,
): Promise<void> {
  try {
    await fetch(`${requirements.facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements, context }),
    })
  } catch {
    // Fire-and-forget: settlement errors are not surfaced to the client.
    // In production, this would log to an observability backend.
  }
}
