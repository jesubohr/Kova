import { eq, and } from "drizzle-orm"
import { db } from "../db/connection.js"
import { user, endpoints } from "../db/schema.js"

export interface EndpointValidation {
  valid: boolean
  endpointId?: string
  error?: string
}

export async function validateEndpoint(
  userId: string,
  payTo: string,
  method: string,
  path: string,
  price: string,
): Promise<EndpointValidation> {
  // Verify wallet matches registered address
  const [dev] = await db
    .select({ stellarAddress: user.stellarAddress })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!dev) {
    return { valid: false, error: "Developer account not found" }
  }

  if (dev.stellarAddress !== payTo) {
    return { valid: false, error: "Wallet address does not match registered address" }
  }

  // Verify endpoint is registered and active
  const [endpoint] = await db
    .select({ id: endpoints.id, price: endpoints.price })
    .from(endpoints)
    .where(
      and(
        eq(endpoints.userId, userId),
        eq(endpoints.method, method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE"),
        eq(endpoints.path, path),
        eq(endpoints.status, "active"),
      ),
    )
    .limit(1)

  if (!endpoint) {
    return { valid: false, error: "Endpoint not registered or not active" }
  }

  // Verify price matches (both are decimal strings)
  if (endpoint.price !== price) {
    return { valid: false, error: "Price does not match registered endpoint price" }
  }

  return { valid: true, endpointId: endpoint.id }
}
