"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface WalletData {
  address: string | null
  balance: string | null
  explorerUrl: string | null
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData>({ address: null, balance: null, explorerUrl: null })
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d: WalletData) => {
        setWallet(d)
        setAddress(d.address ?? "")
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setError("")
    setSuccess("")
    if (!address.trim()) { setError("Address is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      if (!res.ok) {
        const msg = await res.text()
        setError(msg.length > 150 ? "An error occurred. Please try again." : msg)
        return
      }
      setSuccess("Stellar address saved.")
      // Re-fetch to update balance
      fetch("/api/wallet")
        .then((r) => r.json())
        .then((d: WalletData) => setWallet(d))
        .catch(console.error)
    } catch {
      setError("Request failed. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-white">Wallet</h1>

      {wallet.address && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/70">USDC Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-white/30 text-sm">Loading…</div>
            ) : (
              <>
                <div className="text-3xl font-bold text-white">
                  {wallet.balance !== null ? `${parseFloat(wallet.balance).toFixed(2)} USDC` : "Balance unavailable"}
                </div>
                {wallet.explorerUrl && (
                  <a
                    href={wallet.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:underline"
                  >
                    View on Stellar Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-white/70">Stellar Address (payTo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-white/40 text-xs">Payments from API requests will be sent to this address.</p>
          <div>
            <Label htmlFor="stellar-address" className="text-white/70 text-xs">Address (G…)</Label>
            <Input
              id="stellar-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="GCEZ..."
              className="mt-1 bg-white/5 border-white/10 text-white font-mono text-xs"
            />
          </div>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          {success && <p role="status" className="text-green-400 text-sm">{success}</p>}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !address.trim()}
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving…" : "Save address"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
