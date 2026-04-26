'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { handleError } from '@/lib/handleError'

// ── Types ─────────────────────────────────────────

interface TollStation {
  id: string
  station_name: string
  latitude: number
  longitude: number
  detection_radius_m: number
  fee_l1: number
  fee_l2: number
  fee_l3: number
  fee_l4: number
  fee_l5: number
  is_active: boolean
}

interface TollExpressway {
  id: string
  expressway_name: string
  rate_per_km_l1: number
  rate_per_km_l2: number
  rate_per_km_l3: number
  rate_per_km_l4: number
  rate_per_km_l5: number
  is_active: boolean
  gates: TollGate[]
}

interface TollGate {
  id: string
  expressway_id: string
  gate_name: string
  latitude: number
  longitude: number
  km_marker: number
  detection_radius_m: number
  is_active: boolean
}

interface VehicleTypeCostDefault {
  id: string
  vehicle_type: string
  fuel_consumption_per_km: number
  fuel_price_per_liter: number
  toll_class: string
  fuel_cost_per_km?: number
  is_active?: boolean
  effective_date?: string
  notes?: string
}

interface DriverCostRate {
  id: string
  driver_name?: string
  rate_per_km: number
  min_daily_rate: number
  description: string
}

type Tab = 'toll-stations' | 'expressways' | 'vehicle-defaults' | 'driver-rates'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'toll-stations', label: 'Trạm thu phí', icon: '🏗️' },
  { key: 'expressways', label: 'Cao tốc', icon: '🛣️' },
  { key: 'vehicle-defaults', label: 'Định mức xe', icon: '⛽' },
  { key: 'driver-rates', label: 'Phụ cấp tài xế', icon: '👤' },
]

const TOLL_CLASSES = ['L1', 'L2', 'L3', 'L4', 'L5']

// ── Helpers ─────────────────────────────────────────

function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n)
}

// ── Component ─────────────────────────────────────────

