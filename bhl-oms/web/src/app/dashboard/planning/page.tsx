'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { apiFetch, getUser } from '@/lib/api'

interface Shipment {
  id: string; shipment_number: string; customer_name: string;
  total_weight_kg: number; total_volume_m3: number; status: string
}

interface Vehicle {
  id: string; plate_number: string; vehicle_type: string
  capacity_kg: number; capacity_m3: number
}

interface Driver {
  id: string; full_name: string; phone: string; license_number: string
}

interface VRPStop {
  stop_order: number; shipment_id: string; customer_name: string
  customer_id: string; customer_address: string; latitude: number; longitude: number; cumulative_load_kg: number
}

interface VRPTrip {
  vehicle_id: string; plate_number?: string; vehicle_type?: string
  stops: VRPStop[]
  total_distance_km: number; total_weight_kg: number; total_duration_min: number
}

interface VRPSummary {
  total_trips: number; total_vehicles: number; total_shipments_assigned: number
  total_unassigned: number; total_distance_km: number; total_duration_min: number
  total_weight_kg: number; avg_capacity_util_pct: number; avg_stops_per_trip: number
  solve_time_ms: number
}

interface VRPResult {
  job_id: string; status: string; solve_time_ms: number
  trips: VRPTrip[]; unassigned_shipments: any[]; summary: VRPSummary
}

