'use client'

// WMS Phase 9 task 9.6 — Putaway: nhập LPN → suggest 3 bins → confirm.

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Suggestion {
  bin: { id: string; bin_code: string; capacity_pallets: number; velocity_class?: string }
  occupied_pallets: number
  free_slots: number
  score: number
  reason: string
}

interface Pallet {
  lpn_code: string
  warehouse_id: string
  product_id: string
  product_name?: string
  product_sku?: string
  lot_id: string
  batch_number?: string
  expiry_date?: string
  qty: number
  current_bin_code?: string
}

export default function PutawayPage() {
  const [lpn, setLpn] = useState('')
  const [pallet, setPallet] = useState<Pallet | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [chosenBin, setChosenBin] = useState('')
  const [busy, setBusy] = useState(false)

  const lookup = async () => {
    setBusy(true)
    setSuggestions([])
    setPallet(null)
    try {
      const r: any = await apiFetch(`/warehouse/pallets/${encodeURIComponent(lpn.trim())}`)
      setPallet(r.data)
      const s: any = await apiFetch('/warehouse/inbound/suggest-bin', {
        method: 'POST',
        body: {
          warehouse_id: r.data.warehouse_id,
          product_id: r.data.product_id,
          lot_id: r.data.lot_id,
          qty: r.data.qty,
        },
      })
      setSuggestions(s.data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const confirmPut = async (binCode: string) => {
    setBusy(true)
    try {
      const isOverride = !!override && !suggestions.some(s => s.bin.bin_code === binCode)
      if (isOverride && !reason.trim()) {
        toast.error('Override yêu cầu lý do')
        setBusy(false)
        return
      }
      await apiFetch('/warehouse/inbound/putaway', {
        method: 'POST',
        body: { lpn: pallet!.lpn_code, bin_code: binCode, override: isOverride, reason: isOverride ? reason : undefined },
      })
      toast.success(`Đã đặt ${pallet!.lpn_code} vào ${binCode}`)
      setLpn('')
      setPallet(null)
      setSuggestions([])
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🏷 Putaway — Đặt pallet vào bin</h1>

      <div className="bg-white rounded shadow p-4 mb-4 flex gap-2">
        <input className="flex-1 border rounded px-3 py-2 font-mono" placeholder="Quét/nhập LPN"
          value={lpn} onChange={e => setLpn(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') lookup() }} />
        <button onClick={lookup} disabled={busy || !lpn}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          Tra cứu
        </button>
      </div>

      {pallet && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-4">
          <div className="font-mono font-bold">{pallet.lpn_code}</div>
          <div className="text-sm">{pallet.product_name} · Lô {pallet.batch_number} · HSD {pallet.expiry_date} · {pallet.qty} đơn vị</div>
          {pallet.current_bin_code && (
            <div className="text-xs text-gray-600">Đang ở bin {pallet.current_bin_code} (sẽ chuyển)</div>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="bg-white rounded shadow p-4 mb-4">
          <h2 className="font-semibold mb-2">Bin gợi ý (xếp hạng)</h2>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={s.bin.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <span className="font-bold">#{i + 1}</span> <span className="font-mono ml-2">{s.bin.bin_code}</span>
                  <span className="ml-2 text-xs bg-gray-200 px-2 rounded">score {s.score}</span>
                  <div className="text-xs text-gray-600">{s.bin.velocity_class && `Vel ${s.bin.velocity_class} · `}{s.occupied_pallets}/{s.bin.capacity_pallets} chiếm · {s.reason}</div>
                </div>
                <button onClick={() => confirmPut(s.bin.bin_code)} disabled={busy}
                  className="px-3 py-1 bg-green-600 text-white rounded">Chọn</button>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t pt-3">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} />
              Override (chọn bin khác — ghi lý do)
            </label>
            {override && (
              <div className="mt-2 flex gap-2">
                <input className="flex-1 border rounded px-2 py-1" placeholder="Bin code khác" value={chosenBin} onChange={e => setChosenBin(e.target.value)} />
                <input className="flex-1 border rounded px-2 py-1" placeholder="Lý do" value={reason} onChange={e => setReason(e.target.value)} />
                <button onClick={() => confirmPut(chosenBin)} disabled={busy || !chosenBin}
                  className="px-3 py-1 bg-orange-600 text-white rounded">Override</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
