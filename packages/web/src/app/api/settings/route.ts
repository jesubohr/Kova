import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "../../../../drizzle/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const [u] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!u) return new Response("Not found", { status: 404 })

  return Response.json(u)
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  let body: { name?: unknown }
  try {
    body = await request.json() as { name?: unknown }
  } catch {
    return new Response("Invalid request body", { status: 400 })
  }

  const { name } = body

  if (typeof name !== "string" || !name.trim()) {
    return new Response("name must be a non-empty string", { status: 400 })
  }

  const trimmedName = name.trim()

  await db
    .update(user)
    .set({ name: trimmedName, updatedAt: new Date() })
    .where(eq(user.id, session.user.id))

  return Response.json({ name: trimmedName })
}
