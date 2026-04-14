import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions, endpoints } from "../../../../drizzle/schema"
import { eq, desc, and, sql } from "drizzle-orm"

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = session.user.id
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)
  const offset = parseInt(searchParams.get("offset") ?? "0")
  const endpointId = searchParams.get("endpointId")
  const statusFilter = searchParams.get("status")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [eq(transactions.userId, userId)]
  if (endpointId) conditions.push(eq(transactions.endpointId, endpointId))
  if (statusFilter) conditions.push(eq(transactions.status, statusFilter as "pending" | "settled" | "failed"))
  if (from) conditions.push(sql`${transactions.createdAt} >= ${new Date(from)}`)
  if (to) conditions.push(sql`${transactions.createdAt} <= ${new Date(to)}`)

  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      payerAddress: transactions.payerAddress,
      txHash: transactions.txHash,
      status: transactions.status,
      createdAt: transactions.createdAt,
      endpointId: transactions.endpointId,
      endpointPath: endpoints.path,
      endpointMethod: endpoints.method,
    })
    .from(transactions)
    .leftJoin(endpoints, eq(transactions.endpointId, endpoints.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset)

  if (searchParams.get("format") === "csv") {
    const csv = [
      "id,amount,payerAddress,txHash,status,createdAt,endpointPath",
      ...rows.map((r) =>
        [r.id, r.amount, r.payerAddress, r.txHash ?? "", r.status, r.createdAt.toISOString(), r.endpointPath ?? ""].join(",")
      ),
    ].join("\n")
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="transactions-${Date.now()}.csv"`,
      },
    })
  }

  return Response.json({ rows, limit, offset })
}
