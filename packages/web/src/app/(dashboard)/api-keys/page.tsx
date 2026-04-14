"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Copy, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [name, setName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generateError, setGenerateError] = useState("")
  const [revokeError, setRevokeError] = useState("")
  const [fetchError, setFetchError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFetchError(null)
    try {
      const res = await fetch("/api/api-keys")
      if (!res.ok) {
        setFetchError("Failed to load API keys.")
        setKeys([])
        return
      }
      const rows = await res.json() as unknown
      setKeys(Array.isArray(rows) ? (rows as ApiKey[]) : [])
    } catch {
      setFetchError("Failed to load API keys.")
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleGenerate() {
    if (!name.trim()) return
    setGenerateError("")
    setSaving(true)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const msg = await res.text()
        setGenerateError(msg.length > 100 ? "An error occurred. Please try again." : msg)
        return
      }
      const data = await res.json() as { key: string }
      setNewKey(data.key)
      setName("")
      load()
    } catch {
      setGenerateError("Request failed. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  function copy() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey).catch(console.error)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevoke() {
    if (!revokeId) return
    setRevokeError("")
    try {
      const res = await fetch(`/api/api-keys/${revokeId}`, { method: "DELETE" })
      if (!res.ok) { setRevokeError("Failed to revoke key."); return }
      setRevokeId(null)
      load()
    } catch {
      setRevokeError("Request failed.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">API Keys</h1>
        <Button size="sm" onClick={() => { setShowDialog(true); setNewKey(null); setGenerateError("") }}>
          <Plus className="h-4 w-4 mr-1" />Generate key
        </Button>
      </div>

      {fetchError && <p role="alert" className="text-red-400 text-sm">{fetchError}</p>}

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="text-left p-4 font-normal">Name</th>
                <th className="text-left p-4 font-normal">Key prefix</th>
                <th className="text-left p-4 font-normal">Created</th>
                <th className="text-left p-4 font-normal">Last used</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-white/5 text-white/70">
                  <td className="p-4">{k.name}</td>
                  <td className="p-4 font-mono text-xs">{k.prefix}…</td>
                  <td className="p-4 text-white/40 text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-white/40 text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                  <td className="p-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => { setRevokeId(k.id); setRevokeError("") }}
                      aria-label={`Revoke key ${k.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && !fetchError && (
                <tr><td colSpan={5} className="p-8 text-center text-white/30">No API keys yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Generate dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Generate API key">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Generate API key</h2>
            {!newKey ? (
              <>
                <div>
                  <Label htmlFor="key-name" className="text-white/70 text-xs">Key name</Label>
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My key"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                    onKeyDown={(e) => { if (e.key === "Enter") handleGenerate() }}
                  />
                </div>
                {generateError && <p role="alert" className="text-red-400 text-sm mt-2">{generateError}</p>}
                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
                  <Button type="button" onClick={handleGenerate} disabled={saving || !name.trim()}>
                    {saving ? "Generating…" : "Generate"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-white/50 text-sm mb-3">Copy your key now — it will not be shown again.</p>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                  <code className="flex-1 text-xs text-green-400 break-all">{newKey}</code>
                  <Button type="button" variant="ghost" size="icon" onClick={copy} aria-label="Copy key">
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex justify-end mt-4">
                  <Button type="button" onClick={() => setShowDialog(false)}>Done</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revoke confirm */}
      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm revoke">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">Revoke key?</h2>
            <p className="text-white/50 text-sm mb-4">Requests using this key will stop working immediately.</p>
            {revokeError && <p role="alert" className="text-red-400 text-sm mb-3">{revokeError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRevokeId(null)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={handleRevoke}>Revoke</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
