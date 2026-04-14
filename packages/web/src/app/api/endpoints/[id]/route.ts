import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { endpoints } from "../../../../../drizzle/schema"
import { eq, and } from "drizzle-orm"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const body = await request.json() as {
    method?: string
    path?: string
    price?: unknown
    description?: string | null
    status?: string
  }
  const { method, path, price, description, status } = body

  const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]
  if (method && !VALID_METHODS.includes(method)) {
    return new Response("Invalid method", { status: 400 })
  }

  const priceNum = price !== undefined ? Number(price) : undefined
  if (priceNum !== undefined && (isNaN(priceNum) || priceNum < 0)) {
    return new Response("price must be a non-negative number", { status: 400 })
  }

  const [updated] = await db
    .update(endpoints)
    .set({
      ...(method && { method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" }),
      ...(path && { path }),
      ...(priceNum !== undefined && { price: String(priceNum) }),
      ...(description !== undefined && { description }),
      ...(status && { status: status as "active" | "paused" }),
      updatedAt: new Date(),
    })
    .where(and(eq(endpoints.id, id), eq(endpoints.userId, session.user.id)))
    .returning()

  if (!updated) return new Response("Not found", { status: 404 })
  return Response.json(updated)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { id } = await params

  await db
    .delete(endpoints)
    .where(and(eq(endpoints.id, id), eq(endpoints.userId, session.user.id)))

  return new Response(null, { status: 204 })
}
