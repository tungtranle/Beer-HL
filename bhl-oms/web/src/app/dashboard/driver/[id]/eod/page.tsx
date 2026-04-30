'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatVND } from '@/lib/status-config'
import { toast } from '@/lib/useToast'
import { useOnlineStatus } from '@/lib/useOnlineStatus'

interface EODCheckpoint {
  id: string
  checkpoint_type: string
  checkpoint_order: number
  status: string // pending, submitted, confirmed, rejected
  driver_data: any
  submitted_at: string | null
  receiver_name: string
  confirmed_at: string | null
  rejected_at: string | null
  reject_reason: string | null
}

interface EODSession {
  id: string
  trip_id: string
  status: string
  total_stops_delivered: number
  total_stops_failed: number
  total_cash_collected: number
  total_transfer_collected: number
  total_credit_amount: number
  trip_number: string
  vehicle_plate: string
  started_at: string
  completed_at: string | null
  checkpoints: EODCheckpoint[]
}



const checkpointLabels: Record<string, string> = {
  container_return: 'Giao vỏ & hàng trả → Thủ kho',
  cash_handover: 'Nộp tiền → Kế toán',
  vehicle_return: 'Giao xe → Đội trưởng',
}

const checkpointIcons: Record<string, string> = {
  container_return: '',
  cash_handover: '',
  vehicle_return: '',
}

const statusIcons: Record<string, string> = {
  pending: '',
  submitted: '📤',
  confirmed: '✓',
  rejected: '✗',
}

