'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Confirmation {
  id: string
  order_id: string
  customer_id: string
  token: string
  phone: string
  status: string
  total_amount: number
  sent_at: string
  confirmed_at: string | null
  disputed_at: string | null
  dispute_reason: string | null
  auto_confirmed_at: string | null
}

const statusLabels: Record<string, string> = {
  sent: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  disputed: 'Có khiếu nại',
  auto_confirmed: 'Tự động xác nhận (24h)',
  expired: 'Hết hạn',
}

const statusColors: Record<string, string> = {
  sent: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
  auto_confirmed: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-500',
}

export default function NPPConfirmPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<Confirmation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionDone, setActionDone] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/confirm/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data)
        else setError('Không tìm thấy xác nhận giao hàng')
      })
      .catch(() => setError('Lỗi kết nối'))
      .finally(() => setLoading(false))
  }, [token])

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/confirm/${token}/confirm`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setActionDone(true)
        setData(prev => prev ? { ...prev, status: 'confirmed', confirmed_at: new Date().toISOString() } : null)
      } else {
        setError(json.error?.message || 'Lỗi xác nhận')
      }
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDispute = async () => {
    if (!disputeReason.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/confirm/${token}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      })
      const json = await res.json()
      if (json.success) {
        setActionDone(true)
        setData(prev => prev ? { ...prev, status: 'disputed', disputed_at: new Date().toISOString(), dispute_reason: disputeReason } : null)
      } else {
        setError(json.error?.message || 'Lỗi khiếu nại')
      }
    } catch {
      setError('Lỗi kết nối')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-red-600">{error}</h1>
          <p className="text-gray-500 mt-2 text-sm">Vui lòng liên hệ nhà cung cấp hoặc kiểm tra lại đường link.</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const alreadyProcessed = data.status !== 'sent'

  return (
    <div className="min-h-screen bg-amber-50 flex items-start justify-center p-4 pt-8">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full space-y-4">
        {/* Logo / Brand */}
        <div className="text-center">
          <div className="text-3xl mb-1">🍺</div>
          <h1 className="text-xl font-bold text-amber-700">Bia Hạ Long</h1>
          <p className="text-sm text-gray-500">Xác nhận giao hàng</p>
        </div>

        {/* Status Badge */}
        <div className="text-center">
          <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${statusColors[data.status] || 'bg-gray-100'}`}>
            {statusLabels[data.status] || data.status}
          </span>
        </div>

        {/* Order Info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tổng tiền</span>
            <span className="font-bold text-lg text-amber-700">
              {data.total_amount?.toLocaleString('vi-VN')}đ
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Gửi lúc</span>
            <span>{new Date(data.sent_at).toLocaleString('vi-VN')}</span>
          </div>
          {data.confirmed_at && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Xác nhận lúc</span>
              <span className="text-green-600">{new Date(data.confirmed_at).toLocaleString('vi-VN')}</span>
            </div>
          )}
          {data.auto_confirmed_at && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tự động xác nhận</span>
              <span className="text-blue-600">{new Date(data.auto_confirmed_at).toLocaleString('vi-VN')}</span>
            </div>
          )}
          {data.dispute_reason && (
            <div className="text-sm">
              <span className="text-gray-500">Lý do khiếu nại:</span>
              <p className="text-red-600 mt-1">{data.dispute_reason}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!alreadyProcessed && !actionDone && (
          <div className="space-y-3">
            <button onClick={handleConfirm} disabled={submitting}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-medium text-lg hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Đang xử lý...' : '✅ Xác nhận đã nhận hàng'}
            </button>

            {!showDispute ? (
              <button onClick={() => setShowDispute(true)}
                className="w-full py-3 bg-white border-2 border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50">
                ⚠️ Có vấn đề / Khiếu nại
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder="Mô tả vấn đề (VD: thiếu hàng, sai sản phẩm, hư hỏng...)"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
                <button onClick={handleDispute} disabled={submitting || !disputeReason.trim()}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50">
                  {submitting ? 'Đang gửi...' : '📨 Gửi khiếu nại'}
                </button>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              Nếu không phản hồi trong 24 giờ, đơn hàng sẽ được tự động xác nhận.
            </p>
          </div>
        )}

        {/* Success Message */}
        {actionDone && (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">{data.status === 'confirmed' ? '🎉' : '📨'}</div>
            <p className="font-medium text-lg">
              {data.status === 'confirmed' ? 'Cảm ơn bạn đã xác nhận!' : 'Khiếu nại đã được ghi nhận'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {data.status === 'confirmed' ? 'Đơn hàng đã được xác nhận thành công.' : 'Chúng tôi sẽ liên hệ trong 24h.'}
            </p>
          </div>
        )}

        {/* Already Processed */}
        {alreadyProcessed && !actionDone && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">Đơn hàng này đã được xử lý.</p>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>
    </div>
  )
}