export default function TransportCostsPage() {
  const [tab, setTab] = useState<Tab>('toll-stations')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Data
  const [tollStations, setTollStations] = useState<TollStation[]>([])
  const [expressways, setExpressways] = useState<TollExpressway[]>([])
  const [vehicleDefaults, setVehicleDefaults] = useState<VehicleTypeCostDefault[]>([])
  const [driverRates, setDriverRates] = useState<DriverCostRate[]>([])

  // Edit state
  const [editingStation, setEditingStation] = useState<Partial<TollStation> | null>(null)
  const [editingExpressway, setEditingExpressway] = useState<Partial<TollExpressway> | null>(null)
  const [editingRate, setEditingRate] = useState<Partial<DriverCostRate> | null>(null)
  const [addingGateForId, setAddingGateForId] = useState<string | null>(null)
  const [newGate, setNewGate] = useState({ gate_name: '', km_marker: 0, latitude: 0, longitude: 0 })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, e, v, d] = await Promise.all([
        apiFetch<any>('/cost/toll-stations'),
        apiFetch<any>('/cost/toll-expressways'),
        apiFetch<any>('/cost/vehicle-type-defaults'),
        apiFetch<any>('/cost/driver-rates'),
      ])
      setTollStations(s.data || [])
      setExpressways(e.data || [])
      setVehicleDefaults(v.data || [])
      setDriverRates(d.data || [])
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được cấu hình chi phí vận tải' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  // ── CRUD: Toll Stations ─────────────────────────────

  const saveTollStation = async () => {
    if (!editingStation) return
    setSaving(true)
    try {
      if (editingStation.id) {
        await apiFetch(`/cost/toll-stations/${editingStation.id}`, { method: 'PUT', body: editingStation })
      } else {
        await apiFetch('/cost/toll-stations', { method: 'POST', body: editingStation })
      }
      setEditingStation(null)
      showMsg('Đã lưu trạm thu phí')
      loadData()
    } catch (err: any) {
      showMsg('Lỗi: ' + err.message)
    }
    setSaving(false)
  }

  const deleteTollStation = async (id: string) => {
    if (!confirm('Xóa trạm thu phí này?')) return
    try {
      await apiFetch(`/cost/toll-stations/${id}`, { method: 'DELETE' })
      showMsg('Đã xóa')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
  }

  // ── CRUD: Expressways ─────────────────────────────

  const saveExpressway = async () => {
    if (!editingExpressway) return
    setSaving(true)
    try {
      if (editingExpressway.id) {
        await apiFetch(`/cost/toll-expressways/${editingExpressway.id}`, { method: 'PUT', body: editingExpressway })
      } else {
        await apiFetch('/cost/toll-expressways', { method: 'POST', body: editingExpressway })
      }
      setEditingExpressway(null)
      showMsg('Đã lưu tuyến cao tốc')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
    setSaving(false)
  }

  const deleteExpressway = async (id: string) => {
    if (!confirm('Xóa tuyến cao tốc này?')) return
    try {
      await apiFetch(`/cost/toll-expressways/${id}`, { method: 'DELETE' })
      showMsg('Đã xóa')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
  }

  // ── CRUD: Expressway Gates ─────────────────────────
  const saveGate = async (expresswayId: string) => {
    if (!newGate.gate_name) return
    setSaving(true)
    try {
      await apiFetch(`/cost/toll-expressways/${expresswayId}/gates`, {
        method: 'POST',
        body: { ...newGate, detection_radius_m: 800 }
      })
      setAddingGateForId(null)
      setNewGate({ gate_name: '', km_marker: 0, latitude: 0, longitude: 0 })
      showMsg('Đã thêm cổng')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
    setSaving(false)
  }

  const deleteGate = async (expresswayId: string, gateId: string) => {
    if (!confirm('Xóa cổng này?')) return
    try {
      await apiFetch(`/cost/toll-expressways/${expresswayId}/gates/${gateId}`, { method: 'DELETE' })
      showMsg('Đã xóa cổng')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
  }

  // ── CRUD: Vehicle Defaults ─────────────────────────

  const saveVehicleDefault = async (d: VehicleTypeCostDefault) => {
    setSaving(true)
    try {
      await apiFetch(`/cost/vehicle-type-defaults/${d.id}`, { method: 'PUT', body: d })
      showMsg('Đã lưu định mức xe')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
    setSaving(false)
  }

  // ── CRUD: Driver Rates ─────────────────────────────

  const saveDriverRate = async () => {
    if (!editingRate) return
    setSaving(true)
    try {
      if (editingRate.id) {
        await apiFetch(`/cost/driver-rates/${editingRate.id}`, { method: 'PUT', body: editingRate })
      } else {
        await apiFetch('/cost/driver-rates', { method: 'POST', body: editingRate })
      }
      setEditingRate(null)
      showMsg('Đã lưu phụ cấp tài xế')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
    setSaving(false)
  }

  const deleteDriverRate = async (id: string) => {
    if (!confirm('Xóa phụ cấp tài xế này?')) return
    try {
      await apiFetch(`/cost/driver-rates/${id}`, { method: 'DELETE' })
      showMsg('Đã xóa')
      loadData()
    } catch (err: any) { showMsg('Lỗi: ' + err.message) }
  }

  // ── Render ─────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💰 Chi phí vận chuyển</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý trạm thu phí, cao tốc, định mức nhiên liệu và phụ cấp tài xế.
            Dữ liệu này được dùng để tính chi phí trong lập kế hoạch giao hàng.
          </p>
        </div>
        <button onClick={loadData} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
          🔄 Tải lại
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
          ✅ {msg}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-3xl font-bold text-amber-600">{tollStations.length}</div>
          <div className="text-xs text-gray-500">Trạm thu phí</div>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-3xl font-bold text-blue-600">{expressways.length}</div>
          <div className="text-xs text-gray-500">Tuyến cao tốc</div>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-3xl font-bold text-green-600">{vehicleDefaults.filter(v => v.fuel_consumption_per_km > 0).length}</div>
          <div className="text-xs text-gray-500">Loại xe có định mức</div>
        </div>
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <div className="text-3xl font-bold text-purple-600">{driverRates.length}</div>
          <div className="text-xs text-gray-500">Phụ cấp tài xế</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Đang tải...</div>
      ) : (
        <>
          {/* TAB: Toll Stations */}
          {tab === 'toll-stations' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">🏗️ Danh sách trạm thu phí</h2>
                <button onClick={() => setEditingStation({ station_name: '', latitude: 0, longitude: 0, detection_radius_m: 500, fee_l1: 0, fee_l2: 0, fee_l3: 0, fee_l4: 0, fee_l5: 0, is_active: true })}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm">
                  + Thêm trạm
                </button>
              </div>

              {editingStation && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <h3 className="font-semibold mb-3">{editingStation.id ? 'Sửa' : 'Thêm'} trạm thu phí</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Tên trạm</label>
                      <input value={editingStation.station_name || ''} onChange={e => setEditingStation({ ...editingStation, station_name: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="Trạm BOT Quốc lộ 1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Vĩ độ (Lat)</label>
                      <input type="number" step="0.0001" value={editingStation.latitude || ''} onChange={e => setEditingStation({ ...editingStation, latitude: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Kinh độ (Lng)</label>
                      <input type="number" step="0.0001" value={editingStation.longitude || ''} onChange={e => setEditingStation({ ...editingStation, longitude: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" />
                    </div>
                    {TOLL_CLASSES.map(cls => (
                      <div key={cls}>
                        <label className="text-xs text-gray-500">Phí {cls} (₫)</label>
                        <input type="number" value={(editingStation as any)[`fee_${cls.toLowerCase()}`] || ''} onChange={e => setEditingStation({ ...editingStation, [`fee_${cls.toLowerCase()}`]: parseFloat(e.target.value) || 0 })}
                          className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="35000" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-gray-500">Bán kính (m)</label>
                      <input type="number" value={editingStation.detection_radius_m || 500} onChange={e => setEditingStation({ ...editingStation, detection_radius_m: parseInt(e.target.value) || 500 })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={saveTollStation} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
                      {saving ? 'Đang lưu...' : '💾 Lưu'}
                    </button>
                    <button onClick={() => setEditingStation(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Hủy</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4">Tên trạm</th>
                      <th className="text-center py-3 px-2">Tọa độ</th>
                      {TOLL_CLASSES.map(c => <th key={c} className="text-right py-3 px-2">{c}</th>)}
                      <th className="text-center py-3 px-2">Trạng thái</th>
                      <th className="text-center py-3 px-2">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tollStations.map(st => (
                      <tr key={st.id} className="border-t hover:bg-gray-50">
                        <td className="py-2.5 px-4 font-medium">{st.station_name}</td>
                        <td className="py-2.5 px-2 text-center text-xs text-gray-400">{st.latitude.toFixed(4)}, {st.longitude.toFixed(4)}</td>
                        <td className="py-2.5 px-2 text-right">{formatVND(st.fee_l1)}</td>
                        <td className="py-2.5 px-2 text-right">{formatVND(st.fee_l2)}</td>
                        <td className="py-2.5 px-2 text-right">{formatVND(st.fee_l3)}</td>
                        <td className="py-2.5 px-2 text-right">{formatVND(st.fee_l4)}</td>
                        <td className="py-2.5 px-2 text-right">{formatVND(st.fee_l5)}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${st.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {st.is_active ? 'Hoạt động' : 'Tắt'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button onClick={() => setEditingStation(st)} className="text-blue-500 hover:text-blue-700 mr-2">✏️</button>
                          <button onClick={() => deleteTollStation(st.id)} className="text-red-400 hover:text-red-600">🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {tollStations.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-8 text-gray-400">Chưa có trạm thu phí. Bấm &quot;+ Thêm trạm&quot; để thêm.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: Expressways */}
          {tab === 'expressways' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">🛣️ Tuyến cao tốc</h2>
                <button onClick={() => setEditingExpressway({ expressway_name: '', rate_per_km_l1: 0, rate_per_km_l2: 0, rate_per_km_l3: 0, rate_per_km_l4: 0, rate_per_km_l5: 0, is_active: true })}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
                  + Thêm tuyến
                </button>
              </div>

              {editingExpressway && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <h3 className="font-semibold mb-3">{editingExpressway.id ? 'Sửa' : 'Thêm'} tuyến cao tốc</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Tên tuyến</label>
                      <input value={editingExpressway.expressway_name || ''} onChange={e => setEditingExpressway({ ...editingExpressway, expressway_name: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="Cao tốc Hà Nội - Hải Phòng" />
                    </div>
                    {TOLL_CLASSES.map(cls => (
                      <div key={cls}>
                        <label className="text-xs text-gray-500">₫/km {cls}</label>
                        <input type="number" value={(editingExpressway as any)[`rate_per_km_${cls.toLowerCase()}`] || ''} onChange={e => setEditingExpressway({ ...editingExpressway, [`rate_per_km_${cls.toLowerCase()}`]: parseFloat(e.target.value) || 0 })}
                          className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="1500" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={saveExpressway} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
                      {saving ? 'Đang lưu...' : '💾 Lưu'}
                    </button>
                    <button onClick={() => setEditingExpressway(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Hủy</button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {expressways.map(ew => (
                  <div key={ew.id} className="bg-white rounded-xl border p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold">{ew.expressway_name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ew.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {ew.is_active ? 'Hoạt động' : 'Tắt'}
                        </span>
                        <button onClick={() => setEditingExpressway(ew)} className="text-blue-500 hover:text-blue-700">✏️</button>
                        <button onClick={() => deleteExpressway(ew.id)} className="text-red-400 hover:text-red-600">🗑️</button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 mb-3">
                      {TOLL_CLASSES.map(c => (
                        <span key={c}>{c}: {formatVND((ew as any)[`rate_per_km_${c.toLowerCase()}`])}₫/km</span>
                      ))}
                    </div>
                    {/* Gate list with management */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-medium text-gray-600">🛣️ Cửa ra/vào ({ew.gates?.length || 0})</p>
                        <button onClick={() => { setAddingGateForId(addingGateForId === ew.id ? null : ew.id); setNewGate({ gate_name: '', km_marker: 0, latitude: 0, longitude: 0 }) }}
                          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                          + Thêm cổng
                        </button>
                      </div>

                      {/* Form thêm cổng mới */}
                      {addingGateForId === ew.id && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <label className="text-gray-500">Tên cổng</label>
                              <input value={newGate.gate_name} onChange={e => setNewGate({ ...newGate, gate_name: e.target.value })}
                                className="w-full border rounded px-2 py-1.5 mt-0.5" placeholder="Nút giao ABC" />
                            </div>
                            <div>
                              <label className="text-gray-500">Km marker</label>
                              <input type="number" value={newGate.km_marker || ''} onChange={e => setNewGate({ ...newGate, km_marker: parseFloat(e.target.value) || 0 })}
                                className="w-full border rounded px-2 py-1.5 mt-0.5" placeholder="52" />
                            </div>
                            <div>
                              <label className="text-gray-500">Vĩ độ (Lat)</label>
                              <input type="number" step="0.001" value={newGate.latitude || ''} onChange={e => setNewGate({ ...newGate, latitude: parseFloat(e.target.value) || 0 })}
                                className="w-full border rounded px-2 py-1.5 mt-0.5" placeholder="20.977" />
                            </div>
                            <div>
                              <label className="text-gray-500">Kinh độ (Lng)</label>
                              <input type="number" step="0.001" value={newGate.longitude || ''} onChange={e => setNewGate({ ...newGate, longitude: parseFloat(e.target.value) || 0 })}
                                className="w-full border rounded px-2 py-1.5 mt-0.5" placeholder="105.952" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => saveGate(ew.id)} disabled={saving || !newGate.gate_name}
                              className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                              {saving ? 'Đang lưu...' : '💾 Lưu'}
                            </button>
                            <button onClick={() => setAddingGateForId(null)} className="px-3 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">Hủy</button>
                          </div>
                        </div>
                      )}

                      {ew.gates && ew.gates.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                          {ew.gates.map(g => (
                            <div key={g.id} className="bg-white rounded px-2 py-1.5 border flex justify-between items-center group">
                              <div>
                                <span className="font-medium">{g.gate_name}</span>
                                <span className="text-gray-400 ml-1">Km {g.km_marker}</span>
                                <span className="text-gray-300 ml-1">({g.latitude?.toFixed(3)}, {g.longitude?.toFixed(3)})</span>
                              </div>
                              <button onClick={() => deleteGate(ew.id, g.id)}
                                className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1" title="Xóa cổng">
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!ew.gates || ew.gates.length === 0) && !addingGateForId && (
                        <p className="text-xs text-gray-400 italic">Chưa có cổng nào. Thêm ít nhất 2 cổng để tính phí theo km.</p>
                      )}
                    </div>
                  </div>
                ))}
                {expressways.length === 0 && (
                  <div className="text-center py-12 text-gray-400">Chưa có tuyến cao tốc. Bấm &quot;+ Thêm tuyến&quot; để thêm.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Vehicle Type Defaults */}
          {tab === 'vehicle-defaults' && (
            <div>
              <h2 className="text-lg font-semibold mb-2">⛽ Định mức nhiên liệu theo loại xe</h2>
              <p className="text-sm text-gray-500 mb-4">
                Cấu hình mức tiêu thụ và giá nhiên liệu mặc định cho từng loại xe. Solver sẽ dùng dữ liệu này để tính chi phí xăng/dầu.
              </p>
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4">Loại xe</th>
                      <th className="text-right py-3 px-4">Tiêu thụ (L/km)</th>
                      <th className="text-right py-3 px-4">Giá nhiên liệu (₫/L)</th>
                      <th className="text-center py-3 px-4">Hạng thu phí</th>
                      <th className="text-right py-3 px-4">Chi phí/km (₫)</th>
                      <th className="text-center py-3 px-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleDefaults.map(d => {
                      const fuelPerKm = d.fuel_consumption_per_km * d.fuel_price_per_liter
                      return (
                        <VehicleDefaultRow key={d.id} item={d} fuelPerKm={fuelPerKm} onSave={saveVehicleDefault} saving={saving} />
                      )
                    })}
                    {vehicleDefaults.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">Chưa có định mức xe.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: Driver Rates */}
          {tab === 'driver-rates' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold">👤 Phụ cấp tài xế</h2>
                  <p className="text-sm text-gray-500 mt-1">Phụ cấp tính theo km di chuyển và mức tối thiểu/ngày.</p>
                </div>
                <button onClick={() => setEditingRate({ description: '', rate_per_km: 0, min_daily_rate: 0 })}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm">
                  + Thêm mức phụ cấp
                </button>
              </div>

              {editingRate && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                  <h3 className="font-semibold mb-3">{editingRate.id ? 'Sửa' : 'Thêm'} mức phụ cấp</h3>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <label className="text-xs text-gray-500">Mô tả</label>
                      <input value={editingRate.description || ''} onChange={e => setEditingRate({ ...editingRate, description: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="Tài xế nội thành" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phụ cấp/km (₫)</label>
                      <input type="number" value={editingRate.rate_per_km || ''} onChange={e => setEditingRate({ ...editingRate, rate_per_km: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="3000" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Tối thiểu/ngày (₫)</label>
                      <input type="number" value={editingRate.min_daily_rate || ''} onChange={e => setEditingRate({ ...editingRate, min_daily_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="200000" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={saveDriverRate} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
                      {saving ? 'Đang lưu...' : '💾 Lưu'}
                    </button>
                    <button onClick={() => setEditingRate(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm">Hủy</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4">Mô tả</th>
                      <th className="text-right py-3 px-4">Phụ cấp/km (₫)</th>
                      <th className="text-right py-3 px-4">Tối thiểu/ngày (₫)</th>
                      <th className="text-center py-3 px-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverRates.map(r => (
                      <tr key={r.id} className="border-t hover:bg-gray-50">
                        <td className="py-2.5 px-4">{r.description}</td>
                        <td className="py-2.5 px-4 text-right font-medium">{formatVND(r.rate_per_km)}₫</td>
                        <td className="py-2.5 px-4 text-right">{formatVND(r.min_daily_rate)}₫</td>
                        <td className="py-2.5 px-4 text-center">
                          <button onClick={() => setEditingRate(r)} className="text-blue-500 hover:text-blue-700 mr-2">✏️</button>
                          <button onClick={() => deleteDriverRate(r.id)} className="text-red-400 hover:text-red-600">🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {driverRates.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-400">Chưa có phụ cấp tài xế.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Inline Editable Row for Vehicle Defaults ─────────

function VehicleDefaultRow({ item, fuelPerKm, onSave, saving }: {
  item: VehicleTypeCostDefault; fuelPerKm: number; onSave: (d: VehicleTypeCostDefault) => void; saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(item)

  useEffect(() => { setLocal(item) }, [item])

  if (!editing) {
    return (
      <tr className="border-t hover:bg-gray-50">
        <td className="py-2.5 px-4 font-medium">{item.vehicle_type}</td>
        <td className="py-2.5 px-4 text-right">{item.fuel_consumption_per_km}</td>
        <td className="py-2.5 px-4 text-right">{new Intl.NumberFormat('vi-VN').format(item.fuel_price_per_liter)}</td>
        <td className="py-2.5 px-4 text-center">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{item.toll_class}</span>
        </td>
        <td className="py-2.5 px-4 text-right font-medium text-green-700">{new Intl.NumberFormat('vi-VN').format(Math.round(fuelPerKm))}₫</td>
        <td className="py-2.5 px-4 text-center">
          <button onClick={() => setEditing(true)} className="text-blue-500 hover:text-blue-700">✏️</button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t bg-yellow-50">
      <td className="py-2 px-4 font-medium">{item.vehicle_type}</td>
      <td className="py-2 px-2">
        <input type="number" step="0.01" value={local.fuel_consumption_per_km}
          onChange={e => setLocal({ ...local, fuel_consumption_per_km: parseFloat(e.target.value) || 0 })}
          className="w-full border rounded px-2 py-1.5 text-sm text-right" />
      </td>
      <td className="py-2 px-2">
        <input type="number" value={local.fuel_price_per_liter}
          onChange={e => setLocal({ ...local, fuel_price_per_liter: parseFloat(e.target.value) || 0 })}
          className="w-full border rounded px-2 py-1.5 text-sm text-right" />
      </td>
      <td className="py-2 px-2">
        <select value={local.toll_class} onChange={e => setLocal({ ...local, toll_class: e.target.value })}
          className="w-full border rounded px-2 py-1.5 text-sm text-center">
          {['L1', 'L2', 'L3', 'L4', 'L5'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-2 px-4 text-right text-green-700 font-medium">
        {new Intl.NumberFormat('vi-VN').format(Math.round(local.fuel_consumption_per_km * local.fuel_price_per_liter))}₫
      </td>
      <td className="py-2 px-2 text-center">
        <button onClick={() => { onSave(local); setEditing(false) }} disabled={saving}
          className="text-green-600 hover:text-green-800 mr-1">💾</button>
        <button onClick={() => { setLocal(item); setEditing(false) }} className="text-gray-400 hover:text-gray-600">✗</button>
      </td>
    </tr>
  )
}
