import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "../../../../drizzle/schema"
import { eq } from "drizzle-orm"
import { isValidStellarAddress, getStellarUSDCBalance, getStellarExplorerAddressUrl } from "@/lib/stellar"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const [u] = await db
    .select({ stellarAddress: user.stellarAddress })
    .from(user)
    .where(eq(user.id, session.user.id))

  const address = u?.stellarAddress ?? null
  let balance: string | null = null
  let explorerUrl: string | null = null

  if (address) {
    balance = await getStellarUSDCBalance(address, "testnet")
    explorerUrl = getStellarExplorerAddressUrl(address, "testnet")
  }

  return Response.json({ address, balance, explorerUrl })
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response("Unauthorized", { status: 401 })

  const body = await request.json() as { address?: unknown }
  const { address } = body

  if (typeof address !== "string" || !address.trim()) {
    return new Response("address must be a non-empty string", { status: 400 })
  }

  const trimmedAddress = address.trim()

  if (!isValidStellarAddress(trimmedAddress)) {
    return new Response("Invalid Stellar address (must start with G and be 56 characters)", { status: 400 })
  }

  await db
    .update(user)
    .set({ stellarAddress: trimmedAddress, updatedAt: new Date() })
    .where(eq(user.id, session.user.id))

  return Response.json({ address: trimmedAddress })
}
