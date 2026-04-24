'use client'

// WMS Phase 9 task 9.10 — Loading: scan biển số → scan từng LPN → load.

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Session {
  trip_id: string
  plate_number: string
  vehicle_id: string
  expected_lpns: string[]
  loaded_lpns: string[]
}

export default function LoadingPage() {
  const [tripID, setTripID] = useState('')
  const [plate, setPlate] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [scan, setScan] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const r: any = await apiFetch('/warehouse/loading/start', {
        method: 'POST',
        body: { trip_id: tripID.trim(), plate_number: plate.trim() },
      })
      setSession(r.data)
      toast.success('Phiên load bắt đầu')
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const scanLoad = async () => {
    if (!session || !scan.trim()) return
    setBusy(true)
    try {
      await apiFetch('/warehouse/loading/scan', {
        method: 'POST',
        body: { trip_id: session.trip_id, lpn: scan.trim() },
      })
      const newLoaded = Array.from(new Set([...session.loaded_lpns, scan.trim()]))
      setSession({ ...session, loaded_lpns: newLoaded })
      setScan('')
      toast.success('OK ' + scan.trim())
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const complete = async () => {
    if (!session) return
    setBusy(true)
    try {
      const r: any = await apiFetch('/warehouse/loading/complete', {
        method: 'POST', body: { trip_id: session.trip_id },
      })
      toast.success(`Hoàn tất — ${r.data.shipped_pallets} pallet shipped`)
      setSession(null)
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const remaining = session
    ? session.expected_lpns.filter(x => !session.loaded_lpns.includes(x))
    : []

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🚚 Load hàng lên xe</h1>

      {!session && (
        <div className="bg-white rounded shadow p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium">Trip ID</label>
            <input className="w-full border rounded px-2 py-2 font-mono" value={tripID} onChange={e => setTripID(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Biển số xe (quét QR hoặc nhập)</label>
            <input className="w-full border rounded px-2 py-2 font-mono" value={plate} onChange={e => setPlate(e.target.value)} />
          </div>
          <button onClick={start} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded">Bắt đầu</button>
        </div>
      )}

      {session && (
        <div className="space-y-3">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold text-gray-900">Xe <strong className="text-brand-600">{session.plate_number}</strong></div>
                <div className="text-xs text-gray-500 font-mono">{session.trip_id}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tabular-nums text-brand-600">{session.loaded_lpns.length}<span className="text-sm font-normal text-gray-400">/{session.expected_lpns.length}</span></div>
                <div className="text-xs text-gray-500">pallet đã load</div>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className={`h-3 rounded-full transition-all ${session.loaded_lpns.length === session.expected_lpns.length ? 'bg-green-500' : 'bg-brand-500'}`}
                style={{ width: `${session.expected_lpns.length > 0 ? (session.loaded_lpns.length / session.expected_lpns.length) * 100 : 0}%` }} />
            </div>
            {remaining.length === 0 && <div className="mt-2 text-green-600 text-sm font-medium">✅ Đã load đủ tất cả pallet!</div>}
          </div>
          <div className="bg-white rounded shadow p-4 flex gap-2">
            <input autoFocus className="flex-1 border rounded px-3 py-2 font-mono"
              placeholder="Quét/nhập LPN" value={scan}
              onChange={e => setScan(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') scanLoad() }} />
            <button onClick={scanLoad} disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded">Load</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded shadow p-3">
              <h3 className="font-semibold text-green-700">Đã load ({session.loaded_lpns.length})</h3>
              <ul className="text-xs font-mono max-h-64 overflow-auto">
                {session.loaded_lpns.map(l => <li key={l}>✅ {l}</li>)}
              </ul>
            </div>
            <div className="bg-white rounded shadow p-3">
              <h3 className="font-semibold text-orange-700">Còn lại ({remaining.length})</h3>
              <ul className="text-xs font-mono max-h-64 overflow-auto">
                {remaining.map(l => <li key={l}>⏳ {l}</li>)}
              </ul>
            </div>
          </div>
          <button onClick={complete} disabled={busy || remaining.length > 0}
            className="px-4 py-2 bg-purple-700 text-white rounded disabled:opacity-50">
            Hoàn tất load → mở Bàn giao A
          </button>
        </div>
      )}
    </div>
  )
}
