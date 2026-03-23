'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface DeliveryAttempt {
  id: string
  order_id: string
  attempt_number: number
  shipment_id?: string
  previous_status: string
  previous_reason: string
  status: string
  created_at: string
  completed_at?: string
}

const statusLabels: Record<string, string> = {
  pending: 'Chờ xử lý',
  assigned: 'Đã lên chuyến',
  delivered: 'Đã giao',
  failed: 'Thất bại',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export function DeliveryAttempts({ orderId }: { orderId: string }) {
  const [attempts, setAttempts] = useState<DeliveryAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<any>(`/orders/${orderId}/delivery-attempts`)
      .then((r) => setAttempts(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [orderId])

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Đang tải...</div>

  if (attempts.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        <p className="text-4xl mb-2">🔄</p>
        <p>Chưa có lần giao lại nào</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {attempts.map((a) => (
        <div key={a.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-800">
              Lần giao #{a.attempt_number}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || 'bg-gray-100'}`}>
              {statusLabels[a.status] || a.status}
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              <span className="text-gray-500">Trạng thái trước đó:</span>{' '}
              <span className="font-medium">{a.previous_status}</span>
            </div>
            {a.previous_reason && (
              <div>
                <span className="text-gray-500">Lý do:</span>{' '}
                <span className="text-red-600">{a.previous_reason}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Ngày tạo:</span>{' '}
              {formatTime(a.created_at)}
            </div>
            {a.completed_at && (
              <div>
                <span className="text-gray-500">Hoàn thành:</span>{' '}
                {formatTime(a.completed_at)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
