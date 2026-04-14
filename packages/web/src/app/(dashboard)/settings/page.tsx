"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) { setError("Failed to load settings."); return null }
        return r.json()
      })
      .then((d) => {
        if (d) { setName(d.name ?? ""); setEmail(d.email ?? "") }
      })
      .catch(() => setError("Failed to load settings."))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Name is required"); return }
    setError("")
    setSuccess("")
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const msg = await res.text()
        setError(msg.length > 150 ? "An error occurred. Please try again." : msg)
        return
      }
      setSuccess("Settings saved.")
    } catch {
      setError("Request failed. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-white/70">Account</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-white/30 text-sm">Loading…</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="settings-name" className="text-white/70 text-xs">Name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
              <div>
                <Label htmlFor="settings-email" className="text-white/70 text-xs">Email</Label>
                <Input
                  id="settings-email"
                  value={email}
                  disabled
                  className="mt-1 bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                  aria-describedby="email-hint"
                />
                <p id="email-hint" className="text-white/30 text-xs mt-1">Email cannot be changed here.</p>
              </div>
              {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
              {success && <p role="status" className="text-green-400 text-sm">{success}</p>}
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
