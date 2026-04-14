"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface Endpoint {
  id: string
  method: string
  path: string
  price: string
  description: string | null
  status: "active" | "paused"
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

interface EndpointForm {
  method: string
  path: string
  price: string
  description: string
  status: "active" | "paused"
}

const emptyForm: EndpointForm = { method: "GET", path: "", price: "", description: "", status: "active" }

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Endpoint | null>(null)
  const [form, setForm] = useState<EndpointForm>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const rows = await fetch("/api/endpoints").then((r) => r.json()).catch(() => [])
    setEndpoints(Array.isArray(rows) ? rows : [])
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm(emptyForm); setError(""); setShowDialog(true) }
  function openEdit(ep: Endpoint) {
    setEditing(ep)
    setForm({ method: ep.method, path: ep.path, price: ep.price, description: ep.description ?? "", status: ep.status })
    setError("")
    setShowDialog(true)
  }

  async function handleSave() {
    if (!form.path.trim() || !form.price) { setError("Path and price are required"); return }
    setSaving(true)
    setError("")
    try {
      const res = editing
        ? await fetch(`/api/endpoints/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : await fetch("/api/endpoints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { setError(await res.text()); return }
      setShowDialog(false)
      load()
    } catch {
      setError("Request failed. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/endpoints/${deleteId}`, { method: "DELETE" })
      if (!res.ok) {
        console.error("Delete failed:", res.status)
        return
      }
      setDeleteId(null)
      load()
    } catch {
      console.error("Delete request failed")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Endpoints</h1>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />Add endpoint</Button>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="text-left p-4 font-normal">Method</th>
                <th className="text-left p-4 font-normal">Path</th>
                <th className="text-left p-4 font-normal">Price</th>
                <th className="text-left p-4 font-normal">Description</th>
                <th className="text-left p-4 font-normal">Status</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id} className="border-b border-white/5 text-white/70">
                  <td className="p-4"><span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded">{ep.method}</span></td>
                  <td className="p-4 font-mono text-xs">{ep.path}</td>
                  <td className="p-4">${parseFloat(ep.price).toFixed(4)}</td>
                  <td className="p-4 text-white/40 text-xs">{ep.description ?? "—"}</td>
                  <td className="p-4"><Badge variant={ep.status === "active" ? "default" : "secondary"}>{ep.status}</Badge></td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ep)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(ep.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {endpoints.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-white/30">No endpoints yet. Add one to start earning.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editing ? "Edit endpoint" : "Add endpoint"}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">{editing ? "Edit endpoint" : "Add endpoint"}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs">Method</Label>
                  <select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-white/70 text-xs">Status</Label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "paused" })}
                    className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-white/70 text-xs">Path</Label>
                <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/api/resource" className="mt-1 bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Price (USD)</Label>
                <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.001" type="number" step="0.0000001" min="0" className="mt-1 bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Description (optional)</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this endpoint do?" className="mt-1 bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            {error && <p role="alert" className="text-red-400 text-sm mt-3">{error}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">Delete endpoint?</h2>
            <p className="text-white/50 text-sm mb-6">This cannot be undone. Associated transactions will remain.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
