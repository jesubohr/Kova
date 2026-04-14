"use client"

import { useEffect, useState, useCallback } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface Transaction {
  id: string
  amount: string
  payerAddress: string
  txHash: string | null
  status: "pending" | "settled" | "failed"
  createdAt: string
  endpointPath: string | null
  endpointMethod: string | null
}

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  settled: "default",
  pending: "secondary",
  failed: "destructive",
}

const PAGE_SIZE = 20

export default function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [fetchError, setFetchError] = useState<string | null>(null)

  const load = useCallback(async (off: number) => {
    setFetchError(null)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) })
    if (status) params.set("status", status)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    try {
      const data = await fetch(`/api/transactions?${params}`).then((r) => r.json())
      setRows(data.rows ?? [])
      setHasMore((data.rows ?? []).length === PAGE_SIZE)
    } catch {
      setFetchError("Failed to load transactions. Please try again.")
      setRows([])
      setHasMore(false)
    }
  }, [status, from, to])

  useEffect(() => {
    setOffset(0)
    load(0)
  }, [load])

  function prev() {
    const o = Math.max(0, offset - PAGE_SIZE)
    setOffset(o)
    load(o)
  }

  function next() {
    const o = offset + PAGE_SIZE
    setOffset(o)
    load(o)
  }

  function exportCsv() {
    const params = new URLSearchParams({ format: "csv", limit: "1000", offset: "0" })
    if (status) params.set("status", status)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    window.open(`/api/transactions?${params}`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" />Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="settled">Settled</option>
          <option value="failed">Failed</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50" htmlFor="from-date">From</label>
          <Input
            id="from-date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40 bg-white/5 border-white/10 text-white text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50" htmlFor="to-date">To</label>
          <Input
            id="to-date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40 bg-white/5 border-white/10 text-white text-sm"
          />
        </div>
      </div>

      {fetchError && <p role="alert" className="text-red-400 text-sm">{fetchError}</p>}

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="text-left p-4 font-normal">Time</th>
                <th className="text-left p-4 font-normal">Endpoint</th>
                <th className="text-left p-4 font-normal">Amount</th>
                <th className="text-left p-4 font-normal">Payer</th>
                <th className="text-left p-4 font-normal">Tx hash</th>
                <th className="text-left p-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 text-white/70">
                  <td className="p-4 text-white/40 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                  <td className="p-4 font-mono text-xs">{tx.endpointMethod} {tx.endpointPath ?? "—"}</td>
                  <td className="p-4">${parseFloat(tx.amount).toFixed(4)}</td>
                  <td className="p-4 font-mono text-xs">{(tx.payerAddress ?? "").slice(0, 8) || "—"}…</td>
                  <td className="p-4">
                    {tx.txHash ? (
                      <a
                        href={`https://stellar.expert/explorer/${process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet"}/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-400 hover:underline"
                      >
                        {tx.txHash.slice(0, 8)}…
                      </a>
                    ) : "—"}
                  </td>
                  <td className="p-4">
                    <Badge variant={statusVariant[tx.status]}>{tx.status}</Badge>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-white/30">No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-white/40">
        <Button variant="ghost" size="sm" onClick={prev} disabled={offset === 0}>← Previous</Button>
        <span>
          {rows.length === 0
            ? "No results"
            : `Showing ${offset + 1}–${offset + rows.length}`}
        </span>
        <Button variant="ghost" size="sm" onClick={next} disabled={!hasMore}>Next →</Button>
      </div>
    </div>
  )
}
