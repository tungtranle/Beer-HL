'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { formatVND } from '@/lib/status-config'
import { toast } from '@/lib/useToast'

interface EODCheckpoint {
  id: string
  session_id: string
  trip_id: string
  checkpoint_type: string
  checkpoint_order: number
  status: string
  driver_data: any
  submitted_at: string | null
  receiver_name: string
  confirmed_at: string | null
}

const cpTypeLabels: Record<string, string> = {
  container_return: 'Nhận vỏ & hàng trả từ tài xế',
  cash_handover: 'Nhận tiền từ tài xế',
  vehicle_return: 'Nhận xe từ tài xế',
}

const cpTypeIcons: Record<string, string> = {
  container_return: '',
  cash_handover: '',
  vehicle_return: '',
}

// Subpage selection
type ViewMode = 'list' | 'detail'

export default function EODReceiverPage() {
  const user = getUser()
  const [checkpoints, setCheckpoints] = useState<EODCheckpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCp, setSelectedCp] = useState<EODCheckpoint | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [processing, setProcessing] = useState(false)

  // Determine checkpoint type based on user role
  const getCpType = () => {
    if (!user) return 'container_return'
    const role = user.role
    if (role === 'warehouse_handler') return 'container_return'
    if (role === 'accountant') return 'cash_handover'
    if (role === 'dispatcher' || role === 'admin') return 'vehicle_return'
    return 'container_return' // fallback
  }
  const cpType = getCpType()

  // Receiver form state
  const [receiverData, setReceiverData] = useState<any>({})
  const [discrepancyReason, setDiscrepancyReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const loadPending = useCallback(async () => {
    try {
      const res: any = await apiFetch(`/eod/pending/${cpType}`)
      setCheckpoints(res.data || [])
    } catch {
      setCheckpoints([])
    } finally {
      setLoading(false)
    }
  }, [cpType])

  useEffect(() => { loadPending() }, [loadPending])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(loadPending, 15000)
    return () => clearInterval(interval)
  }, [loadPending])

  const handleConfirm = async (checkpointId: string) => {
    setProcessing(true)
    try {
      await apiFetch(`/eod/checkpoint/${checkpointId}/confirm`, {
        method: 'POST',
        body: {
          receiver_data: receiverData,
          discrepancy_reason: discrepancyReason || undefined,
        },
      })
      toast.success('Đã xác nhận thành công')
      setViewMode('list')
      setSelectedCp(null)
      await loadPending()
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xác nhận')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (checkpointId: string) => {
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối')
      return
    }
    setProcessing(true)
    try {
      await apiFetch(`/eod/checkpoint/${checkpointId}/reject`, {
        method: 'POST',
        body: { reason: rejectReason },
      })
      toast.success('Đã từ chối — tài xế sẽ gửi lại')
      setViewMode('list')
      setSelectedCp(null)
      setRejectReason('')
      await loadPending()
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi từ chối')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  // List view
  if (viewMode === 'list') {
    const eodSteps = [
      { key: 'container_return', label: 'Nhận vỏ & hàng trả', icon: '', role: 'warehouse_handler' },
      { key: 'cash_handover', label: 'Nhận tiền mặt', icon: '', role: 'accountant' },
      { key: 'vehicle_return', label: 'Nhận xe về kho', icon: '', role: 'dispatcher/admin' },
    ]
    const activeStep = eodSteps.findIndex(s => s.key === cpType)

    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* EOD 3-step progress */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-6">
          <div className="flex items-center">
            {eodSteps.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className={`flex flex-col items-center gap-1 ${i === activeStep ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition ${
                    i < activeStep ? 'bg-brand-500 border-brand-500 text-white' :
                    i === activeStep ? 'border-brand-500 bg-brand-50 text-brand-600' :
                    'border-gray-200 bg-gray-50 text-gray-400'
                  }`}>
                    {i < activeStep ? '✓' : step.icon}
                  </div>
                  <div className={`text-xs font-medium ${i === activeStep ? 'text-brand-600' : 'text-gray-400'}`}>{step.label}</div>
                  <div className="text-[10px] text-gray-400">{step.role}</div>
                </div>
                {i < eodSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-7 ${i < activeStep ? 'bg-brand-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">{cpTypeIcons[cpType]}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cpTypeLabels[cpType]}</h1>
            <p className="text-sm text-gray-500">
              {checkpoints.length > 0
                ? `${checkpoints.length} yêu cầu đang chờ xác nhận`
                : 'Không có yêu cầu nào đang chờ'
              }
            </p>
          </div>
        </div>

        {checkpoints.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <div className="text-6xl mb-4"></div>
            <p className="text-gray-500">Chưa có tài xế nào gửi yêu cầu {cpTypeLabels[cpType]?.toLowerCase()}</p>
            <p className="text-xs text-gray-400 mt-2">Trang sẽ tự cập nhật mỗi 15 giây</p>
          </div>
        ) : (
          <div className="space-y-3">
            {checkpoints.map(cp => (
              <div
                key={cp.id}
                onClick={() => { setSelectedCp(cp); setViewMode('detail'); setReceiverData({}); setDiscrepancyReason(''); }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:border-[#F68634] hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-800">
                      Chuyến xe (Trip)
                    </div>
                    <div className="text-sm text-gray-500">
                      Gửi lúc: {cp.submitted_at ? new Date(cp.submitted_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  <span className="text-sm text-[#F68634] font-medium">Xem chi tiết →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Detail view
  if (!selectedCp) return null
  const driverData = selectedCp.driver_data

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => { setViewMode('list'); setSelectedCp(null) }}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Quay lại danh sách
      </button>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{cpTypeIcons[cpType]}</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{cpTypeLabels[cpType]}</h1>
          <p className="text-sm text-gray-500">
            Gửi lúc: {selectedCp.submitted_at ? new Date(selectedCp.submitted_at).toLocaleString('vi-VN') : '—'}
          </p>
        </div>
      </div>

      {/* Container Return — W-WH-06 */}
      {cpType === 'container_return' && driverData && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Vỏ trả về</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left py-2">Loại vỏ</th>
                  <th className="text-center py-2">TX khai</th>
                  <th className="text-center py-2">TK đếm</th>
                  <th className="text-center py-2">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {(driverData.items || []).map((item: any, idx: number) => {
                  const tkCount = receiverData[`count_${idx}`] ?? item.actual_qty
                  const match = tkCount === item.actual_qty
                  return (
                    <tr key={idx} className="border-b">
                      <td className="py-2">{item.asset_type === 'crate' ? 'Két 24 lon' : item.asset_type === 'bottle' ? 'Thùng chai' : item.asset_type}</td>
                      <td className="text-center">{item.actual_qty}</td>
                      <td className="text-center">
                        <input
                          type="number"
                          value={tkCount}
                          onChange={e => setReceiverData({ ...receiverData, [`count_${idx}`]: parseInt(e.target.value) || 0 })}
                          className="w-20 text-center border rounded px-2 py-1"
                        />
                      </td>
                      <td className={`text-center font-medium ${match ? 'text-green-600' : 'text-red-600'}`}>
                        {match ? '✓ Khớp' : '✗ Lệch'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Handover — W-KT-07 */}
      {cpType === 'cash_handover' && driverData && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Tiền TX khai nộp</h3>
            <div className="flex items-center justify-between bg-yellow-50 rounded-lg p-4 mb-4">
              <span className="text-gray-700">Tiền mặt:</span>
              <span className="text-2xl font-bold font-mono">{formatVND(driverData.total_cash || 0)}</span>
            </div>
            {driverData.total_transfer > 0 && (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg p-4 mb-4">
                <span className="text-gray-700">Chuyển khoản:</span>
                <span className="text-lg font-bold font-mono">{formatVND(driverData.total_transfer)}</span>
              </div>
            )}
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">KT đếm thực tế (tiền mặt):</label>
              <input
                type="number"
                value={receiverData.actual_cash ?? driverData.total_cash ?? 0}
                onChange={e => setReceiverData({ ...receiverData, actual_cash: parseInt(e.target.value) || 0 })}
                className="w-full mt-1 h-12 px-3 border rounded-lg text-lg font-mono"
              />
            </div>
            {receiverData.actual_cash !== undefined && receiverData.actual_cash !== driverData.total_cash && (
              <div className="mt-2 text-sm text-red-600 font-medium">
                Chênh lệch: {formatVND(receiverData.actual_cash - driverData.total_cash)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vehicle Return — W-DT-01 */}
      {cpType === 'vehicle_return' && driverData && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Thông tin xe</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Km cuối ca:</span>
                <span className="font-mono font-medium">{driverData.km_end?.toLocaleString()} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Nhiên liệu:</span>
                <span className="font-medium">{driverData.fuel_level}%</span>
              </div>
            </div>
            <h4 className="font-medium text-gray-700 mt-4 mb-2">Checklist TX khai:</h4>
            {driverData.checklist && Object.entries(driverData.checklist).map(([key, val]: [string, any]) => (
              <div key={key} className="flex items-center gap-2 text-sm py-1">
                <span>{val ? '✓' : ''}</span>
                <span>{key.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {driverData.damage_description && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm font-medium text-red-700">Hư hỏng:</div>
                <div className="text-sm text-red-600">{driverData.damage_description}</div>
              </div>
            )}
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">Tình trạng xe:</label>
              <div className="flex gap-3 mt-2">
                {['good', 'needs_repair', 'severe'].map(v => (
                  <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                    receiverData.vehicle_condition === v ? 'border-[#F68634] bg-orange-50' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="condition"
                      checked={receiverData.vehicle_condition === v}
                      onChange={() => setReceiverData({ ...receiverData, vehicle_condition: v })}
                      className="accent-[#F68634]"
                    />
                    <span className="text-sm">{v === 'good' ? 'Tốt' : v === 'needs_repair' ? 'Cần sửa' : 'Nặng'}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Reason (all types) */}
      <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
        <label className="text-sm font-medium text-gray-700">Ghi chú / Lý do sai lệch (nếu có):</label>
        <textarea
          value={discrepancyReason}
          onChange={e => setDiscrepancyReason(e.target.value)}
          className="w-full mt-1 p-3 border rounded-lg text-sm"
          placeholder="Nhập ghi chú nếu có chênh lệch..."
          rows={2}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => handleConfirm(selectedCp.id)}
          disabled={processing}
          className="flex-1 h-12 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {processing ? 'Đang xử lý...' : '✓ Xác nhận'}
        </button>
        <button
          onClick={() => {
            const reason = prompt('Nhập lý do từ chối:')
            if (reason) {
              setRejectReason(reason)
              handleReject(selectedCp.id)
            }
          }}
          disabled={processing}
          className="h-12 px-6 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          ✗ Từ chối
        </button>
      </div>
    </div>
  )
}
