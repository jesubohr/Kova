import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "../db/connection.js"
import { apiKeys } from "../db/schema.js"

export interface ApiKeyValidation {
  valid: boolean
  userId?: string
  error?: string
}

export async function validateApiKey(rawKey: string): Promise<ApiKeyValidation> {
  const hash = createHash("sha256").update(rawKey).digest("hex")

  const [row] = await db
    .select({ userId: apiKeys.userId, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(eq(apiKeys.hash, hash))
    .limit(1)

  if (!row) {
    return { valid: false, error: "Invalid API key" }
  }

  if (row.revokedAt) {
    return { valid: false, error: "API key has been revoked" }
  }

  // Update lastUsedAt (non-blocking)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.hash, hash))
    .then(() => {}, () => {})

  return { valid: true, userId: row.userId }
}
