'use client'

/**
 * Badge — số đếm nhỏ (khác StatusChip).
 * Dùng cho: count thông báo, số items pending, unread count.
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 */

type BadgeTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

interface BadgeProps {
  count?: number
  /** Dot-only badge (không cần count) */
  dot?: boolean
  tone?: BadgeTone
  /** Max count trước khi hiện "99+" */
  max?: number
  className?: string
}

const TONE: Record<BadgeTone, string> = {
  brand: 'bg-brand-500 text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-400 text-white',
  danger: 'bg-rose-500 text-white',
  neutral: 'bg-slate-400 text-white',
}

export function Badge({ count, dot = false, tone = 'brand', max = 99, className = '' }: BadgeProps) {
  if (dot) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${TONE[tone]} ${className}`}
        aria-hidden="true"
      />
    )
  }

  if (count === undefined || count <= 0) return null

  const label = count > max ? `${max}+` : String(count)

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full leading-none ${TONE[tone]} ${className}`}
      aria-label={`${count} items`}
    >
      {label}
    </span>
  )
}
