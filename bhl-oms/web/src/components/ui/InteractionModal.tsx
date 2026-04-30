'use client'

import { useState, useRef } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, CreditCard, FileText, Ban, type LucideIcon } from 'lucide-react'

// ==================== V4 SPEC §4 — 7 INTERACTION MODALS ====================

export type ModalType =
  | 'delivery_success'
  | 'delivery_partial'
  | 'delivery_reject'
  | 'kt_approve_credit'
  | 'record_npp_rejection'
  | 'record_npp_dispute'
  | 'gate_fail'

// Reason codes — v4 spec §4.3
export const REASONS: Record<string, string[]> = {
  delivery_reject: ['Không có người nhận', 'Kho đầy', 'Sai địa chỉ', 'Khách hủy không báo', 'Lý do khác'],
  record_npp_rejection: ['Số lượng không đúng', 'Giá không đúng', 'Ngày giao không phù hợp', 'Không phải đơn tôi', 'Lý do khác'],
  delivery_partial: ['Hàng vỡ trên xe', 'Pick thiếu từ kho', 'NPP chỉ lấy một phần', 'Lý do khác'],
  record_npp_dispute: ['Thiếu hàng', 'Sai sản phẩm', 'Hàng hỏng khi nhận', 'Số lượng không đúng'],
  kt_approve_credit_reject: ['NPP có nợ quá hạn', 'Rủi ro tín dụng', 'Vi phạm chính sách công nợ', 'Lý do khác'],
  gate_fail: ['Số lượng thiếu', 'Sai sản phẩm', 'Niêm phong bị phá', 'Biển số không khớp'],
}

const MODAL_CONFIG: Record<ModalType, {
  title: string
  Icon: LucideIcon
  ctaColor: string
  ctaLabel: string
  requireReason: boolean
  requirePhoto: boolean
  requireNote: boolean
  fullscreenColor?: string
}> = {
  delivery_success: {
    title: 'Xác nhận giao hàng thành công',
    Icon: CheckCircle2,
    ctaColor: 'bg-green-600 hover:bg-green-700',
    ctaLabel: 'Xác nhận giao thành công',
    requireReason: false,
    requirePhoto: false,
    requireNote: false,
  },
  delivery_partial: {
    title: 'Giao hàng thiếu',
    Icon: AlertTriangle,
    ctaColor: 'bg-[#F68634] hover:bg-[#e5752a]',
    ctaLabel: 'Xác nhận giao thiếu',
    requireReason: true,
    requirePhoto: true,
    requireNote: false,
  },
  delivery_reject: {
    title: 'NPP từ chối nhận hàng',
    Icon: XCircle,
    ctaColor: 'bg-red-600 hover:bg-red-700',
    ctaLabel: 'Xác nhận từ chối',
    requireReason: true,
    requirePhoto: true,
    requireNote: false,
  },
  kt_approve_credit: {
    title: 'Duyệt hạn mức tín dụng',
    Icon: CreditCard,
    ctaColor: 'bg-green-600 hover:bg-green-700',
    ctaLabel: 'Duyệt',
    requireReason: false,
    requirePhoto: false,
    requireNote: true,
  },
  record_npp_rejection: {
    title: 'Ghi nhận NPP từ chối (qua Zalo/ĐT)',
    Icon: FileText,
    ctaColor: 'bg-red-600 hover:bg-red-700',
    ctaLabel: 'Ghi nhận từ chối',
    requireReason: true,
    requirePhoto: false,
    requireNote: false,
  },
  record_npp_dispute: {
    title: 'Ghi nhận NPP báo sai lệch (qua Zalo/ĐT)',
    Icon: FileText,
    ctaColor: 'bg-[#F68634] hover:bg-[#e5752a]',
    ctaLabel: 'Ghi nhận sai lệch',
    requireReason: true,
    requirePhoto: false,
    requireNote: false,
  },
  gate_fail: {
    title: 'Gate Check FAIL',
    Icon: Ban,
    ctaColor: 'bg-red-600 hover:bg-red-700',
    ctaLabel: 'Xác nhận FAIL',
    requireReason: true,
    requirePhoto: false,
    requireNote: false,
    fullscreenColor: 'bg-red-600',
  },
}

interface Props {
  type: ModalType
  /** Context: đơn hàng nào, số tiền gì */
  context: { orderNumber?: string; amount?: number; customerName?: string; tripNumber?: string }
  onSubmit: (data: ModalResult) => Promise<void>
  onClose: () => void
}

export interface ModalResult {
  type: ModalType
  reasonCode?: string
  note?: string
  photos?: File[]
}

