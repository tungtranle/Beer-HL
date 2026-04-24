'use client'

/**
 * NppHealthBadge — F2 World-Class Strategy.
 * Hiển thị inline cạnh tên NPP, nhanh chóng cho biết segment + risk.
 *
 * Color rule (per UX_AUDIT_AND_REDESIGN §4 F2):
 *  GREEN → khỏe mạnh, không action
 *  YELLOW → watch list, soft alert
 *  RED → cần chăm sóc (KHÔNG dùng từ kỳ thị)
 *
 * Data source: ml_features.npp_health_scores (migration 036)
 */

import { Heart, AlertTriangle, ShieldCheck } from 'lucide-react'
import { ExplainabilityButton } from './ExplainabilityModal'

export type RiskBand = 'GREEN' | 'YELLOW' | 'RED'

export interface NppHealth {
  npp_code: string
  segment: string                 // Champion, Loyal, At Risk, Lost, ...
  risk_band: RiskBand
  health_score_0_100: number
  recency_days: number
  frequency_orders: number
  monetary_units: number
}

interface Props {
  health?: NppHealth | null
  /** Loading state — show shimmer */
  loading?: boolean
  /** Show explanation button */
  showWhy?: boolean
  /** Compact: only chip */
  size?: 'sm' | 'md'
  className?: string
}

const STYLE: Record<RiskBand, { bg: string; text: string; border: string; icon: typeof Heart; label: string }> = {
  GREEN:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  icon: ShieldCheck,    label: 'Khỏe' },
  YELLOW: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  icon: AlertTriangle,  label: 'Cần theo dõi' },
  RED:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    icon: Heart,          label: 'Cần chăm sóc' },
}

export function NppHealthBadge({ health, loading, showWhy = true, size = 'md', className = '' }: Props) {
  if (loading) {
    return <span className={`inline-block h-6 w-24 rounded-full bg-gray-200 animate-pulse ${className}`} aria-label="Đang tải health score" />
  }
  if (!health) return null

  const style = STYLE[health.risk_band]
  const Icon = style.icon
  const sizeCls = size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeCls} font-medium`}
        title={`${health.segment} · score ${health.health_score_0_100.toFixed(0)}/100`}
      >
        <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
        <span>{style.label}</span>
        <span className={`${style.text} opacity-70 font-normal`}>· {health.health_score_0_100.toFixed(0)}</span>
      </span>
      {showWhy && (
        <ExplainabilityButton
          size="sm"
          featureId="F2"
          model="RFM Score (BHL-tuned)"
          dataSource={`Lịch sử ${health.frequency_orders} đơn của ${health.npp_code}, đặt gần nhất ${health.recency_days} ngày trước`}
          logic={[
            `Recency: ${health.recency_days} ngày kể từ đơn cuối`,
            `Frequency: ${health.frequency_orders} đơn (5 năm)`,
            `Monetary: ${formatNumber(health.monetary_units)} đơn vị`,
            `Score tổng: ${health.health_score_0_100.toFixed(0)}/100 → segment "${health.segment}"`,
          ]}
          quality={{
            label: 'Cập nhật',
            value: 'Mỗi đêm 02:00',
            isGood: true,
          }}
        />
      )}
    </span>
  )
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)
}
