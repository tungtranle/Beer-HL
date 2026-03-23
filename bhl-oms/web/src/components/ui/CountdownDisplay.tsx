'use client'

import { useState, useEffect } from 'react'

interface Props {
  /** ISO datetime — khi nào hết hạn */
  expiresAt: string
  /** 'order' = 2h auto-confirm | 'delivery' = 24h auto-confirm */
  type: 'order' | 'delivery'
}

/**
 * CountdownDisplay — v4 spec §2.2
 * Timer hiển thị thời gian còn lại trước auto-confirm.
 * type='order' → urgent khi < 30 phút
 * type='delivery' → urgent khi < 2 giờ
 */
export function CountdownDisplay({ expiresAt, type }: Props) {
  const [ms, setMs] = useState(() => new Date(expiresAt).getTime() - Date.now())

  useEffect(() => {
    const id = setInterval(() => setMs(new Date(expiresAt).getTime() - Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (ms <= 0) return <span className="ml-1 opacity-70 text-[10px]">tự xác nhận</span>

  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  const secs = Math.floor((ms % 60000) / 1000)

  const isUrgent = (type === 'order' && ms < 30 * 60 * 1000) || (type === 'delivery' && ms < 2 * 3600000)
  const urgentClass = isUrgent ? 'text-red-500' : ''

  const display = hours > 0
    ? `${hours}h ${mins.toString().padStart(2, '0')}m`
    : `${mins}:${secs.toString().padStart(2, '0')}`

  return <span className={`ml-1 font-mono text-[10px] opacity-80 ${urgentClass}`}>{display}</span>
}