export function InteractionModal({ type, context, onSubmit, onClose }: Props) {
  const config = MODAL_CONFIG[type]
  const reasons = REASONS[type] || REASONS[type + '_reject'] || []

  const [selectedReason, setSelectedReason] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Anti double-submit — v4 spec §4.4
  const submitted = useRef(false)

  const canSubmit = () => {
    if (config.requireReason && !selectedReason) return false
    if (config.requireNote && !note.trim()) return false
    if (config.requirePhoto && photos.length === 0) return false
    return true
  }

  const handleSubmit = async () => {
    if (submitted.current || !canSubmit()) return
    submitted.current = true
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        type,
        reasonCode: selectedReason || undefined,
        note: note.trim() || undefined,
        photos: photos.length > 0 ? photos : undefined,
      })
    } catch (err: any) {
      submitted.current = false  // Reset để user thử lại
      setError(`${err.message} (Ref: ${err.serverTraceId || 'unknown'})`)
    } finally {
      setSubmitting(false)
    }
  }

  // Gate fail — fullscreen red
  if (config.fullscreenColor) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-600 text-white p-8">
        <Ban className="w-20 h-20 mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold mb-4">{config.title}</h1>

        {/* Context */}
        {context.tripNumber && <p className="text-xl opacity-90 mb-6">Chuyến {context.tripNumber}</p>}

        {/* Reason chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-6 max-w-lg">
          {reasons.map(r => (
            <button key={r}
              onClick={() => setSelectedReason(r)}
              className={`px-4 py-3 rounded-xl text-base font-medium min-h-[48px] transition
                ${selectedReason === r ? 'bg-white text-red-700' : 'bg-red-500 text-white border border-red-400'}`}
            >{r}</button>
          ))}
        </div>

        {/* Note */}
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Ghi chú bổ sung..."
          className="w-full max-w-lg bg-red-500 text-white placeholder-red-200 border border-red-400 rounded-xl p-4 mb-6 resize-none min-h-[48px]"
          rows={2}
        />

        {error && <p className="text-yellow-200 mb-4 text-sm">{error}</p>}

        <div className="flex gap-4">
          <button onClick={onClose}
            className="px-6 py-3 bg-red-500 text-white rounded-xl border border-red-400 min-h-[56px] text-lg">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit() || submitting}
            className="px-8 py-3 bg-white text-red-700 font-bold rounded-xl min-h-[56px] text-lg disabled:opacity-50">
            {submitting ? 'Đang xử lý...' : config.ctaLabel}
          </button>
        </div>
      </div>
    )
  }

  // Standard modal
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b">
          <span className="text-2xl"><config.Icon className="w-6 h-6" aria-hidden="true" /></span>
          <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Layer 1: Context box */}
          {(context.orderNumber || context.amount) && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              {context.orderNumber && <p>Đơn hàng: <strong>{context.orderNumber}</strong></p>}
              {context.customerName && <p>Khách hàng: <strong>{context.customerName}</strong></p>}
              {context.amount !== undefined && (
                <p>Giá trị: <strong>{new Intl.NumberFormat('vi-VN').format(context.amount)} ₫</strong></p>
              )}
            </div>
          )}

          {/* Layer 2: Reason chips */}
          {reasons.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Lý do {config.requireReason && <span className="text-red-500">*</span>}
              </label>
              <div className="flex flex-wrap gap-2">
                {reasons.map(r => (
                  <button key={r}
                    onClick={() => setSelectedReason(r === selectedReason ? '' : r)}
                    className={`px-3 py-1.5 rounded-full text-sm transition border
                      ${selectedReason === r
                        ? 'bg-[#F68634] text-white border-[#F68634]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}
                  >{r}</button>
                ))}
              </div>
            </div>
          )}

          {/* Layer 3: Free text */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Ghi chú {config.requireNote && <span className="text-red-500">*</span>}
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Ghi chú bổ sung..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#F68634] focus:border-[#F68634] resize-none"
              rows={3}
            />
          </div>

          {/* Layer 4: Photo upload */}
          {config.requirePhoto && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Ảnh chụp <span className="text-red-500">*</span>
              </label>
              <input type="file" accept="image/*" multiple capture="environment"
                onChange={e => setPhotos(Array.from(e.target.files || []))}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#F68634] file:text-white hover:file:bg-[#e5752a]"
              />
              {photos.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{photos.length} ảnh đã chọn</p>
              )}
            </div>
          )}

          {/* Error message with trace ID — UX-01, UX-04 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
            Hủy
          </button>
          <button onClick={handleSubmit}
            disabled={!canSubmit() || submitting}
            className={`px-5 py-2 text-white text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${config.ctaColor}`}>
            {submitting ? 'Đang xử lý...' : config.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
