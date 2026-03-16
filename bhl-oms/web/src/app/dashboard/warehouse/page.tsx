'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface StockItem {
  product_id: string; product_name: string; sku: string
  quantity: number; reserved: number; available: number
  warehouse_id: string; warehouse_name: string
}

interface PickingOrder {
  id: string; trip_id: string; trip_number: string
  status: string; total_items: number; created_at: string
}

interface ExpiryAlert {
  product_id: string; product_name: string; sku: string
  batch_number: string; expiry_date: string; quantity: number
  days_until_expiry: number
}

export default function WarehouseDashboardPage() {
  const [stock, setStock] = useState<StockItem[]>([])
  const [pickingOrders, setPickingOrders] = useState<PickingOrder[]>([])
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiFetch<any>('/warehouse/stock').then(r => setStock(r.data || [])).catch(() => {}),
      apiFetch<any>('/warehouse/picking-orders').then(r => setPickingOrders(r.data || [])).catch(() => {}),
      apiFetch<any>('/warehouse/expiry-alerts').then(r => setExpiryAlerts(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const pendingPick = pickingOrders.filter(p => p.status === 'pending' || p.status === 'picking')
  const totalStock = stock.reduce((s, i) => s + i.quantity, 0)
  const totalReserved = stock.reduce((s, i) => s + i.reserved, 0)
  const urgentExpiry = expiryAlerts.filter(a => a.days_until_expiry <= 7)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🏭 Quản lý kho</h1>
      <p className="text-sm text-gray-500 mb-6">Tổng quan tồn kho, lệnh đóng hàng, cảnh báo hết hạn</p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tổng tồn kho</div>
          <div className="text-3xl font-bold text-blue-700">{totalStock.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1">Đã đặt: <strong>{totalReserved.toLocaleString()}</strong></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Mặt hàng</div>
          <div className="text-3xl font-bold text-amber-700">{stock.length}</div>
          <div className="text-sm text-gray-500 mt-1">SKU đang quản lý</div>
        </div>
        <Link href="/dashboard/warehouse/picking" className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500 hover:shadow-md transition cursor-pointer">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lệnh đóng hàng</div>
          <div className="text-3xl font-bold text-green-700">{pendingPick.length}</div>
          <div className="text-sm text-gray-500 mt-1">Đang chờ xử lý</div>
          <div className="text-xs text-green-500 mt-2">Bấm để xem chi tiết →</div>
        </Link>
        <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${urgentExpiry.length > 0 ? 'border-red-500' : 'border-gray-300'}`}>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cảnh báo cận date</div>
          <div className={`text-3xl font-bold ${urgentExpiry.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>{expiryAlerts.length}</div>
          <div className="text-sm text-gray-500 mt-1">{urgentExpiry.length > 0 ? `${urgentExpiry.length} sắp hết hạn trong 7 ngày` : 'Không có cảnh báo'}</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Link href="/dashboard/warehouse/picking" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center">
          <div className="text-2xl mb-1">📋</div>
          <div className="text-sm font-medium">Lệnh đóng hàng</div>
        </Link>
        <Link href="/dashboard/gate-check" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center">
          <div className="text-2xl mb-1">🚧</div>
          <div className="text-sm font-medium">Kiểm tra cổng</div>
        </Link>
        <Link href="/dashboard/warehouse/returns" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center">
          <div className="text-2xl mb-1">📥</div>
          <div className="text-sm font-medium">Nhập vỏ</div>
        </Link>
        <Link href="/dashboard/pda-scanner" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center">
          <div className="text-2xl mb-1">📱</div>
          <div className="text-sm font-medium">Quét barcode</div>
        </Link>
      </div>

      {/* Stock table */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Tồn kho hiện tại</h2>
        {stock.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Chưa có dữ liệu tồn kho</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3">SKU</th>
                  <th className="text-left py-2 px-3">Sản phẩm</th>
                  <th className="text-right py-2 px-3">Tồn kho</th>
                  <th className="text-right py-2 px-3">Đã đặt</th>
                  <th className="text-right py-2 px-3">Khả dụng</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono text-xs">{s.sku}</td>
                    <td className="py-2 px-3">{s.product_name}</td>
                    <td className="py-2 px-3 text-right">{s.quantity.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-orange-600">{s.reserved.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-medium text-green-600">{s.available.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expiry alerts */}
      {expiryAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3">⚠️ Cảnh báo hết hạn</h2>
          <div className="space-y-2">
            {expiryAlerts.map((a, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${a.days_until_expiry <= 7 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div>
                  <div className="font-medium text-sm">{a.product_name}</div>
                  <div className="text-xs text-gray-500">Lô: {a.batch_number} · SL: {a.quantity}</div>
                </div>
                <div className={`text-sm font-bold ${a.days_until_expiry <= 7 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {a.days_until_expiry <= 0 ? '❌ Đã hết hạn' : `⏰ Còn ${a.days_until_expiry} ngày`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
