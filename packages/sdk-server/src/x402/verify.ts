import type { PaymentPayload, PaymentRequirements, RouteInfo, VerifyResponse } from "./types.js"

/**
 * Call the facilitator's POST /verify endpoint to validate a payment.
 * Sends the API key and route info for platform authentication.
 */
export async function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  apiKey: string,
  route: RouteInfo,
): Promise<VerifyResponse> {
  try {
    const res = await fetch(`${requirements.facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, requirements, apiKey, route }),
    })

    if (!res.ok) {
      return { valid: false, error: `Facilitator returned status ${res.status}` }
    }

    return (await res.json()) as VerifyResponse
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { valid: false, error: `Verification failed: ${message}` }
  }
}
