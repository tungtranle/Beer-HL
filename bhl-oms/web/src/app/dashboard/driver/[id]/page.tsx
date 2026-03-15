'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, getUser } from '@/lib/api'

interface Stop {
  id: string
  customer_name: string
  customer_address: string
  customer_id: string
  stop_order: number
  status: string
  order_number: string
  order_amount: number
  order_items: { product_id: string; product_name: string; quantity: number; unit_price: number }[]
  actual_arrival: string | null
  actual_departure: string | null
}

interface EPODData {
  id: string
  delivery_status: string
  delivered_items: { product_id: string; product_name: string; ordered_qty: number; delivered_qty: number; reason: string }[]
  receiver_name: string
  receiver_phone: string
  total_amount: number
  deposit_amount: number
  notes: string | null
  created_at: string
}

interface PaymentData {
  id: string
  payment_method: string
  amount: number
  status: string
  reference_number: string | null
  collected_at: string
}

interface ReturnData {
  id: string
  asset_type: string
  quantity: number
  condition: string
  photo_url: string | null
  notes: string | null
}

type ModalType = 'epod' | 'payment' | 'returns' | null

interface Checklist {
  id: string
  tires_ok: boolean
  brakes_ok: boolean
  lights_ok: boolean
  mirrors_ok: boolean
  horn_ok: boolean
  coolant_ok: boolean
  oil_ok: boolean
  fuel_level: number
  fire_extinguisher_ok: boolean
  first_aid_ok: boolean
  documents_ok: boolean
  cargo_secured: boolean
  is_passed: boolean
  notes: string | null
}

interface TripDetail {
  id: string
  trip_number: string
  status: string
  planned_date: string
  vehicle_plate: string
  warehouse_name: string
  total_stops: number
  total_weight_kg: number
  total_distance_km: number
  total_duration_min: number
  started_at: string | null
  completed_at: string | null
  stops: Stop[]
  checklist: Checklist | null
}

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  assigned: 'bg-blue-100 text-blue-700',
  pre_check: 'bg-purple-100 text-purple-700',
  ready: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  planned: 'Đã lập kế hoạch', assigned: 'Đã phân công', pre_check: 'Kiểm tra xe',
  ready: 'Sẵn sàng', in_transit: 'Đang giao hàng', completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

const stopStatusLabels: Record<string, string> = {
  pending: 'Chờ giao', arrived: 'Đã đến', delivering: 'Đang giao',
  delivered: 'Đã giao', partially_delivered: 'Giao một phần', failed: 'Thất bại', skipped: 'Bỏ qua',
}

const stopStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700', arrived: 'bg-blue-100 text-blue-700',
  delivering: 'bg-amber-100 text-amber-700', delivered: 'bg-green-100 text-green-700',
  partially_delivered: 'bg-yellow-100 text-yellow-700', failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
}

const assetTypeLabels: Record<string, string> = {
  bottle: 'Chai', crate: 'Két', keg: 'Keg', pallet: 'Pallet',
}

const conditionLabels: Record<string, string> = {
  good: 'Tốt', damaged: 'Hư hỏng', lost: 'Mất',
}

