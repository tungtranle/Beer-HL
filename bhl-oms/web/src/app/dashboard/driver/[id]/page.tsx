'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, getUser } from '@/lib/api'
import { useGpsTracker } from '@/lib/useGpsTracker'

interface Stop {
  id: string
  customer_name: string
  customer_address: string
  customer_phone: string
  customer_id: string
  stop_order: number
  status: string
  order_number: string
  order_amount: number
  order_items: { product_id: string; product_name: string; quantity: number; unit_price: number }[]
  actual_arrival: string | null
  actual_departure: string | null
  estimated_arrival: string | null
  latitude: number | null
  longitude: number | null
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

type ModalType = 'epod' | 'payment' | 'returns' | 'checklist' | 'incident' | 'trip_summary' | 'post_checklist' | null

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
  cancelled: 'Đã hủy', checked: 'Đã kiểm tra xe', loading: 'Đang xếp hàng',
  gate_checked: 'Đã kiểm tra cổng', returning: 'Đang về kho',
  settling: 'Đang đối soát', reconciled: 'Đã đối soát',
}

const stopStatusLabels: Record<string, string> = {
  pending: 'Chờ giao', arrived: 'Đã đến', delivering: 'Đang giao',
  delivered: 'Đã giao', partial: 'Giao một phần', partially_delivered: 'Giao một phần',
  failed: 'Thất bại', rejected: 'NPP từ chối', skipped: 'Bỏ qua', re_delivery: 'Giao lại',
}

const stopStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700', arrived: 'bg-blue-100 text-blue-700',
  delivering: 'bg-amber-100 text-amber-700', delivered: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700', partially_delivered: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700', rejected: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500', re_delivery: 'bg-orange-100 text-orange-700',
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

  // Start GPS tracking for driver
  useGpsTracker()

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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit' | 'partial'>('cash')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentRef, setPaymentRef] = useState('')

  // Returns form state
  const [returnItems, setReturnItems] = useState<{ asset_type: string; quantity: number; condition: string; notes: string }[]>([])
  const [existingReturns, setExistingReturns] = useState<ReturnData[]>([])

  // Checklist form state
  const [checklistForm, setChecklistForm] = useState({
    tires_ok: true, brakes_ok: true, lights_ok: true, mirrors_ok: true,
    horn_ok: true, coolant_ok: true, oil_ok: true, fuel_level: 100,
    fire_extinguisher_ok: true, first_aid_ok: true, documents_ok: true, cargo_secured: true,
    notes: '',
  })

  // Incident form state
  const [incidentType, setIncidentType] = useState<string>('address_wrong')
  const [incidentDesc, setIncidentDesc] = useState('')

  // ePOD photo state (base64 previews)
  const [epodPhotos, setEpodPhotos] = useState<string[]>([])

  // Post-trip checklist state (US-TMS-18)
  const [postChecklist, setPostChecklist] = useState({
    vehicle_clean: false, vehicle_no_damage: false, fuel_noted: false,
    cash_ready: false, returns_collected: false, keys_ready: false,
  })

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

  const handleUpdateStop = async (stopId: string, action: string) => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/stops/${stopId}/update`, {
        method: 'PUT',
        body: { action },
      })
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  // --- Checklist ---
  const openChecklistModal = () => {
    setChecklistForm({
      tires_ok: true, brakes_ok: true, lights_ok: true, mirrors_ok: true,
      horn_ok: true, coolant_ok: true, oil_ok: true, fuel_level: 100,
      fire_extinguisher_ok: true, first_aid_ok: true, documents_ok: true, cargo_secured: true,
      notes: '',
    })
    setActiveModal('checklist')
  }

  const handleSubmitChecklist = async () => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/checklist`, {
        method: 'POST',
        body: { ...checklistForm, notes: checklistForm.notes || undefined },
      })
      setActiveModal(null)
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  // --- Incident ---
  const openIncidentModal = (stop: Stop) => {
    setSelectedStop(stop)
    setIncidentType('address_wrong')
    setIncidentDesc('')
    setActiveModal('incident')
  }

  const handleSubmitIncident = async () => {
    if (!selectedStop) return
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/stops/${selectedStop.id}/update`, {
        method: 'PUT',
        body: { action: 'fail', notes: `[${incidentType}] ${incidentDesc}` },
      })
      setActiveModal(null)
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  // --- Trip Summary ---
  const openTripSummary = () => {
    setActiveModal('trip_summary')
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
    setEpodPhotos([])

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
        body: {
          delivery_status: epodDeliveryStatus,
          delivered_items: epodItems,
          receiver_name: epodReceiverName,
          receiver_phone: epodReceiverPhone,
          notes: epodNotes || undefined,
        },
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
        body: {
          payment_method: paymentMethod,
          amount: paymentAmount,
          reference_number: paymentRef || undefined,
        },
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
        body: { items: validItems },
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
      {/* Pre-trip checklist - required before starting */}
      {(trip.status === 'planned' || trip.status === 'assigned' || trip.status === 'ready') && !trip.checklist && (
        <div className="space-y-2">
          <button onClick={openChecklistModal} disabled={actionLoading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
            📋 Kiểm tra xe trước khi xuất phát
          </button>
          <p className="text-xs text-center text-gray-500">Bắt buộc kiểm tra xe trước khi bắt đầu chuyến</p>
        </div>
      )}

      {(trip.status === 'planned' || trip.status === 'assigned' || trip.status === 'ready') && trip.checklist?.is_passed && (
        <button onClick={handleStartTrip} disabled={actionLoading}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
          {actionLoading ? 'Đang xử lý...' : '🚀 Bắt đầu chuyến xe'}
        </button>
      )}

      {(trip.status === 'planned' || trip.status === 'assigned' || trip.status === 'ready') && trip.checklist && !trip.checklist.is_passed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-red-700 font-medium">⚠️ Xe không đạt kiểm tra</p>
          <p className="text-red-600 text-sm">Vui lòng báo trưởng nhóm để đổi xe</p>
        </div>
      )}

      {trip.status === 'in_transit' && trip.stops?.every(s => s.status === 'delivered' || s.status === 'failed' || s.status === 'skipped' || s.status === 'partially_delivered') && (
        <div className="space-y-2">
          <button onClick={() => {
            setPostChecklist({ vehicle_clean: false, vehicle_no_damage: false, fuel_noted: false, cash_ready: false, returns_collected: false, keys_ready: false })
            setActiveModal('post_checklist')
          }} disabled={actionLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {actionLoading ? 'Đang xử lý...' : '✅ Hoàn thành chuyến xe'}
          </button>
        </div>
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
                  <p className="text-sm text-gray-500 mt-1 ml-8">📍 {stop.customer_address}</p>
                  {stop.customer_phone && (
                    <p className="text-sm text-gray-500 mt-0.5 ml-8">
                      <a href={`tel:${stop.customer_phone}`} className="text-blue-600 hover:underline">📞 {stop.customer_phone}</a>
                    </p>
                  )}
                  {stop.estimated_arrival && (
                    <p className="text-sm text-gray-400 mt-0.5 ml-8">
                      🕐 Dự kiến: {new Date(stop.estimated_arrival).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {stop.order_number && (
                    <p className="text-sm text-gray-400 mt-0.5 ml-8">
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
              {/* Navigation button for all pending/arrived stops */}
              {trip.status === 'in_transit' && (stop.status === 'pending' || stop.status === 'arrived') && (
                <div className="mt-2 ml-8">
                  <a href={stop.latitude && stop.longitude
                    ? `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.customer_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm rounded hover:bg-emerald-100 transition">
                    🗺️ Chỉ đường
                  </a>
                </div>
              )}

              {trip.status === 'in_transit' && stop.status === 'pending' && (
                <div className="mt-2 ml-8 flex gap-2">
                  <button onClick={() => handleUpdateStop(stop.id, 'arrive')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                    📍 Đã đến nơi
                  </button>
                </div>
              )}
              {trip.status === 'in_transit' && stop.status === 'arrived' && (
                <div className="mt-2 ml-8 flex flex-wrap gap-2">
                  <button onClick={() => handleUpdateStop(stop.id, 'delivering')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50">
                    📦 Bắt đầu hạ hàng
                  </button>
                  <button onClick={() => openIncidentModal(stop)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded hover:bg-orange-200 disabled:opacity-50">
                    ⚠️ Báo sự cố
                  </button>
                </div>
              )}
              {trip.status === 'in_transit' && stop.status === 'delivering' && (
                <div className="mt-2 ml-8 flex flex-wrap gap-2">
                  <button onClick={() => openEpodModal(stop)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                    📝 Xác nhận giao hàng (ePOD)
                  </button>
                  <button onClick={() => handleUpdateStop(stop.id, 'fail')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
                    ❌ NPP từ chối nhận
                  </button>
                  <button onClick={() => openIncidentModal(stop)} disabled={actionLoading}
                    className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded hover:bg-orange-200 disabled:opacity-50">
                    ⚠️ Sự cố
                  </button>
                </div>
              )}
              {trip.status === 'in_transit' && (stop.status === 'delivered' || stop.status === 'partially_delivered') && (
                <div className="mt-2 ml-8 flex flex-wrap gap-2">
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
                    👁 Xem biên bản
                  </button>
                </div>
              )}
              {trip.status === 'in_transit' && stop.status === 'failed' && (
                <div className="mt-2 ml-8">
                  <span className="text-xs text-red-500">Giao thất bại — Điều phối sẽ lên lịch giao lại</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Checklist Summary (if exists) */}
      {trip.checklist && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-2">Bảng kiểm tra xe</h2>
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
                {existingEpod ? '📋 Biên bản giao hàng' : '📝 Xác nhận giao hàng'}
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

                {/* Photo Evidence */}
                <div>
                  <label className="text-sm font-medium text-gray-700">📷 Ảnh giao hàng <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-400 mb-1">Chụp ít nhất 1 ảnh xác nhận giao hàng</p>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {epodPhotos.map((photo, idx) => (
                      <div key={idx} className="relative w-20 h-20">
                        <img src={photo} alt={`ePOD ${idx + 1}`} className="w-full h-full object-cover rounded border" />
                        <button onClick={() => setEpodPhotos(epodPhotos.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                      </div>
                    ))}
                    <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-blue-400">
                      <span className="text-2xl text-gray-400">📷</span>
                      <span className="text-xs text-gray-400">Thêm ảnh</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => { if (reader.result) setEpodPhotos(prev => [...prev, reader.result as string]) }
                        reader.readAsDataURL(file)
                        e.target.value = ''
                      }} />
                    </label>
                  </div>
                </div>

                <button onClick={handleSubmitEpod} disabled={actionLoading || !epodReceiverName || epodPhotos.length === 0}
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {actionLoading ? 'Đang gửi...' : '✅ Xác nhận giao hàng'}
                </button>
                {epodPhotos.length === 0 && (
                  <p className="text-xs text-red-500 text-center">Vui lòng chụp ít nhất 1 ảnh để xác nhận</p>
                )}
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
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {([
                    { v: 'cash', l: '💵 Tiền mặt' },
                    { v: 'transfer', l: '🏦 Chuyển khoản' },
                    { v: 'credit', l: '📝 Công nợ' },
                    { v: 'partial', l: '💰 Thu một phần' },
                  ] as const).map(m => (
                    <button key={m.v} onClick={() => setPaymentMethod(m.v as typeof paymentMethod)}
                      className={`px-3 py-2 text-sm rounded-lg border transition ${
                        paymentMethod === m.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                      }`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount - not shown for credit */}
              {paymentMethod !== 'credit' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Số tiền thu</label>
                  <input type="number" value={paymentAmount}
                    onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-lg font-bold" />
                  <p className="text-xs text-gray-400 mt-1">
                    Tổng đơn: {selectedStop.order_amount?.toLocaleString('vi-VN')}đ
                  </p>
                </div>
              )}

              {/* Credit / Debt notice */}
              {paymentMethod === 'credit' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-amber-800 text-sm font-medium">📝 Ghi công nợ</p>
                  <p className="text-amber-600 text-xs mt-1">Số tiền {selectedStop.order_amount?.toLocaleString('vi-VN')}đ sẽ được ghi vào công nợ NPP</p>
                </div>
              )}

              {/* Reference Number (for transfer) */}
              {paymentMethod === 'transfer' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Mã giao dịch</label>
                  <input type="text" value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Mã chuyển khoản" />
                </div>
              )}

              <button onClick={handleSubmitPayment}
                disabled={actionLoading || (paymentMethod !== 'credit' && paymentAmount <= 0)}
                className="w-full py-2.5 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50">
                {actionLoading ? 'Đang gửi...' : paymentMethod === 'credit' ? '📝 Xác nhận ghi nợ' : '💰 Xác nhận thu tiền'}
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
                  {/* Photo required for damaged/lost */}
                  {(item.condition === 'damaged' || item.condition === 'lost') && (
                    <div className="mt-1">
                      <label className="text-xs text-red-500 font-medium">📷 Ảnh bắt buộc (hư hỏng/mất)</label>
                      <label className="mt-1 block w-full py-2 border-2 border-dashed border-red-300 rounded text-center text-sm text-red-500 cursor-pointer hover:border-red-400">
                        📷 Chụp ảnh minh chứng
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => {}} />
                      </label>
                    </div>
                  )}
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

      {/* ==================== CHECKLIST MODAL ==================== */}
      {activeModal === 'checklist' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">📋 Kiểm tra xe trước khi xuất phát</h2>
              <button onClick={() => setActiveModal(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500">{trip.vehicle_plate} · {trip.trip_number}</p>

            <div className="space-y-3">
              {([
                { key: 'tires_ok', label: '🛞 Lốp xe' },
                { key: 'brakes_ok', label: '🛑 Phanh' },
                { key: 'lights_ok', label: '💡 Đèn' },
                { key: 'mirrors_ok', label: '🪞 Gương' },
                { key: 'horn_ok', label: '📯 Còi' },
                { key: 'coolant_ok', label: '💧 Nước làm mát' },
                { key: 'oil_ok', label: '🛢️ Dầu' },
                { key: 'fire_extinguisher_ok', label: '🧯 Bình chữa cháy' },
                { key: 'first_aid_ok', label: '🩺 Sơ cứu' },
                { key: 'documents_ok', label: '📄 Giấy tờ xe' },
                { key: 'cargo_secured', label: '📦 Hàng hóa cố định' },
              ] as const).map(item => (
                <div key={item.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setChecklistForm(prev => ({ ...prev, [item.key]: true }))}
                      className={`px-3 py-1 text-xs rounded-lg font-medium ${
                        checklistForm[item.key] ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>✓ Đạt</button>
                    <button onClick={() => setChecklistForm(prev => ({ ...prev, [item.key]: false }))}
                      className={`px-3 py-1 text-xs rounded-lg font-medium ${
                        !checklistForm[item.key] ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>✗ Lỗi</button>
                  </div>
                </div>
              ))}

              {/* Fuel Level */}
              <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">⛽ Mức nhiên liệu</span>
                  <span className="text-sm font-bold text-blue-600">{checklistForm.fuel_level}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={checklistForm.fuel_level}
                  onChange={e => setChecklistForm(prev => ({ ...prev, fuel_level: parseInt(e.target.value) }))}
                  className="w-full mt-2" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-gray-700">Ghi chú (nếu có)</label>
                <textarea value={checklistForm.notes}
                  onChange={e => setChecklistForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2} className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
                  placeholder="Ghi chú thêm về tình trạng xe..." />
              </div>

              {/* Summary */}
              {Object.entries(checklistForm).some(([k, v]) => k !== 'fuel_level' && k !== 'notes' && v === false) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm font-medium">⚠️ Có hạng mục không đạt:</p>
                  <ul className="text-red-600 text-xs mt-1 list-disc list-inside">
                    {!checklistForm.tires_ok && <li>Lốp xe</li>}
                    {!checklistForm.brakes_ok && <li>Phanh</li>}
                    {!checklistForm.lights_ok && <li>Đèn</li>}
                    {!checklistForm.mirrors_ok && <li>Gương</li>}
                    {!checklistForm.horn_ok && <li>Còi</li>}
                    {!checklistForm.coolant_ok && <li>Nước làm mát</li>}
                    {!checklistForm.oil_ok && <li>Dầu</li>}
                    {!checklistForm.fire_extinguisher_ok && <li>Bình chữa cháy</li>}
                    {!checklistForm.first_aid_ok && <li>Sơ cứu</li>}
                    {!checklistForm.documents_ok && <li>Giấy tờ xe</li>}
                    {!checklistForm.cargo_secured && <li>Hàng hóa</li>}
                  </ul>
                </div>
              )}

              <button onClick={handleSubmitChecklist} disabled={actionLoading}
                className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                {actionLoading ? 'Đang gửi...' : '📋 Gửi kiểm tra xe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== INCIDENT MODAL ==================== */}
      {activeModal === 'incident' && selectedStop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">⚠️ Báo sự cố</h2>
              <button onClick={() => setActiveModal(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500">
              {selectedStop.customer_name} · {selectedStop.order_number}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Loại sự cố</label>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {[
                    { v: 'address_wrong', l: '📍 Sai địa chỉ giao hàng' },
                    { v: 'customer_absent', l: '🚫 Khách hàng không có mặt' },
                    { v: 'vehicle_breakdown', l: '🔧 Hư hỏng xe' },
                    { v: 'traffic_police', l: '👮 Bị CSGT giữ' },
                    { v: 'road_blocked', l: '🚧 Đường bị chặn / ngập' },
                    { v: 'accident', l: '💥 Tai nạn giao thông' },
                    { v: 'other', l: '📋 Khác' },
                  ].map(t => (
                    <button key={t.v} onClick={() => setIncidentType(t.v)}
                      className={`px-3 py-2 text-sm text-left rounded-lg border transition ${
                        incidentType === t.v ? 'bg-orange-50 border-orange-400 text-orange-700' : 'bg-white border-gray-200 hover:border-orange-300'
                      }`}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Mô tả chi tiết</label>
                <textarea value={incidentDesc} onChange={e => setIncidentDesc(e.target.value)}
                  rows={3} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  placeholder="Mô tả tình huống cụ thể..." />
              </div>

              {/* Photo evidence */}
              <div>
                <label className="text-sm font-medium text-gray-700">📷 Ảnh minh chứng</label>
                <label className="mt-1 block w-full py-3 border-2 border-dashed border-orange-300 rounded-lg text-center text-sm text-orange-500 cursor-pointer hover:border-orange-400">
                  📷 Chụp ảnh hiện trường
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => {}} />
                </label>
              </div>

              <button onClick={handleSubmitIncident} disabled={actionLoading || !incidentDesc.trim()}
                className="w-full py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50">
                {actionLoading ? 'Đang gửi...' : '⚠️ Gửi báo sự cố'}
              </button>
              <p className="text-xs text-gray-400 text-center">Điều phối viên sẽ nhận thông báo và hướng dẫn bạn</p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TRIP SUMMARY MODAL ==================== */}
      {/* ==================== POST-TRIP CHECKLIST MODAL (US-TMS-18) ==================== */}
      {activeModal === 'post_checklist' && trip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">📋 Checklist cuối chuyến</h2>
              <button onClick={() => setActiveModal(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500">Kiểm tra và xác nhận trước khi hoàn thành chuyến xe</p>

            <div className="space-y-3">
              {[
                { key: 'vehicle_clean', label: 'Xe sạch sẽ, cabin gọn gàng' },
                { key: 'vehicle_no_damage', label: 'Xe không hư hỏng mới phát sinh' },
                { key: 'fuel_noted', label: 'Đã ghi nhận mức nhiên liệu còn lại' },
                { key: 'cash_ready', label: 'Tiền mặt đã thu sẵn sàng nộp kế toán' },
                { key: 'returns_collected', label: 'Vỏ thu hồi đã kiểm đếm đầy đủ' },
                { key: 'keys_ready', label: 'Sẵn sàng bàn giao chìa khóa xe' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input type="checkbox"
                    checked={(postChecklist as any)[item.key]}
                    onChange={(e) => setPostChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 rounded" />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>

            <button
              onClick={() => { setActiveModal(null); openTripSummary() }}
              disabled={!Object.values(postChecklist).every(Boolean)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg">
              {Object.values(postChecklist).every(Boolean) ? '→ Xem tổng kết chuyến xe' : '⬜ Vui lòng check hết các mục'}
            </button>
          </div>
        </div>
      )}

      {/* ==================== TRIP SUMMARY MODAL ==================== */}
      {activeModal === 'trip_summary' && trip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">📊 Tổng kết chuyến xe</h2>
              <button onClick={() => setActiveModal(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="space-y-3">
              {/* Delivery stats */}
              <div className="bg-blue-50 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">🚚 Giao hàng</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-600">
                      {trip.stops?.filter(s => s.status === 'delivered').length || 0}
                    </div>
                    <div className="text-xs text-gray-500">Thành công</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-yellow-600">
                      {trip.stops?.filter(s => s.status === 'partially_delivered').length || 0}
                    </div>
                    <div className="text-xs text-gray-500">Một phần</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600">
                      {trip.stops?.filter(s => s.status === 'failed' || s.status === 'skipped').length || 0}
                    </div>
                    <div className="text-xs text-gray-500">Thất bại</div>
                  </div>
                </div>
              </div>

              {/* Route stats */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">📏 Lộ trình</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Tổng quãng đường: <strong>{trip.total_distance_km?.toFixed(1)} km</strong></div>
                  <div>Tổng thời gian: <strong>~{trip.total_duration_min} phút</strong></div>
                  <div>Tổng trọng lượng: <strong>{trip.total_weight_kg?.toFixed(0)} kg</strong></div>
                  <div>Tổng điểm giao: <strong>{trip.total_stops}</strong></div>
                </div>
              </div>

              {/* Financial summary */}
              <div className="bg-green-50 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-green-800 mb-2">💰 Thu tiền</h3>
                <div className="text-sm text-gray-700">
                  <p>Tổng tiền đơn hàng: <strong>{(trip.stops?.reduce((sum, s) => sum + (s.order_amount || 0), 0) || 0).toLocaleString('vi-VN')}đ</strong></p>
                  <p className="text-xs text-gray-500 mt-1">Chi tiết thu/nợ sẽ được đối soát bởi kế toán</p>
                </div>
              </div>

              {/* Confirmation */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-800 text-sm"><strong>Lưu ý:</strong> Sau khi hoàn thành, bạn cần:</p>
                <ul className="text-amber-700 text-xs mt-1 list-disc list-inside space-y-1">
                  <li>Mang tiền mặt đã thu nộp cho kế toán</li>
                  <li>Giao vỏ thu hồi cho thủ kho kiểm đếm</li>
                  <li>Bàn giao xe và chìa khóa cho trưởng nhóm</li>
                </ul>
              </div>

              <button onClick={async () => { setActiveModal(null); await handleCompleteTrip() }} disabled={actionLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 text-lg">
                {actionLoading ? 'Đang xử lý...' : '✅ Xác nhận hoàn thành chuyến xe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
