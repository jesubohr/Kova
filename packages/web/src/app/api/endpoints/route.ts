import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { endpoints } from "../../../../drizzle/schema"
import { eq } from "drizzle-orm"
import { randomUUID } from "crypto"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const rows = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.userId, session.user.id))
    .orderBy(endpoints.createdAt)

  return Response.json(rows)
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const body = await request.json() as {
    method?: string
    path?: string
    price?: unknown
    description?: string
    status?: string
  }
  const { method, path, price, description, status } = body

  if (!method || !path || price === undefined || price === null) {
    return new Response("method, path, price required", { status: 400 })
  }

  const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]
  if (!VALID_METHODS.includes(method)) {
    return new Response("Invalid method", { status: 400 })
  }

  const priceNum = Number(price)
  if (isNaN(priceNum) || priceNum < 0) {
    return new Response("price must be a non-negative number", { status: 400 })
  }

  const [created] = await db
    .insert(endpoints)
    .values({
      id: randomUUID(),
      userId: session.user.id,
      method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      path,
      price: String(priceNum),
      description: description ?? null,
      status: (status === "paused" ? "paused" : "active") as "active" | "paused",
    })
    .returning()

  return Response.json(created, { status: 201 })
}
