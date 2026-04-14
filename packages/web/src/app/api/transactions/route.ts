import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions, endpoints } from "../../../../drizzle/schema"
import { eq, desc, and, sql, SQL } from "drizzle-orm"

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = session.user.id
  const { searchParams } = new URL(request.url)

  const rawLimit = parseInt(searchParams.get("limit") ?? "50")
  const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100)
  const rawOffset = parseInt(searchParams.get("offset") ?? "0")
  const offset = isNaN(rawOffset) ? 0 : rawOffset

  const endpointId = searchParams.get("endpointId")
  const statusFilter = searchParams.get("status")
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  function parseDate(value: string): Date | null {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  const fromDate = fromParam ? parseDate(fromParam) : null
  const toDate = toParam ? parseDate(toParam) : null

  if (fromParam && !fromDate) return new Response("Invalid 'from' date", { status: 400 })
  if (toParam && !toDate) return new Response("Invalid 'to' date", { status: 400 })

  const conditions: (SQL<unknown> | undefined)[] = [
    eq(transactions.userId, userId),
    endpointId ? eq(transactions.endpointId, endpointId) : undefined,
    statusFilter ? eq(transactions.status, statusFilter as "pending" | "settled" | "failed") : undefined,
    fromDate ? sql`${transactions.createdAt} >= ${fromDate}` : undefined,
    toDate ? sql`${transactions.createdAt} <= ${toDate}` : undefined,
  ]

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
