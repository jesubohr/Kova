"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface OverviewData {
  allTimeRevenue: string
  allTimeTxCount: number
  last30dRevenue: string
  last30dTxCount: number
  dailyRevenue: Array<{ date: string; revenue: string }>
}

interface RecentTx {
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

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewData | null>(null)
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([])

  useEffect(() => {
    fetch("/api/overview").then((r) => r.json()).then(setStats)
    fetch("/api/transactions?limit=10").then((r) => r.json()).then((d) => setRecentTxs(d.rows ?? []))
  }, [])

  const chartData = stats?.dailyRevenue.map((d) => ({
    date: d.date.slice(5),
    revenue: parseFloat(d.revenue ?? "0"),
  })) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "All-time revenue", value: `$${parseFloat(stats?.allTimeRevenue ?? "0").toFixed(4)}` },
          { label: "All-time transactions", value: stats?.allTimeTxCount ?? "—" },
          { label: "30d revenue", value: `$${parseFloat(stats?.last30dRevenue ?? "0").toFixed(4)}` },
          { label: "30d transactions", value: stats?.last30dTxCount ?? "—" },
        ].map((s) => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-white/50 font-normal">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-sm font-medium">Revenue — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-sm font-medium">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/10">
                <th className="text-left pb-2 font-normal">Endpoint</th>
                <th className="text-left pb-2 font-normal">Amount</th>
                <th className="text-left pb-2 font-normal">Payer</th>
                <th className="text-left pb-2 font-normal">Status</th>
                <th className="text-left pb-2 font-normal">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTxs.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 text-white/70">
                  <td className="py-2">{tx.endpointMethod} {tx.endpointPath ?? "—"}</td>
                  <td className="py-2">${parseFloat(tx.amount).toFixed(4)}</td>
                  <td className="py-2 font-mono text-xs">{tx.payerAddress.slice(0, 8)}…</td>
                  <td className="py-2">
                    <Badge variant={statusVariant[tx.status]}>{tx.status}</Badge>
                  </td>
                  <td className="py-2 text-white/40">{new Date(tx.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentTxs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/30">No transactions yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
