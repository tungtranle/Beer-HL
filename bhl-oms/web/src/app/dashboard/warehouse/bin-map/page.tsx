'use client'

// WMS Phase 9 task 9.15 — Bin map 2D với heatmap occupancy.

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Bin {
  id: string
  bin_code: string
  zone?: string
  row_code?: string
  level_code?: string
  capacity_pallets: number
  is_pickable: boolean
  velocity_class?: string
}

interface BinWithOcc extends Bin {
  occupied: number
}

export default function BinMapPage() {
  const [warehouseID] = useState('a0000000-0000-0000-0000-000000000001')
  const [bins, setBins] = useState<BinWithOcc[]>([])
  const [selected, setSelected] = useState<BinWithOcc | null>(null)
  const [details, setDetails] = useState<any | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const load = async () => {
    try {
      const r: any = await apiFetch(`/warehouse/bins?warehouse_id=${warehouseID}&limit=200`)
      const list = (r.data || []) as Bin[]
      // Fetch contents for each (parallel, but capped)
      const enriched: BinWithOcc[] = await Promise.all(list.map(async b => {
        try {
          const c: any = await apiFetch(`/warehouse/bins/${encodeURIComponent(b.bin_code)}/contents`)
          return { ...b, occupied: c.data.occupied || 0 }
        } catch { return { ...b, occupied: 0 } }
      }))
      setBins(enriched)
    } catch {}
  }
  useEffect(() => { load() }, [])

  // Draw heatmap on canvas. Layout: group by zone, then by row, then by level.
  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const W = canvasRef.current.width
    const H = canvasRef.current.height
    ctx.clearRect(0, 0, W, H)

    // Sort by code
    const sorted = [...bins].sort((a, b) => a.bin_code.localeCompare(b.bin_code))
    const cols = Math.ceil(Math.sqrt(sorted.length))
    const rows = Math.ceil(sorted.length / cols)
    const cellW = W / cols
    const cellH = H / rows

    sorted.forEach((b, i) => {
      const x = (i % cols) * cellW
      const y = Math.floor(i / cols) * cellH
      const occRatio = b.capacity_pallets > 0 ? b.occupied / b.capacity_pallets : 0
      const color = ratioToColor(occRatio)
      ctx.fillStyle = color
      ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4)
      ctx.strokeStyle = '#fff'
      ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4)
      ctx.fillStyle = '#000'
      ctx.font = '10px sans-serif'
      ctx.fillText(b.bin_code, x + 4, y + 14)
      ctx.fillText(`${b.occupied}/${b.capacity_pallets}`, x + 4, y + 26)
    })

    // Click handler
    const onClick = (e: MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const ix = Math.floor(cx / cellW)
      const iy = Math.floor(cy / cellH)
      const idx = iy * cols + ix
      if (idx >= 0 && idx < sorted.length) {
        setSelected(sorted[idx])
        apiFetch(`/warehouse/bins/${encodeURIComponent(sorted[idx].bin_code)}/contents`)
          .then((r: any) => setDetails(r.data)).catch(() => setDetails(null))
      }
    }
    canvasRef.current.onclick = onClick
  }, [bins])

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">🗺 Bản đồ kho — heatmap occupancy</h1>

      {/* Stats bar */}
      {bins.length > 0 && (() => {
        const full = bins.filter(b => b.capacity_pallets > 0 && b.occupied / b.capacity_pallets >= 0.9).length
        const partial = bins.filter(b => b.capacity_pallets > 0 && b.occupied > 0 && b.occupied / b.capacity_pallets < 0.9).length
        const empty = bins.filter(b => b.occupied === 0).length
        return (
          <div className="flex gap-4 mb-4">
            <div className="bg-white rounded-xl border px-4 py-2 shadow-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
              <span className="text-sm"><strong className="text-red-600">{full}</strong> đầy ≥90%</span>
            </div>
            <div className="bg-white rounded-xl border px-4 py-2 shadow-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-yellow-300 inline-block" />
              <span className="text-sm"><strong className="text-amber-600">{partial}</strong> đang chứa</span>
            </div>
            <div className="bg-white rounded-xl border px-4 py-2 shadow-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />
              <span className="text-sm"><strong className="text-gray-600">{empty}</strong> trống</span>
            </div>
            <div className="bg-white rounded-xl border px-4 py-2 shadow-sm">
              <span className="text-sm text-gray-500">{bins.length} bins tổng</span>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded shadow p-2">
          <canvas ref={canvasRef} width={900} height={600} className="w-full bg-gray-50 rounded cursor-pointer" />
          <Legend />
        </div>
        <div className="bg-white rounded shadow p-3">
          <h2 className="font-semibold mb-2 text-gray-700">Chi tiết bin</h2>
          {!selected && <div className="text-sm text-gray-400 text-center py-8">👆 Click vào bin để xem chi tiết</div>}
          {selected && (
            <div className="text-sm">
              <div className="font-mono font-bold text-lg text-gray-900 mb-1">{selected.bin_code}</div>
              <div className="flex gap-2 flex-wrap mb-2">
                {selected.zone && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">Zone {selected.zone}</span>}
                {selected.velocity_class && <span className={`px-2 py-0.5 rounded text-xs font-bold ${selected.velocity_class === 'A' ? 'bg-red-100 text-red-700' : selected.velocity_class === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{selected.velocity_class}</span>}
                <span className={`px-2 py-0.5 rounded text-xs ${selected.is_pickable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{selected.is_pickable ? '✅ Pickable' : '🔒 No pick'}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Chiếm dụng</span>
                  <span className="font-semibold">{selected.occupied}/{selected.capacity_pallets} pallets</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${selected.capacity_pallets > 0 && selected.occupied / selected.capacity_pallets >= 0.9 ? 'bg-red-500' : selected.occupied / selected.capacity_pallets >= 0.4 ? 'bg-amber-400' : 'bg-green-500'}`}
                    style={{ width: `${selected.capacity_pallets > 0 ? Math.min(100, (selected.occupied / selected.capacity_pallets) * 100) : 0}%` }} />
                </div>
              </div>
              {details && details.pallets && details.pallets.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">Pallets ({details.pallets.length})</div>
                  <ul className="space-y-1 max-h-64 overflow-auto">
                    {details.pallets.map((p: any) => (
                      <li key={p.id} className="bg-gray-50 rounded px-2 py-1 text-xs font-mono">
                        <div className="font-bold text-gray-800">{p.lpn_code}</div>
                        <div className="text-gray-500">{p.qty} đv · HSD {p.expiry_date}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {details && (!details.pallets || details.pallets.length === 0) && (
                <div className="text-xs text-gray-400 text-center py-4">Bin trống</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ratioToColor(r: number): string {
  // 0 → green, 0.5 → yellow, 0.9+ → red
  if (r >= 0.9) return '#ef4444'
  if (r >= 0.7) return '#f97316'
  if (r >= 0.4) return '#facc15'
  if (r > 0) return '#86efac'
  return '#e5e7eb'
}

function Legend() {
  return (
    <div className="flex gap-3 text-xs mt-2 px-2">
      <Sw c="#e5e7eb" l="trống" />
      <Sw c="#86efac" l="<40%" />
      <Sw c="#facc15" l="40-70%" />
      <Sw c="#f97316" l="70-90%" />
      <Sw c="#ef4444" l=">90%" />
    </div>
  )
}
function Sw({ c, l }: { c: string; l: string }) {
  return <span className="flex items-center gap-1"><span style={{ background: c }} className="inline-block w-4 h-4 rounded" />{l}</span>
}
