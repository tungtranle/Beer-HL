'use client'

// WMS Phase 9 task 9.13 — Cycle Count UI.

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Task {
  id: string
  bin_id: string
  bin_code: string
  scheduled_date: string
  status: string
  expected_snapshot?: string
  variance?: string
}

export default function CycleCountPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [warehouseID, setWarehouseID] = useState('a0000000-0000-0000-0000-000000000001')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [classes, setClasses] = useState<string[]>(['A', 'B', 'C'])
  const [active, setActive] = useState<Task | null>(null)
  const [scanned, setScanned] = useState<string[]>([])
  const [scan, setScan] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const r: any = await apiFetch(`/warehouse/cycle-count/tasks?warehouse_id=${warehouseID}`)
      setTasks(r.data || [])
    } catch (e: any) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [])

  const generate = async () => {
    setBusy(true)
    try {
      const r: any = await apiFetch('/warehouse/cycle-count/generate', {
        method: 'POST',
        body: { warehouse_id: warehouseID, scheduled_date: date, velocity_classes: classes },
      })
      toast.success(`Tạo ${r.data.created_tasks} task`)
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const submit = async () => {
    if (!active) return
    setBusy(true)
    try {
      await apiFetch('/warehouse/cycle-count/submit', {
        method: 'POST',
        body: { task_id: active.id, scanned_lpns: scanned },
      })
      toast.success('Đã submit')
      setActive(null)
      setScanned([])
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const progressCount = tasks.filter(t => t.status === 'in_progress').length
  const doneCount = tasks.filter(t => t.status === 'completed').length
  const varianceCount = tasks.filter(t => t.variance).length
  const totalCount = tasks.length

  const velColors: Record<string, string> = { A: 'bg-red-100 text-red-700 border-red-200', B: 'bg-amber-100 text-amber-700 border-amber-200', C: 'bg-green-100 text-green-700 border-green-200' }
  const statusColors: Record<string, string> = { pending: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700' }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔢 Kiểm kê chu kỳ (Cycle Count)</h1>

      {/* Summary bar */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl border p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-500">{pendingCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Chờ kiểm</div>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{progressCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Đang kiểm</div>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">{doneCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Hoàn thành</div>
          </div>
          <div className={`rounded-xl border p-3 text-center shadow-sm ${varianceCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
            <div className={`text-2xl font-bold ${varianceCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{varianceCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Sai lệch</div>
          </div>
        </div>
      )}
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Tiến độ kiểm kê</span>
            <span>{doneCount}/{totalCount}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow p-4 mb-4">
        <h2 className="font-semibold mb-2">Tạo task mới (theo velocity class)</h2>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs">Ngày kiểm</label>
            <input type="date" className="border rounded px-2 py-1" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['A', 'B', 'C'].map(cls => (
              <label key={cls} className="text-sm">
                <input type="checkbox" checked={classes.includes(cls)}
                  onChange={e => setClasses(e.target.checked ? [...classes, cls] : classes.filter(x => x !== cls))} /> {cls}
              </label>
            ))}
          </div>
          <button onClick={generate} disabled={busy} className="px-3 py-1 bg-blue-600 text-white rounded">Tạo task</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">Danh sách task ({tasks.length})</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b text-xs text-gray-500 uppercase tracking-wide"><th className="py-2">Bin</th><th className="py-2">Velocity</th><th className="py-2">Ngày</th><th className="py-2">Trạng thái</th><th className="py-2">Sai lệch</th><th className="py-2"></th></tr></thead>
          <tbody>
            {tasks.map(t => {
              const velClass = t.bin_code?.match(/^([ABC])/)?.[1] || ''
              return (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="font-mono py-2 pr-4">{t.bin_code}</td>
                <td className="py-2 pr-4">
                  {velClass ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${velColors[velClass] || 'bg-gray-100 text-gray-500'}`}>{velClass}</span>
                  ) : '—'}
                </td>
                <td className="py-2 pr-4 text-gray-600">{t.scheduled_date}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || 'bg-gray-100 text-gray-600'}`}>
                    {t.status === 'pending' ? 'Chờ kiểm' : t.status === 'in_progress' ? 'Đang kiểm' : t.status === 'completed' ? 'Xong' : t.status}
                  </span>
                </td>
                <td className="py-2 pr-4">{t.variance ? <span className="text-red-600 font-medium text-xs">⚠️ Sai lệch</span> : <span className="text-gray-300">—</span>}</td>
                <td className="py-2">
                  {t.status === 'pending' && (
                    <button onClick={() => { setActive(t); setScanned([]) }}
                      className="px-3 py-1 bg-brand-500 text-white rounded-lg text-xs font-medium hover:bg-brand-600">Bắt đầu</button>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 max-w-lg w-full">
            <h3 className="font-bold mb-2">Kiểm kê bin <code>{active.bin_code}</code></h3>
            <div className="text-xs text-gray-500 mb-2">
              Expected: <code>{active.expected_snapshot || '[]'}</code>
            </div>
            <div className="flex gap-2 mb-3">
              <input autoFocus className="flex-1 border rounded px-2 py-1 font-mono" placeholder="Quét LPN"
                value={scan} onChange={e => setScan(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && scan.trim()) {
                    setScanned(Array.from(new Set([...scanned, scan.trim()])))
                    setScan('')
                  }
                }} />
            </div>
            <div className="border rounded p-2 max-h-40 overflow-auto text-xs font-mono mb-3">
              {scanned.map(l => <div key={l}>✅ {l}</div>)}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActive(null)} className="px-3 py-1 border rounded">Hủy</button>
              <button onClick={submit} disabled={busy} className="px-3 py-1 bg-blue-600 text-white rounded">Submit ({scanned.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
