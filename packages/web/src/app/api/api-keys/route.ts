import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiKeys } from "../../../../drizzle/schema"
import { eq, isNull, and } from "drizzle-orm"
import { randomBytes, createHash } from "crypto"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, session.user.id), isNull(apiKeys.revokedAt)))
    .orderBy(apiKeys.createdAt)

  return Response.json(rows)
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const body = await request.json() as { name?: string }
  const { name } = body

  if (!name?.trim()) return new Response("name required", { status: 400 })

  const rawKey = "kova_" + randomBytes(16).toString("hex")
  const prefix = rawKey.substring(0, 12)
  const hash = createHash("sha256").update(rawKey).digest("hex")

  const [created] = await db
    .insert(apiKeys)
    .values({
      id: randomBytes(8).toString("hex"),
      userId: session.user.id,
      name: name.trim(),
      prefix,
      hash,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
    })

  return Response.json({ ...created, key: rawKey }, { status: 201 })
}
