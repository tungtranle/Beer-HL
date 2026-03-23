'use client'

import { getStatusConfig, getStatusLabel, type OrderStatus } from '@/lib/status-config'
import { CountdownDisplay } from './CountdownDisplay'

interface Props {
  status: string
  role?: string
  /** ISO datetime string — khi nào hết hạn auto-confirm */
  confirmDeadline?: string
  /** Hiện dạng nhỏ (không border, không countdown) */
  compact?: boolean
}

/**
 * StatusChip — v4 spec §2.1
 * Hiển thị trạng thái với dot màu + label role-aware + countdown nếu cần.
 * KHÔNG tự đặt màu — lấy từ STATUS_CONFIG.
 */
export function StatusChip({ status, role, confirmDeadline, compact }: Props) {
  const cfg = getStatusConfig(status)
  const label = getStatusLabel(status, role)

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.textClass}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
        {label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
      {label}
      {cfg.showCountdown && confirmDeadline && cfg.countdownType && (
        <CountdownDisplay expiresAt={confirmDeadline} type={cfg.countdownType} />
      )}
    </span>
  )
}