export default function PlanningPage() {
  const user = getUser()
  const [warehouseId, setWarehouseId] = useState(user?.warehouse_ids?.[0] || '')
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])

  const [jobId, setJobId] = useState('')
  const [vrpResult, setVrpResult] = useState<VRPResult | null>(null)
  const [running, setRunning] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState('')
  const [driverAssign, setDriverAssign] = useState<Record<string, string>>({})

  const pollRef = useRef<any>(null)

  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDeliveryDate(tomorrow.toISOString().split('T')[0])

    apiFetch<any>('/warehouses').then((r) => setWarehouses(r.data || [])).catch(console.error)
  }, [])

  const loadData = async () => {
    if (!warehouseId || !deliveryDate) return
    try {
      const [s, v, d] = await Promise.all([
        apiFetch<any>(`/shipments/pending?warehouse_id=${warehouseId}&delivery_date=${deliveryDate}`),
        apiFetch<any>(`/vehicles/available?warehouse_id=${warehouseId}&date=${deliveryDate}`),
        apiFetch<any>(`/drivers/available?warehouse_id=${warehouseId}&date=${deliveryDate}`),
      ])
      setShipments(s.data || [])
      setVehicles(v.data || [])
      setDrivers(d.data || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => { loadData() }, [warehouseId, deliveryDate])

  const runVRP = async () => {
    setRunning(true)
    setError('')
    setVrpResult(null)
    setApproved(false)

    try {
      const vehicleIds = vehicles.map((v) => v.id)
      const res: any = await apiFetch('/planning/run-vrp', {
        method: 'POST',
        body: { warehouse_id: warehouseId, delivery_date: deliveryDate, vehicle_ids: vehicleIds },
      })
      const jid = res.data?.job_id
      setJobId(jid)

      // Poll for result
      pollRef.current = setInterval(async () => {
        try {
          const r: any = await apiFetch(`/planning/jobs/${jid}`)
          if (r.data?.status === 'completed' || r.data?.status === 'failed') {
            clearInterval(pollRef.current)
            setVrpResult(r.data)
            setRunning(false)

            // Init driver assignment
            if (r.data?.trips) {
              const init: Record<string, string> = {}
              r.data.trips.forEach((t: VRPTrip, i: number) => {
                if (drivers[i]) init[t.vehicle_id] = drivers[i].id
              })
              setDriverAssign(init)
            }
          }
        } catch {
          // keep polling
        }
      }, 1500)
    } catch (err: any) {
      setError(err.message)
      setRunning(false)
    }
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Recalculate cumulative weights and stop_order after mutation
  const recalcTrips = useCallback((trips: VRPTrip[]) => {
    return trips.map(trip => {
      let cum = 0
      const newStops = trip.stops.map((s, i) => {
        // Estimate individual weight from cumulative diff
        const prevCum = i > 0 ? trip.stops[i - 1].cumulative_load_kg : 0
        const weight = s.cumulative_load_kg - prevCum
        cum += weight
        return { ...s, stop_order: i + 1, cumulative_load_kg: cum }
      })
      return { ...trip, stops: newStops, total_weight_kg: cum }
    })
  }, [])

  // Move stop between trips or within same trip
  const handleMoveStop = useCallback((srcTrip: number, srcStop: number, dstTrip: number, dstStop: number) => {
    if (!vrpResult?.trips) return
    if (srcTrip === dstTrip && srcStop === dstStop) return

    const trips = vrpResult.trips.map(t => ({ ...t, stops: [...t.stops] }))

    if (srcTrip === dstTrip) {
      // Reorder within same trip
      const [moved] = trips[srcTrip].stops.splice(srcStop, 1)
      trips[srcTrip].stops.splice(dstStop, 0, moved)
    } else {
      // Move between trips
      const [moved] = trips[srcTrip].stops.splice(srcStop, 1)
      trips[dstTrip].stops.splice(dstStop, 0, moved)
    }

    // Remove empty trips
    const filtered = trips.filter(t => t.stops.length > 0)
    const recalced = recalcTrips(filtered)
    setVrpResult({ ...vrpResult, trips: recalced })
  }, [vrpResult, recalcTrips])

  // Reorder stop up/down within a trip
  const handleReorderStop = useCallback((tripIdx: number, stopIdx: number, direction: number) => {
    const newIdx = stopIdx + direction
    handleMoveStop(tripIdx, stopIdx, tripIdx, newIdx)
  }, [handleMoveStop])

  const approvePlan = async () => {
    if (!vrpResult?.trips) return
    setApproving(true)
    setError('')

    try {
      const assignments = vrpResult.trips.map((t) => ({
        vehicle_id: t.vehicle_id,
        driver_id: driverAssign[t.vehicle_id] || undefined,
        shipment_ids: t.stops.map((s) => s.shipment_id),
      }))

      await apiFetch('/planning/approve', {
        method: 'POST',
        body: { job_id: jobId, warehouse_id: warehouseId, delivery_date: deliveryDate, assignments },
      })

      setApproved(true)
      alert('✅ Kế hoạch đã được duyệt! Các chuyến xe đã tạo thành công.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApproving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Lập kế hoạch giao hàng (VRP)</h1>

      {/* Params */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kho xuất</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">-- Chọn kho --</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày giao</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              🔄 Tải lại
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-6 text-sm">
          <span className="text-gray-600">📦 Shipments chờ: <strong className="text-amber-700">{shipments.length}</strong></span>
          <span className="text-gray-600">🚛 Xe khả dụng: <strong className="text-blue-700">{vehicles.length}</strong></span>
          <span className="text-gray-600">👤 Tài xế: <strong className="text-green-700">{drivers.length}</strong></span>
        </div>
      </div>

      {/* Pending shipments */}
      {shipments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-3">Shipments chờ giao</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3">Đơn hàng</th>
                <th className="text-left py-2 px-3">Khách hàng</th>
                <th className="text-left py-2 px-3">Trạng thái</th>
                <th className="text-right py-2 px-3">Trọng lượng (kg)</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-1.5 px-3 font-mono">{s.shipment_number}</td>
                  <td className="py-1.5 px-3">{s.customer_name}</td>
                  <td className="py-1.5 px-3 text-gray-500">{s.status}</td>
                  <td className="py-1.5 px-3 text-right">{s.total_weight_kg?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run VRP button */}
      {!approved && shipments.length > 0 && !vrpResult && (
        <div className="mb-6">
          <button
            onClick={runVRP}
            disabled={running}
            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium disabled:opacity-50"
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                Đang tối ưu tuyến đường...
              </span>
            ) : (
              '🧠 Chạy tối ưu VRP (AI)'
            )}
          </button>
        </div>
      )}

      {/* VRP Result */}
      {vrpResult?.trips && (
        <div className="space-y-4 mb-6">
          {/* Optimization Metrics Dashboard */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-green-800 text-lg">✅ Kết quả tối ưu VRP</h2>
              <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                Giải trong {vrpResult.summary?.solve_time_ms || vrpResult.solve_time_ms}ms
              </span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-amber-700">{vrpResult.trips.length}</div>
                <div className="text-xs text-gray-500">Chuyến xe</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-700">{vrpResult.summary?.total_shipments_assigned}</div>
                <div className="text-xs text-gray-500">Điểm giao</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-indigo-700">{vrpResult.summary?.total_distance_km?.toFixed(1)}</div>
                <div className="text-xs text-gray-500">Tổng km</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-purple-700">{vrpResult.summary?.total_duration_min || '—'}</div>
                <div className="text-xs text-gray-500">Tổng phút</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-green-700">{vrpResult.summary?.avg_capacity_util_pct?.toFixed(0) || '—'}%</div>
                <div className="text-xs text-gray-500">Sử dụng tải TB</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-teal-700">{vrpResult.summary?.avg_stops_per_trip?.toFixed(1) || '—'}</div>
                <div className="text-xs text-gray-500">Điểm/chuyến TB</div>
              </div>
            </div>

            {/* Capacity utilization bars */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tải trọng từng xe</div>
              {vrpResult.trips.map((trip, idx) => {
                const vehicle = vehicles.find(v => v.id === trip.vehicle_id)
                const cap = vehicle?.capacity_kg || 15000
                const pct = Math.min((trip.total_weight_kg / cap) * 100, 100)
                const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
                return (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    <span className="w-28 truncate font-medium">{trip.plate_number || `Xe ${idx+1}`}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 relative overflow-hidden">
                      <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                        {trip.total_weight_kg?.toFixed(0)} / {cap?.toFixed(0)} kg ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <span className="w-20 text-right text-gray-500">{trip.stops.length} điểm · {trip.total_distance_km?.toFixed(1)}km</span>
                  </div>
                )
              })}
            </div>

            {vrpResult.unassigned_shipments?.length > 0 && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm font-medium text-red-700">⚠️ Không xếp được: {vrpResult.unassigned_shipments.length} shipment</div>
                <div className="text-xs text-red-600 mt-1">Có thể do vượt tải trọng tổng. Thêm xe hoặc tăng ngày giao để giải quyết.</div>
              </div>
            )}
          </div>

          {/* Adjustment instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 text-sm mb-2">🔧 Điều chỉnh kế hoạch</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>Kéo thả</strong> điểm giao giữa các chuyến xe để di chuyển shipment</li>
              <li>• <strong>Kéo lên/xuống</strong> trong cùng 1 chuyến để thay đổi thứ tự giao</li>
              <li>• <strong>Chọn tài xế</strong> cho từng chuyến ở dropdown bên phải</li>
              <li>• Bấm <strong>&quot;Chạy lại VRP&quot;</strong> nếu muốn hệ thống tối ưu lại từ đầu</li>
            </ul>
          </div>

          {/* Trips detail with drag & drop */}
          {vrpResult.trips.map((trip, tripIdx) => {
            const vehicle = vehicles.find(v => v.id === trip.vehicle_id)
            const cap = vehicle?.capacity_kg || 15000
            const pct = Math.min((trip.total_weight_kg / cap) * 100, 100)
            const overloaded = trip.total_weight_kg > cap

            return (
              <div key={tripIdx} className={`bg-white rounded-xl shadow-sm p-5 ${overloaded ? 'ring-2 ring-red-400' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">
                    Chuyến {tripIdx + 1}: <span className="text-blue-600">{trip.plate_number || trip.vehicle_id.slice(0, 8)}</span>
                    {trip.vehicle_type && <span className="text-gray-400 text-sm ml-2">({trip.vehicle_type})</span>}
                    {overloaded && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠ Quá tải!</span>}
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">{trip.total_distance_km?.toFixed(1)} km</span>
                    <span className={overloaded ? 'text-red-600 font-bold' : 'text-gray-500'}>{trip.total_weight_kg?.toFixed(0)}/{cap?.toFixed(0)} kg</span>
                    <span className="text-gray-500">{trip.stops.length} điểm</span>
                    {trip.total_duration_min > 0 && <span className="text-gray-500">~{trip.total_duration_min} phút</span>}
                    <select
                      value={driverAssign[trip.vehicle_id] || ''}
                      onChange={(e) => setDriverAssign({ ...driverAssign, [trip.vehicle_id]: e.target.value })}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value="">-- Tài xế --</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-center py-1.5 px-2 w-10">#</th>
                      <th className="text-left py-1.5 px-2">Khách hàng</th>
                      <th className="text-left py-1.5 px-2">Địa chỉ</th>
                      <th className="text-right py-1.5 px-2">Tải tích lũy (kg)</th>
                      <th className="text-center py-1.5 px-2 w-16">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.stops.map((stop, stopIdx) => (
                      <tr
                        key={stop.shipment_id}
                        className="border-t hover:bg-blue-50 cursor-move group"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({ tripIdx, stopIdx }))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-100') }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('bg-blue-100') }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.currentTarget.classList.remove('bg-blue-100')
                          try {
                            const src = JSON.parse(e.dataTransfer.getData('text/plain'))
                            handleMoveStop(src.tripIdx, src.stopIdx, tripIdx, stopIdx)
                          } catch {}
                        }}
                      >
                        <td className="py-1 px-2 text-center text-gray-400">{stop.stop_order}</td>
                        <td className="py-1 px-2">{stop.customer_name}</td>
                        <td className="py-1 px-2 text-gray-500 text-xs">{stop.customer_address || '—'}</td>
                        <td className="py-1 px-2 text-right">{stop.cumulative_load_kg?.toFixed(0)}</td>
                        <td className="py-1 px-2 text-center">
                          <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-center">
                            <button
                              title="Lên"
                              disabled={stopIdx === 0}
                              onClick={() => handleReorderStop(tripIdx, stopIdx, -1)}
                              className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                            >↑</button>
                            <button
                              title="Xuống"
                              disabled={stopIdx === trip.stops.length - 1}
                              onClick={() => handleReorderStop(tripIdx, stopIdx, 1)}
                              className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                            >↓</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!approved && (
              <>
                <button
                  onClick={approvePlan}
                  disabled={approving}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
                >
                  {approving ? 'Đang duyệt...' : '✅ Duyệt kế hoạch & Tạo chuyến xe'}
                </button>
                <button
                  onClick={() => { setVrpResult(null); setJobId(''); runVRP() }}
                  className="px-6 py-3 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition font-medium"
                >
                  🔄 Chạy lại VRP
                </button>
              </>
            )}
          </div>

          {approved && (
            <div className="bg-green-100 text-green-800 px-4 py-3 rounded-lg font-medium">
              ✅ Kế hoạch đã được duyệt. Xem các chuyến xe tại trang <a href="/dashboard/trips" className="underline">Chuyến xe</a>.
            </div>
          )}
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>}
    </div>
  )
}