export default function DriverTripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const user = getUser()

  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)

  // ePOD form state
  const [epodItems, setEpodItems] = useState<{ product_id: string; product_name: string; ordered_qty: number; delivered_qty: number; reason: string }[]>([])
  const [epodReceiverName, setEpodReceiverName] = useState('')
  const [epodReceiverPhone, setEpodReceiverPhone] = useState('')
  const [epodDeliveryStatus, setEpodDeliveryStatus] = useState<'delivered' | 'partial' | 'rejected'>('delivered')
  const [epodNotes, setEpodNotes] = useState('')
  const [existingEpod, setExistingEpod] = useState<EPODData | null>(null)

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'cod'>('cash')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentRef, setPaymentRef] = useState('')

  // Returns form state
  const [returnItems, setReturnItems] = useState<{ asset_type: string; quantity: number; condition: string; notes: string }[]>([])
  const [existingReturns, setExistingReturns] = useState<ReturnData[]>([])

  const loadTrip = async () => {
    try {
      const res: any = await apiFetch(`/trips/${tripId}`)
      setTrip(res.data)
    } catch { /* empty */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTrip() }, [tripId])

  const handleStartTrip = async () => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/start`, { method: 'PUT' })
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const handleCompleteTrip = async () => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/complete`, { method: 'PUT' })
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const handleUpdateStop = async (stopId: string, status: string) => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/stops/${stopId}/update`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  // --- ePOD ---
  const openEpodModal = async (stop: Stop) => {
    setSelectedStop(stop)
    // Pre-fill items from order
    if (stop.order_items?.length) {
      setEpodItems(stop.order_items.map(item => ({
        product_id: item.product_id || '',
        product_name: item.product_name,
        ordered_qty: item.quantity,
        delivered_qty: item.quantity,
        reason: '',
      })))
    }
    setEpodReceiverName('')
    setEpodReceiverPhone('')
    setEpodDeliveryStatus('delivered')
    setEpodNotes('')
    setExistingEpod(null)

    // Check for existing ePOD
    try {
      const res: any = await apiFetch(`/driver/trips/${tripId}/stops/${stop.id}/epod`)
      if (res.data) setExistingEpod(res.data)
    } catch { /* no existing epod */ }

    setActiveModal('epod')
  }

  const handleSubmitEpod = async () => {
    if (!selectedStop) return
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/stops/${selectedStop.id}/epod`, {
        method: 'POST',
        body: JSON.stringify({
          delivery_status: epodDeliveryStatus,
          delivered_items: epodItems,
          receiver_name: epodReceiverName,
          receiver_phone: epodReceiverPhone,
          notes: epodNotes || undefined,
        }),
      })
      setActiveModal(null)
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  // --- Payment ---
  const openPaymentModal = async (stop: Stop) => {
    setSelectedStop(stop)
    setPaymentMethod('cash')
    setPaymentAmount(stop.order_amount || 0)
    setPaymentRef('')
    setActiveModal('payment')
  }

  const handleSubmitPayment = async () => {
    if (!selectedStop) return
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/stops/${selectedStop.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method: paymentMethod,
          amount: paymentAmount,
          reference_number: paymentRef || undefined,
        }),
      })
      setActiveModal(null)
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  // --- Returns ---
  const openReturnsModal = async (stop: Stop) => {
    setSelectedStop(stop)
    setReturnItems([{ asset_type: 'crate', quantity: 0, condition: 'good', notes: '' }])
    setExistingReturns([])

    try {
      const res: any = await apiFetch(`/driver/trips/${tripId}/stops/${stop.id}/returns`)
      if (res.data?.length) setExistingReturns(res.data)
    } catch { /* no existing returns */ }

    setActiveModal('returns')
  }

  const handleSubmitReturns = async () => {
    if (!selectedStop) return
    const validItems = returnItems.filter(i => i.quantity > 0)
    if (!validItems.length) return
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/stops/${selectedStop.id}/returns`, {
        method: 'POST',
        body: JSON.stringify({ items: validItems }),
      })
      setActiveModal(null)
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const addReturnItem = () => {
    setReturnItems([...returnItems, { asset_type: 'crate', quantity: 0, condition: 'good', notes: '' }])
  }

  const removeReturnItem = (idx: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== idx))
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }

  if (!trip) {
    return <div className="p-6 text-center text-red-500">Không tìm thấy chuyến xe</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/driver" className="text-2xl">←</Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{trip.trip_number}</h1>
          <p className="text-sm text-gray-500">{trip.vehicle_plate} · {trip.planned_date}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[trip.status] || 'bg-gray-100'}`}>
          {statusLabels[trip.status] || trip.status}
        </span>
      </div>

      {/* Trip Summary */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-blue-600">{trip.total_stops}</div>
          <div className="text-xs text-gray-500">Điểm giao</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-orange-600">{trip.total_distance_km?.toFixed(1)}</div>
          <div className="text-xs text-gray-500">km</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-purple-600">{trip.total_weight_kg?.toFixed(0)}</div>
          <div className="text-xs text-gray-500">kg</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-green-600">{trip.total_duration_min}</div>
          <div className="text-xs text-gray-500">phút</div>
        </div>
      </div>

      {/* Action Buttons */}
      {(trip.status === 'assigned' || trip.status === 'ready') && (
        <button onClick={handleStartTrip} disabled={actionLoading}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
          {actionLoading ? 'Đang xử lý...' : '🚀 Bắt đầu chuyến xe'}
        </button>
      )}

      {trip.status === 'in_transit' && trip.stops?.every(s => s.status === 'delivered' || s.status === 'failed' || s.status === 'skipped') && (
        <button onClick={handleCompleteTrip} disabled={actionLoading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {actionLoading ? 'Đang xử lý...' : '✅ Hoàn thành chuyến xe'}
        </button>
      )}

      {/* Stops List */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Danh sách điểm giao ({trip.stops?.length || 0})</h2>
        <div className="space-y-3">
          {trip.stops?.sort((a, b) => a.stop_order - b.stop_order).map((stop) => (
            <div key={stop.id} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                      {stop.stop_order}
                    </span>
                    <span className="font-medium">{stop.customer_name}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 ml-8">{stop.customer_address}</p>
                  {stop.order_number && (
                    <p className="text-sm text-gray-400 mt-1 ml-8">
                      Đơn: {stop.order_number} · {stop.order_amount?.toLocaleString('vi-VN')}đ
                    </p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${stopStatusColors[stop.status] || 'bg-gray-100'}`}>
                  {stopStatusLabels[stop.status] || stop.status}
                </span>
              </div>

              {/* Order Items */}
              {stop.order_items && stop.order_items.length > 0 && (
                <div className="mt-2 ml-8 text-sm text-gray-600">
                  {stop.order_items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.product_name}</span>
                      <span>×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stop Actions */}
              {trip.status === 'in_transit' && stop.status === 'pending' && (
                <div className="mt-3 ml-8 flex gap-2">
                  <button onClick={() => handleUpdateStop(stop.id, 'arrived')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                    📍 Đã đến
                  </button>
                </div>
              )}
              {trip.status === 'in_transit' && stop.status === 'arrived' && (
                <div className="mt-3 ml-8 flex flex-wrap gap-2">
                  <button onClick={() => openEpodModal(stop)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                    📝 Giao hàng (ePOD)
                  </button>
                  <button onClick={() => handleUpdateStop(stop.id, 'failed')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
                    ❌ Thất bại
                  </button>
                </div>
              )}
              {trip.status === 'in_transit' && (stop.status === 'delivered' || stop.status === 'partially_delivered') && (
                <div className="mt-3 ml-8 flex flex-wrap gap-2">
                  <button onClick={() => openPaymentModal(stop)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50">
                    💰 Thu tiền
                  </button>
                  <button onClick={() => openReturnsModal(stop)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50">
                    📦 Thu hồi vỏ
                  </button>
                  <button onClick={() => openEpodModal(stop)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50">
                    👁 Xem ePOD
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Checklist Summary (if exists) */}
      {trip.checklist && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-2">Checklist xe</h2>
          <div className={`text-sm font-medium ${trip.checklist.is_passed ? 'text-green-600' : 'text-red-600'}`}>
            {trip.checklist.is_passed ? '✅ Đã kiểm tra - ĐẠT' : '❌ Kiểm tra - KHÔNG ĐẠT'}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2 text-sm text-gray-600">
            <div>{trip.checklist.tires_ok ? '✓' : '✗'} Lốp xe</div>
            <div>{trip.checklist.brakes_ok ? '✓' : '✗'} Phanh</div>
            <div>{trip.checklist.lights_ok ? '✓' : '✗'} Đèn</div>
            <div>{trip.checklist.mirrors_ok ? '✓' : '✗'} Gương</div>
            <div>{trip.checklist.horn_ok ? '✓' : '✗'} Còi</div>
            <div>{trip.checklist.documents_ok ? '✓' : '✗'} Giấy tờ</div>
            <div>{trip.checklist.cargo_secured ? '✓' : '✗'} Hàng hóa</div>
            <div>⛽ {trip.checklist.fuel_level}%</div>
          </div>
        </div>
      )}

      {/* ==================== ePOD MODAL ==================== */}
      {activeModal === 'epod' && selectedStop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {existingEpod ? '📋 Biên bản giao hàng' : '📝 Giao hàng (ePOD)'}
              </h2>
              <button onClick={() => setActiveModal(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500">
              {selectedStop.customer_name} · {selectedStop.order_number}
            </p>

            {existingEpod ? (
              /* View existing ePOD */
              <div className="space-y-3">
                <div className={`px-3 py-2 rounded text-sm font-medium ${
                  existingEpod.delivery_status === 'delivered' ? 'bg-green-100 text-green-700' :
                  existingEpod.delivery_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {existingEpod.delivery_status === 'delivered' ? '✅ Giao đủ' :
                   existingEpod.delivery_status === 'partial' ? '⚠️ Giao một phần' : '❌ Từ chối'}
                </div>
                {existingEpod.delivered_items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm border-b pb-1">
                    <span>{item.product_name}</span>
                    <span>{item.delivered_qty}/{item.ordered_qty}</span>
                  </div>
                ))}
                <div className="text-sm space-y-1">
                  <div>Người nhận: <strong>{existingEpod.receiver_name}</strong></div>
                  <div>SĐT: {existingEpod.receiver_phone}</div>
                  <div>Tổng tiền: <strong>{existingEpod.total_amount?.toLocaleString('vi-VN')}đ</strong></div>
                  {existingEpod.notes && <div>Ghi chú: {existingEpod.notes}</div>}
                </div>
              </div>
            ) : (
              /* ePOD submission form */
              <div className="space-y-4">
                {/* Delivery Status */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Trạng thái giao</label>
                  <div className="flex gap-2 mt-1">
                    {(['delivered', 'partial', 'rejected'] as const).map(s => (
                      <button key={s} onClick={() => setEpodDeliveryStatus(s)}
                        className={`px-3 py-1.5 text-sm rounded ${
                          epodDeliveryStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {s === 'delivered' ? 'Giao đủ' : s === 'partial' ? 'Giao một phần' : 'Từ chối'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delivered Items */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Chi tiết sản phẩm</label>
                  <div className="space-y-2 mt-1">
                    {epodItems.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 rounded p-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium">{item.product_name}</span>
                          <span className="text-gray-500">Đặt: {item.ordered_qty}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-gray-500">Giao:</label>
                          <input type="number" min={0} max={item.ordered_qty}
                            value={item.delivered_qty}
                            onChange={e => {
                              const updated = [...epodItems]
                              updated[idx].delivered_qty = parseInt(e.target.value) || 0
                              setEpodItems(updated)
                            }}
                            className="w-20 px-2 py-1 border rounded text-sm"
                          />
                          {item.delivered_qty < item.ordered_qty && (
                            <input type="text" placeholder="Lý do thiếu"
                              value={item.reason}
                              onChange={e => {
                                const updated = [...epodItems]
                                updated[idx].reason = e.target.value
                                setEpodItems(updated)
                              }}
                              className="flex-1 px-2 py-1 border rounded text-sm"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Receiver Info */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Người nhận</label>
                    <input type="text" value={epodReceiverName}
                      onChange={e => setEpodReceiverName(e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 border rounded text-sm" placeholder="Họ tên" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">SĐT nhận</label>
                    <input type="tel" value={epodReceiverPhone}
                      onChange={e => setEpodReceiverPhone(e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 border rounded text-sm" placeholder="Số điện thoại" />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-medium text-gray-700">Ghi chú</label>
                  <textarea value={epodNotes} onChange={e => setEpodNotes(e.target.value)}
                    rows={2} className="w-full mt-1 px-2 py-1.5 border rounded text-sm" />
                </div>

                <button onClick={handleSubmitEpod} disabled={actionLoading || !epodReceiverName}
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {actionLoading ? 'Đang gửi...' : '✅ Xác nhận giao hàng'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== PAYMENT MODAL ==================== */}
      {activeModal === 'payment' && selectedStop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">💰 Thu tiền</h2>
              <button onClick={() => setActiveModal(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500">
              {selectedStop.customer_name} · {selectedStop.order_number}
            </p>

            <div className="space-y-4">
              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium text-gray-700">Hình thức thanh toán</label>
                <div className="flex gap-2 mt-1">
                  {([
                    { v: 'cash', l: '💵 Tiền mặt' },
                    { v: 'transfer', l: '🏦 Chuyển khoản' },
                    { v: 'cod', l: '📦 COD' },
                  ] as const).map(m => (
                    <button key={m.v} onClick={() => setPaymentMethod(m.v)}
                      className={`px-3 py-1.5 text-sm rounded ${
                        paymentMethod === m.v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                      }`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-gray-700">Số tiền thu</label>
                <input type="number" value={paymentAmount}
                  onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-lg font-bold" />
                <p className="text-xs text-gray-400 mt-1">
                  Tổng đơn: {selectedStop.order_amount?.toLocaleString('vi-VN')}đ
                </p>
              </div>

              {/* Reference Number (for transfer) */}
              {paymentMethod === 'transfer' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Mã giao dịch</label>
                  <input type="text" value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Mã chuyển khoản" />
                </div>
              )}

              <button onClick={handleSubmitPayment} disabled={actionLoading || paymentAmount <= 0}
                className="w-full py-2.5 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50">
                {actionLoading ? 'Đang gửi...' : '💰 Xác nhận thu tiền'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RETURNS MODAL ==================== */}
      {activeModal === 'returns' && selectedStop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">📦 Thu hồi vỏ</h2>
              <button onClick={() => setActiveModal(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500">
              {selectedStop.customer_name}
            </p>

            {/* Existing returns */}
            {existingReturns.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <h3 className="text-sm font-medium text-green-700 mb-2">Đã thu hồi trước đó:</h3>
                {existingReturns.map((r, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{assetTypeLabels[r.asset_type] || r.asset_type} ({conditionLabels[r.condition] || r.condition})</span>
                    <span>×{r.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Return Items Form */}
            <div className="space-y-3">
              {returnItems.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Mục #{idx + 1}</span>
                    {returnItems.length > 1 && (
                      <button onClick={() => removeReturnItem(idx)} className="text-red-500 text-sm">Xóa</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Loại vỏ</label>
                      <select value={item.asset_type}
                        onChange={e => {
                          const updated = [...returnItems]
                          updated[idx].asset_type = e.target.value
                          setReturnItems(updated)
                        }}
                        className="w-full mt-0.5 px-2 py-1.5 border rounded text-sm">
                        <option value="bottle">Chai</option>
                        <option value="crate">Két</option>
                        <option value="keg">Keg</option>
                        <option value="pallet">Pallet</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Số lượng</label>
                      <input type="number" min={0} value={item.quantity}
                        onChange={e => {
                          const updated = [...returnItems]
                          updated[idx].quantity = parseInt(e.target.value) || 0
                          setReturnItems(updated)
                        }}
                        className="w-full mt-0.5 px-2 py-1.5 border rounded text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Tình trạng</label>
                    <div className="flex gap-2 mt-0.5">
                      {(['good', 'damaged', 'lost'] as const).map(c => (
                        <button key={c} onClick={() => {
                          const updated = [...returnItems]
                          updated[idx].condition = c
                          setReturnItems(updated)
                        }}
                          className={`px-2 py-1 text-xs rounded ${
                            item.condition === c ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}>
                          {conditionLabels[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addReturnItem}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500">
                + Thêm loại vỏ
              </button>
            </div>

            <button onClick={handleSubmitReturns} disabled={actionLoading || !returnItems.some(i => i.quantity > 0)}
              className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
              {actionLoading ? 'Đang gửi...' : '📦 Xác nhận thu hồi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
