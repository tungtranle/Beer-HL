'use client'

/**
 * WaitingForBanner — §19 UX Spec v5
 * Hiện rõ đơn hàng đang chờ ai hành động.
 * Sticky ở đầu order detail — không cần scroll timeline để đoán.
 */

const WAITING_FOR: Record<string, { label: string; color: string }> = {
  pending_customer_confirm: { label: 'Chờ NPP xác nhận (tự động sau 2h)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending_approval:         { label: 'Chờ Kế toán duyệt hạn mức', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed:                { label: 'Chờ Điều phối xếp xe', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  planned:                  { label: 'Chờ Thủ kho soạn hàng', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  picking:                  { label: 'Đang soạn hàng', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  loaded:                   { label: 'Chờ Bảo vệ gate check', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  in_transit:               { label: 'Tài xế đang giao', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  delivered:                { label: 'Chờ NPP xác nhận nhận hàng (tự động sau 24h)', color: 'bg-green-50 text-green-700 border-green-200' },
  disputed:                 { label: 'Chờ Kế toán xử lý sai lệch', color: 'bg-red-50 text-red-700 border-red-200' },
  on_credit:                { label: 'Chờ NPP thanh toán', color: 'bg-pink-50 text-pink-700 border-pink-200' },
}

import { Loader2 } from 'lucide-react'

export function WaitingForBanner({ status }: { status: string }) {
  const cfg = WAITING_FOR[status]
  if (!cfg) return null

  return (
    <div className={`px-4 py-3 rounded-lg mb-4 flex items-center gap-2 border ${cfg.color}`}>
      <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" aria-hidden="true" />
      <span className="font-medium text-sm">{cfg.label}</span>
    </div>
  )
}