export default function DriverEODPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string
  const isOnline = useOnlineStatus()

  const [session, setSession] = useState<EODSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [activeCheckpoint, setActiveCheckpoint] = useState<string | null>(null)

  // Trạm 1: Container Return form state
  const [containerItems, setContainerItems] = useState<{ asset_type: string; epod_qty: number; actual_qty: number }[]>([
    { asset_type: 'crate', epod_qty: 0, actual_qty: 0 },
    { asset_type: 'bottle', epod_qty: 0, actual_qty: 0 },
  ])
  const [returnedGoods, setReturnedGoods] = useState<{ product_name: string; quantity: number; reason: string }[]>([])
  const [containerDiscrepancy, setContainerDiscrepancy] = useState('')

  // Trạm 2: Cash Handover - read-only view
  // Trạm 3: Vehicle Return form state
  const [kmEnd, setKmEnd] = useState(0)
  const [fuelLevel, setFuelLevel] = useState(60)
  const [vehicleChecklist, setVehicleChecklist] = useState({
    cabin_clean: true,
    tires_ok: true,
    lights_ok: true,
    mirrors_ok: true,
    has_damage: false,
  })
  const [damageDesc, setDamageDesc] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const loadSession = useCallback(async () => {
    try {
      const res: any = await apiFetch(`/driver/trips/${tripId}/eod`)
      setSession(res.data)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => { loadSession() }, [loadSession])

  // Auto-refresh to catch confirmations from receivers
  useEffect(() => {
    if (!session || session.status === 'completed') return
    const interval = setInterval(loadSession, 10000) // refresh every 10s
    return () => clearInterval(interval)
  }, [session, loadSession])

  const handleStartEOD = async () => {
    setStarting(true)
    try {
      const res: any = await apiFetch(`/driver/trips/${tripId}/eod/start`, { method: 'POST' })
      setSession(res.data)
      toast.success('Bắt đầu kết ca thành công')
    } catch (err: any) {
      toast.error(err?.message || 'Không thể bắt đầu kết ca')
    } finally {
      setStarting(false)
    }
  }

  const handleSubmitCheckpoint = async (cpType: string, driverData: any) => {
    setSubmitting(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/eod/checkpoint/${cpType}/submit`, {
        method: 'POST',
        body: { driver_data: driverData },
      })
      toast.success('Đã gửi cho người xác nhận')
      setActiveCheckpoint(null)
      await loadSession()
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi checkpoint')
    } finally {
      setSubmitting(false)
    }
  }

  // ===== RENDER STATES =====

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#F68634] border-t-transparent rounded-full" />
      </div>
    )
  }

  // Session completed — show success screen (W-TX-15)
  if (session?.status === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-white px-4">
        <div className="animate-bounce text-8xl mb-6">✓</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">KẾT CA HOÀN THÀNH</h1>
        <p className="text-gray-600 mb-6">
          Chuyến {session.trip_number} đã hoàn tất
        </p>
        <div className="w-full max-w-sm space-y-3 mb-8">
          {session.checkpoints?.map(cp => (
            <div key={cp.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-sm">
              <span className="text-green-600 text-lg">✓</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  Trạm {cp.checkpoint_order}: {checkpointLabels[cp.checkpoint_type]?.split('→')[0]}
                </div>
                <div className="text-xs text-gray-500">
                  {cp.confirmed_at ? new Date(cp.confirmed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  {cp.receiver_name ? ` · ${cp.receiver_name}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-sm text-gray-600 mb-6">
          Giao: {session.total_stops_delivered} điểm | Thu: {formatVND(session.total_cash_collected + session.total_transfer_collected)}
        </div>
        <button
          onClick={() => router.push('/dashboard/driver')}
          className="w-full max-w-sm h-14 bg-green-600 text-white rounded-xl text-lg font-semibold hover:bg-green-700 transition-colors"
        >
          Về trang chủ
        </button>
      </div>
    )
  }

  // No session yet — show summary + start button (W-TX-11 initial)
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-slate-800 text-white px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-white text-lg">◄</button>
            <div>
              <h1 className="text-lg font-bold">Kết ca</h1>
              <p className="text-sm text-slate-300">Bấm để bắt đầu quy trình kết ca 3 trạm</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          {!isOnline && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
               Bạn đang offline. Kết ca yêu cầu kết nối mạng.
            </div>
          )}
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Chưa bắt đầu kết ca cho chuyến này</p>
            <button
              onClick={handleStartEOD}
              disabled={starting || !isOnline}
              className="w-full h-16 bg-[#F68634] text-white rounded-xl text-lg font-bold hover:bg-[#e5752a] disabled:opacity-50 transition-colors"
            >
              {starting ? 'Đang xử lý...' : '▶ Bắt đầu kết ca'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Active session (W-TX-11 summary + 3 stations)
  const currentCheckpoint = session.checkpoints?.find(
    cp => cp.status === 'pending' || cp.status === 'rejected'
  )
  const _nextActionType = currentCheckpoint?.checkpoint_type

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white text-lg">◄</button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Kết ca</h1>
            <p className="text-sm text-slate-300">{session.trip_number} · {session.vehicle_plate}</p>
          </div>
        </div>
        {/* 3-step stepper */}
        <div className="flex items-center mt-3 px-1">
          {(session.checkpoints || []).map((cp, i) => {
            const done = cp.status === 'confirmed'
            const submitted = cp.status === 'submitted'
            const rejected = cp.status === 'rejected'
            const active = cp.status === 'pending' || rejected
            return (
              <div key={cp.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${done ? 'bg-green-500 border-green-400 text-white' : submitted ? 'bg-blue-500 border-blue-400 text-white' : rejected ? 'bg-red-500 border-red-400 text-white' : active ? 'bg-[#F68634] border-[#F68634] text-white animate-pulse' : 'bg-slate-600 border-slate-500 text-slate-300'}`}>
                    {done ? '✓' : rejected ? '!' : i + 1}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 text-center w-16 leading-tight">{checkpointIcons[cp.checkpoint_type]} {cp.checkpoint_order === 1 ? 'Vỏ/Hàng' : cp.checkpoint_order === 2 ? 'Tiền' : 'Xe'}</div>
                </div>
                {i < (session.checkpoints.length - 1) && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-400' : 'bg-slate-600'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{session.total_stops_delivered}</div>
            <div className="text-xs text-gray-500">Đã giao ✓</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600">{session.total_stops_failed}</div>
            <div className="text-xs text-gray-500">Thất bại ✗</div>
          </div>
        </div>

        {/* Cash Summary */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3"> Tiền cần nộp</h3>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-gray-600">Tiền mặt thu:</span>
              <span className="font-medium">{formatVND(session.total_cash_collected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Chuyển khoản:</span>
              <span className="font-medium">{formatVND(session.total_transfer_collected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Công nợ:</span>
              <span className="font-medium">{formatVND(session.total_credit_amount)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>TỔNG THU:</span>
              <span>{formatVND(session.total_cash_collected + session.total_transfer_collected)}</span>
            </div>
          </div>
        </div>

        {/* 3 Stations */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-gray-700 px-1">═══ 3 TRẠM XÁC NHẬN ═══</h3>

          {session.checkpoints?.map((cp) => {
            const isActive = cp.status === 'pending' || cp.status === 'rejected'
            const isPrevDone = cp.checkpoint_order === 1 ||
              session.checkpoints.find(c => c.checkpoint_order === cp.checkpoint_order - 1)?.status === 'confirmed'
            const canStart = isActive && isPrevDone

            return (
              <div
                key={cp.id}
                className={`rounded-xl p-4 shadow-sm border transition-all ${
                  cp.status === 'confirmed'
                    ? 'bg-green-50 border-green-200 opacity-80'
                    : cp.status === 'submitted'
                    ? 'bg-blue-50 border-blue-200'
                    : cp.status === 'rejected'
                    ? 'bg-red-50 border-red-200'
                    : canStart
                    ? 'bg-white border-[#F68634]'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{checkpointIcons[cp.checkpoint_type]}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">
                      ⓪{cp.checkpoint_order} {checkpointLabels[cp.checkpoint_type]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {cp.status === 'confirmed' && cp.confirmed_at
                        ? `✓ Xong lúc ${new Date(cp.confirmed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${cp.receiver_name}`
                        : cp.status === 'submitted'
                        ? '📤 Đã gửi — chờ xác nhận...'
                        : cp.status === 'rejected'
                        ? `✗ Bị từ chối: ${cp.reject_reason || ''}`
                        : canStart ? ' Sẵn sàng' : ' Chờ trạm trước'
                      }
                    </div>
                  </div>
                  <span className="text-xl">{statusIcons[cp.status]}</span>
                </div>

                {/* Action button for current station */}
                {canStart && activeCheckpoint !== cp.checkpoint_type && (
                  <button
                    onClick={() => setActiveCheckpoint(cp.checkpoint_type)}
                    className="w-full mt-3 h-12 bg-[#F68634] text-white rounded-lg font-semibold hover:bg-[#e5752a] transition-colors"
                  >
                    ▶ Bắt đầu trạm {cp.checkpoint_order}
                  </button>
                )}

                {/* Inline form for active checkpoint */}
                {activeCheckpoint === cp.checkpoint_type && canStart && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {cp.checkpoint_type === 'container_return' && (
                      <ContainerReturnForm
                        items={containerItems}
                        setItems={setContainerItems}
                        returnedGoods={returnedGoods}
                        setReturnedGoods={setReturnedGoods}
                        discrepancy={containerDiscrepancy}
                        setDiscrepancy={setContainerDiscrepancy}
                        onSubmit={() => {
                          const hasDiscrepancy = containerItems.some(i => i.actual_qty !== i.epod_qty)
                          if (hasDiscrepancy && !containerDiscrepancy.trim()) {
                            toast.error('Vui lòng nhập lý do sai lệch')
                            return
                          }
                          handleSubmitCheckpoint('container_return', {
                            items: containerItems,
                            returned_goods: returnedGoods,
                            discrepancy_reason: containerDiscrepancy || undefined,
                          })
                        }}
                        submitting={submitting}
                      />
                    )}

                    {cp.checkpoint_type === 'cash_handover' && (
                      <CashHandoverForm
                        cashTotal={session.total_cash_collected}
                        transferTotal={session.total_transfer_collected}
                        onSubmit={() => {
                          handleSubmitCheckpoint('cash_handover', {
                            total_cash: session.total_cash_collected,
                            total_transfer: session.total_transfer_collected,
                          })
                        }}
                        submitting={submitting}
                      />
                    )}

                    {cp.checkpoint_type === 'vehicle_return' && (
                      <VehicleReturnForm
                        kmEnd={kmEnd}
                        setKmEnd={setKmEnd}
                        fuelLevel={fuelLevel}
                        setFuelLevel={setFuelLevel}
                        checklist={vehicleChecklist}
                        setChecklist={setVehicleChecklist}
                        damageDesc={damageDesc}
                        setDamageDesc={setDamageDesc}
                        onSubmit={() => {
                          handleSubmitCheckpoint('vehicle_return', {
                            km_end: kmEnd,
                            fuel_level: fuelLevel,
                            checklist: vehicleChecklist,
                            damage_description: vehicleChecklist.has_damage ? damageDesc : undefined,
                          })
                        }}
                        submitting={submitting}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ===== Trạm 1: Container Return Form =====
function ContainerReturnForm({
  items, setItems, returnedGoods: _returnedGoods, setReturnedGoods: _setReturnedGoods,
  discrepancy, setDiscrepancy, onSubmit, submitting,
}: {
  items: { asset_type: string; epod_qty: number; actual_qty: number }[]
  setItems: (v: any) => void
  returnedGoods: { product_name: string; quantity: number; reason: string }[]
  setReturnedGoods: (v: any) => void
  discrepancy: string
  setDiscrepancy: (v: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  const hasDiscrepancy = items.some(i => i.actual_qty !== i.epod_qty)
  const assetLabels: Record<string, string> = {
    crate: 'Két 24 lon', bottle: 'Thùng chai 640ml', keg: 'Keg', pallet: 'Pallet',
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-gray-700">═══ VỎ THU VỀ ═══</h4>
      {items.map((item, idx) => (
        <div key={item.asset_type} className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm font-medium text-gray-700">{assetLabels[item.asset_type] || item.asset_type}</div>
          <div className="text-xs text-gray-500 mb-2">ePOD ghi nhận: {item.epod_qty}</div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Thực tế:</span>
            <button
              className="w-14 h-14 bg-gray-200 rounded-lg text-xl font-bold active:bg-gray-300"
              onClick={() => {
                const next = [...items]
                next[idx] = { ...item, actual_qty: Math.max(0, item.actual_qty - 1) }
                setItems(next)
              }}
            >−</button>
            <span className="text-xl font-bold w-12 text-center">{item.actual_qty}</span>
            <button
              className="w-14 h-14 bg-gray-200 rounded-lg text-xl font-bold active:bg-gray-300"
              onClick={() => {
                const next = [...items]
                next[idx] = { ...item, actual_qty: item.actual_qty + 1 }
                setItems(next)
              }}
            >+</button>
          </div>
          {item.actual_qty !== item.epod_qty && (
            <div className="mt-2 text-xs text-red-600 font-medium">
               Sai lệch: {item.actual_qty - item.epod_qty > 0 ? '+' : ''}{item.actual_qty - item.epod_qty}
            </div>
          )}
        </div>
      ))}

      {hasDiscrepancy && (
        <div>
          <label className="text-sm font-medium text-red-700">Lý do sai lệch (*)</label>
          <textarea
            value={discrepancy}
            onChange={e => setDiscrepancy(e.target.value)}
            className="w-full mt-1 p-3 border border-red-300 rounded-lg text-sm"
            placeholder="Nhập lý do sai lệch vỏ..."
            rows={2}
          />
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full h-14 bg-[#F68634] text-white rounded-xl text-base font-bold hover:bg-[#e5752a] disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Đang gửi...' : '✋ Gửi cho Thủ kho xác nhận'}
      </button>
    </div>
  )
}

// ===== Trạm 2: Cash Handover Form =====
function CashHandoverForm({
  cashTotal, transferTotal, onSubmit, submitting,
}: {
  cashTotal: number
  transferTotal: number
  onSubmit: () => void
  submitting: boolean
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-gray-700">═══ NỘP TIỀN MẶT ═══</h4>
      <div className="bg-yellow-50 rounded-lg p-4">
        <div className="text-center">
          <div className="text-xs text-gray-600 mb-1">Tiền mặt cần nộp</div>
          <div className="text-3xl font-bold text-gray-900 font-mono">{formatVND(cashTotal)}</div>
        </div>
      </div>
      {transferTotal > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm">
          <div className="text-gray-600">Chuyển khoản (đã đối chiếu): <span className="font-bold">{formatVND(transferTotal)}</span></div>
          <div className="text-xs text-gray-500 mt-1">✓ Đã xác nhận trên app ngân hàng</div>
        </div>
      )}
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full h-14 bg-[#F68634] text-white rounded-xl text-base font-bold hover:bg-[#e5752a] disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Đang gửi...' : ' Gửi cho Kế toán xác nhận'}
      </button>
    </div>
  )
}

// ===== Trạm 3: Vehicle Return Form =====
function VehicleReturnForm({
  kmEnd, setKmEnd, fuelLevel, setFuelLevel,
  checklist, setChecklist, damageDesc, setDamageDesc,
  onSubmit, submitting,
}: {
  kmEnd: number
  setKmEnd: (v: number) => void
  fuelLevel: number
  setFuelLevel: (v: number) => void
  checklist: Record<string, boolean>
  setChecklist: (v: any) => void
  damageDesc: string
  setDamageDesc: (v: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  const checklistItems = [
    { key: 'cabin_clean', label: 'Vệ sinh cabin sạch' },
    { key: 'tires_ok', label: 'Lốp xe bình thường' },
    { key: 'lights_ok', label: 'Đèn xi nhan, đèn phanh OK' },
    { key: 'mirrors_ok', label: 'Gương chiếu hậu nguyên vẹn' },
    { key: 'has_damage', label: 'Hư hỏng / sự cố' },
  ]

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold text-gray-700">═══ THÔNG TIN XE ═══</h4>

      <div className="bg-gray-50 rounded-lg p-3">
        <label className="text-sm text-gray-600">Km cuối ca</label>
        <input
          type="number"
          value={kmEnd || ''}
          onChange={e => setKmEnd(parseInt(e.target.value) || 0)}
          className="w-full mt-1 h-12 px-3 border rounded-lg text-lg font-mono"
          placeholder="Nhập km cuối ca..."
        />
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        <label className="text-sm text-gray-600">Nhiên liệu: {fuelLevel}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={fuelLevel}
          onChange={e => setFuelLevel(parseInt(e.target.value))}
          className="w-full mt-2 accent-[#F68634]"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-medium text-gray-700">Checklist bàn giao:</h5>
        {checklistItems.map(item => (
          <label
            key={item.key}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
              item.key === 'has_damage' && checklist.has_damage
                ? 'bg-red-50 border border-red-200'
                : 'bg-white border border-gray-100'
            }`}
          >
            <input
              type="checkbox"
              checked={checklist[item.key]}
              onChange={e => setChecklist({ ...checklist, [item.key]: e.target.checked })}
              className="w-5 h-5 accent-[#F68634]"
            />
            <span className="text-sm">{item.label}</span>
          </label>
        ))}
      </div>

      {checklist.has_damage && (
        <div>
          <label className="text-sm font-medium text-red-700">Mô tả hư hỏng (*)</label>
          <textarea
            value={damageDesc}
            onChange={e => setDamageDesc(e.target.value)}
            className="w-full mt-1 p-3 border border-red-300 rounded-lg text-sm"
            placeholder="Nhập mô tả hư hỏng..."
            rows={2}
          />
        </div>
      )}

      <button
        onClick={() => {
          if (checklist.has_damage && !damageDesc.trim()) {
            toast.error('Vui lòng mô tả hư hỏng')
            return
          }
          onSubmit()
        }}
        disabled={submitting}
        className="w-full h-14 bg-[#F68634] text-white rounded-xl text-base font-bold hover:bg-[#e5752a] disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Đang gửi...' : ' Gửi cho Đội trưởng xác nhận'}
      </button>
    </div>
  )
}
