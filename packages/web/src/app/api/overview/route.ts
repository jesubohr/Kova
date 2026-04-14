import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { transactions } from "../../../../drizzle/schema"
import { eq, sum, count, sql } from "drizzle-orm"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = session.user.id
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [allTime] = await db
    .select({ revenue: sum(transactions.amount), txCount: count() })
    .from(transactions)
    .where(eq(transactions.userId, userId))

  const [last30d] = await db
    .select({ revenue: sum(transactions.amount), txCount: count() })
    .from(transactions)
    .where(sql`${transactions.userId} = ${userId} AND ${transactions.createdAt} >= ${thirtyDaysAgo}`)

  const daily = await db
    .select({
      date: sql<string>`DATE(${transactions.createdAt})`,
      revenue: sum(transactions.amount),
    })
    .from(transactions)
    .where(sql`${transactions.userId} = ${userId} AND ${transactions.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(sql`DATE(${transactions.createdAt})`)
    .orderBy(sql`DATE(${transactions.createdAt})`)

  return Response.json({
    allTimeRevenue: allTime?.revenue ?? "0",
    allTimeTxCount: allTime?.txCount ?? 0,
    last30dRevenue: last30d?.revenue ?? "0",
    last30dTxCount: last30d?.txCount ?? 0,
    dailyRevenue: daily,
  })
}
