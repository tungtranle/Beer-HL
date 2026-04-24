'use client'

/**
 * EmptyState — role-aware copy + actionable CTA.
 *
 * Reference: docs/specs/FRONTEND_GUIDE.md §4 UX-03,
 *            docs/specs/UX_AUDIT_AND_REDESIGN.md §3 (consistency)
 */

import { Inbox, type LucideIcon } from 'lucide-react'
import { getUser } from '@/lib/api'
import type { ReactNode } from 'react'

type Role = 'admin' | 'dispatcher' | 'driver' | 'warehouse_handler' | 'accountant' | 'management' | 'dvkh' | 'security' | 'workshop'

interface EmptyStateProps {
  /** Icon component from lucide-react */
  icon?: LucideIcon
  /** Map role → message. Falls back to `defaultMessage`. */
  messageByRole?: Partial<Record<Role, string>>
  /** Generic message when no role matches */
  defaultMessage?: string
  /** Title (heading) — short */
  title?: string
  /** Optional CTA action */
  action?: ReactNode
  className?: string
}

const FALLBACK_BY_ROLE: Record<Role, string> = {
  dispatcher: 'Không có shipment chưa xếp — tốt lắm!',
  driver: 'Chưa có chuyến — liên hệ điều phối',
  accountant: 'Tất cả đối soát đã hoàn tất',
  warehouse_handler: 'Không có picking task — liên hệ dispatcher',
  dvkh: 'Chưa có đơn hàng nào — bắt đầu tạo đơn mới',
  management: 'Chưa có dữ liệu KPI hôm nay',
  admin: 'Chưa có dữ liệu',
  security: 'Không có xe đang chờ kiểm tra',
  workshop: 'Không có vỏ trả về cần phân loại',
}

export function EmptyState({
  icon: Icon = Inbox,
  messageByRole,
  defaultMessage,
  title,
  action,
  className = '',
}: EmptyStateProps) {
  const role = (getUser()?.role as Role | undefined)
  const roleMsg = role ? messageByRole?.[role] : undefined
  const fallback = role ? FALLBACK_BY_ROLE[role] : 'Không có dữ liệu'
  const message = roleMsg ?? defaultMessage ?? fallback

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Icon className="h-8 w-8 text-gray-400" aria-hidden="true" />
      </div>
      {title && <h3 className="text-base font-medium text-gray-900 mb-2">{title}</h3>}
      <p className="text-sm text-gray-500 max-w-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
