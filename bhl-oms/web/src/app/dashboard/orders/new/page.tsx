'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import { formatVND } from '@/lib/status-config'
import { toast } from '@/lib/useToast'
import SearchableSelect from '@/lib/SearchableSelect'

interface Product {
  id: string; sku: string; name: string; price: number; deposit_price: number;
  weight_kg: number; volume_m3: number; unit: string
}

interface Customer {
  id: string; code: string; name: string; address: string; phone: string
}

interface ATPResult {
  product_id: string; product_name: string; atp: number; available: number; reserved: number
}

interface OrderItem {
  product_id: string; quantity: number
  product_name?: string; price?: number; deposit_price?: number; amount?: number
}

export default function NewOrderPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])

  const [customerId, setCustomerId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [items, setItems] = useState<OrderItem[]>([])
  const [atpResults, setAtpResults] = useState<Record<string, ATPResult>>({})
  const [atpLoading, setAtpLoading] = useState(false)

  const [creditInfo, setCreditInfo] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Debounce timer for ATP checks
  const atpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<any>('/products').then((r) => setProducts(r.data || [])),
      apiFetch<any>('/customers').then((r) => setCustomers(r.data || [])),
      apiFetch<any>('/warehouses').then((r) => setWarehouses(r.data || [])),
    ]).catch(console.error)

    const user = getUser()
    if (user?.warehouse_ids?.[0]) {
      setWarehouseId(user.warehouse_ids[0])
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDeliveryDate(tomorrow.toISOString().split('T')[0])
  }, [])

  // Load customer credit info
  useEffect(() => {
    if (!customerId) { setCreditInfo(null); return }
    apiFetch<any>(`/customers/${customerId}`).then((r) => setCreditInfo(r.data)).catch(console.error)
  }, [customerId])

  // ATP batch check — debounced, triggers on product/quantity/warehouse changes
  const fetchATP = useCallback((wId: string, orderItems: OrderItem[]) => {
    if (atpTimerRef.current) clearTimeout(atpTimerRef.current)

    const productIds = orderItems.map((i) => i.product_id).filter(Boolean)
    if (!wId || productIds.length === 0) { setAtpResults({}); return }

    atpTimerRef.current = setTimeout(() => {
      setAtpLoading(true)
      apiFetch<any>('/atp/batch', {
        method: 'POST',
        body: { warehouse_id: wId, product_ids: productIds },
      })
        .then((r) => {
          const map: Record<string, ATPResult> = {}
          for (const a of r.data || []) map[a.product_id] = a
          setAtpResults(map)
        })
        .catch(console.error)
        .finally(() => setAtpLoading(false))
    }, 300)
  }, [])

  // Re-check ATP when warehouse changes
  useEffect(() => {
    if (warehouseId && items.some((i) => i.product_id)) {
      fetchATP(warehouseId, items)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId])

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    ;(newItems[index] as any)[field] = value

    if (field === 'product_id') {
      const prod = products.find((p) => p.id === value)
      if (prod) {
        newItems[index].product_name = prod.name
        newItems[index].price = prod.price
        newItems[index].deposit_price = prod.deposit_price
        newItems[index].amount = prod.price * newItems[index].quantity
      }
    }
    if (field === 'quantity') {
      const prod = products.find((p) => p.id === newItems[index].product_id)
      if (prod) {
        newItems[index].amount = prod.price * Number(value)
      }
    }

    setItems(newItems)

    // Trigger ATP check on product or quantity change
    if ((field === 'product_id' || field === 'quantity') && warehouseId) {
      fetchATP(warehouseId, newItems)
    }
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    if (warehouseId) fetchATP(warehouseId, newItems)
  }

  // Computed values
  const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0)
  const totalDeposit = items.reduce((sum, i) => {
    const dp = i.deposit_price || products.find(p => p.id === i.product_id)?.deposit_price || 0
    return sum + dp * i.quantity
  }, 0)
  const grandTotal = totalAmount + totalDeposit

  // Validation checks
  const itemsWithProduct = items.filter((i) => i.product_id)
  const atpIssues = itemsWithProduct.filter((i) => {
    const atp = atpResults[i.product_id]
    return atp && atp.atp < i.quantity
  })
  const hasAtpIssue = atpIssues.length > 0
  const creditExceeded = creditInfo && totalAmount > 0 && totalAmount > creditInfo.available_limit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Frontend validation
    if (hasAtpIssue) {
      setError('Không thể tạo đơn: có sản phẩm vượt tồn kho khả dụng (ATP). Vui lòng điều chỉnh số lượng.')
      return
    }

    setSubmitting(true)
    try {
      const res: any = await apiFetch('/orders', {
        method: 'POST',
        body: {
          customer_id: customerId,
          warehouse_id: warehouseId,
          delivery_date: deliveryDate,
          notes: notes || undefined,
          is_urgent: isUrgent || undefined,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        },
      })

      const order = res.data
      if (order.status === 'pending_approval') {
        toast.warning(`Đơn ${order.order_number} đã tạo nhưng VƯỢT HẠN MỨC → Chờ kế toán duyệt`)
      } else {
        toast.success(`Đơn ${order.order_number} đã tạo thành công!`)
      }
      router.push('/dashboard/orders')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // formatVND imported from status-config (single source of truth)

  const formatNumber = (n: number) =>
    new Intl.NumberFormat('vi-VN').format(n)

  // Find selected customer
  const selectedCustomer = customers.find(c => c.id === customerId)

  return (
    <div className="flex gap-6">
      {/* LEFT: Order Form (60%) */}
      <div className="flex-[3] min-w-0">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tạo đơn hàng mới</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer + Warehouse + Date */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">Thông tin đơn hàng</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng (NPP)</label>
              <SearchableSelect
                options={customers.map((c: any) => ({
                  value: c.id,
                  label: `${c.code} - ${c.name}`,
                  sublabel: c.phone || c.address?.substring(0, 50) || undefined
                }))}
                value={customerId}
                onChange={setCustomerId}
                placeholder="🔍 Tìm NPP theo mã hoặc tên..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kho xuất</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              >
                <option value="">-- Chọn kho --</option>
                {warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày giao</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Ghi chú (tùy chọn)"
              />
            </div>
          </div>

          {/* Urgent order toggle */}
          <div className="mt-4">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">⚡ Đơn gấp</span>
              {isUrgent && <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Ưu tiên giao trước</span>}
            </label>
          </div>

          {/* Credit info panel */}
          {creditInfo && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <div className={`px-4 py-2 text-sm font-semibold ${
                creditInfo.available_limit > 0 ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'
              }`}>
                💳 Hạn mức nợ — {creditInfo.code}
              </div>
              <div className="px-4 py-3 bg-white">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Hạn mức tổng</span>
                    <p className="font-semibold text-gray-800">{formatVND(creditInfo.credit_limit)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Đang nợ</span>
                    <p className="font-semibold text-orange-600">{formatVND(creditInfo.current_balance)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Hạn mức khả dụng</span>
                    <p className={`font-semibold ${creditInfo.available_limit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatVND(creditInfo.available_limit)}
                    </p>
                  </div>
                </div>
                {/* Credit usage bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        creditInfo.current_balance / creditInfo.credit_limit > 0.9 ? 'bg-red-500' :
                        creditInfo.current_balance / creditInfo.credit_limit > 0.7 ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (creditInfo.current_balance / creditInfo.credit_limit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Đã sử dụng {((creditInfo.current_balance / creditInfo.credit_limit) * 100).toFixed(1)}% hạn mức
                  </p>
                </div>
                {/* Order vs available comparison */}
                {totalAmount > 0 && (
                  <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    creditExceeded ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                    {creditExceeded ? (
                      <>⚠️ Đơn hàng <strong>{formatVND(totalAmount)}</strong> VƯỢT hạn mức khả dụng <strong>{formatVND(creditInfo.available_limit)}</strong> → Đơn sẽ ở trạng thái <strong>"Chờ duyệt"</strong></>
                    ) : (
                      <>✅ Đơn hàng <strong>{formatVND(totalAmount)}</strong> trong hạn mức khả dụng <strong>{formatVND(creditInfo.available_limit)}</strong> → Đơn sẽ <strong>"Đã xác nhận"</strong></>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Sản phẩm</h2>
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-1 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
            >
              + Thêm sản phẩm
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nhấn "Thêm sản phẩm" để bắt đầu</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3">Sản phẩm</th>
                  <th className="text-right py-2 px-3 w-24">Số lượng</th>
                  <th className="text-right py-2 px-3">Đơn giá</th>
                  <th className="text-right py-2 px-3">Thành tiền</th>
                  <th className="text-center py-2 px-3 w-40">Tồn kho khả dụng</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const atp = atpResults[item.product_id]
                  const atpOk = !atp || atp.atp >= item.quantity
                  const atpChecked = !!atp && !!item.product_id

                  return (
                    <tr key={idx} className={`border-t ${!atpOk ? 'bg-red-50' : ''}`}>
                      <td className="py-2 px-3">
                        <SearchableSelect
                          options={products.map((p) => ({
                            value: p.id,
                            label: `${p.sku} — ${p.name}`,
                            sublabel: `${formatVND(p.price)}/${p.unit}`
                          }))}
                          value={item.product_id}
                          onChange={(val) => updateItem(idx, 'product_id', val)}
                          placeholder="🔍 Tìm sản phẩm..."
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value) || 0)}
                          className={`w-full px-2 py-1 border rounded text-right text-sm transition-colors ${
                            !atpOk ? 'border-red-400 bg-red-50 text-red-700' :
                            atpChecked && atp && item.quantity > atp.atp * 0.8 ? 'border-amber-400 bg-amber-50 text-amber-700' : ''
                          }`}
                        />
                      </td>
                      <td className="py-2 px-3 text-right">{item.price ? formatVND(item.price) : '-'}</td>
                      <td className="py-2 px-3 text-right font-medium">{item.amount ? formatVND(item.amount) : '-'}</td>
                      <td className="py-2 px-3 text-center">
                        {!item.product_id ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : atpLoading ? (
                          <span className="text-gray-400 text-xs">Đang kiểm...</span>
                        ) : !warehouseId ? (
                          <span className="text-gray-400 text-xs">Chọn kho để kiểm tra</span>
                        ) : atpChecked ? (
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            atpOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            <span>{atpOk ? '✅' : '❌'}</span>
                            <span>ATP: {formatNumber(atp!.atp)}</span>
                            <span className="text-gray-400">/ Đặt: {formatNumber(item.quantity)}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            <span>❌</span>
                            <span>ATP: 0</span>
                            <span className="text-gray-400">/ Đặt: {formatNumber(item.quantity)}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={3} className="py-2 px-3 text-right text-gray-600">Tiền hàng:</td>
                  <td className="py-2 px-3 text-right font-medium">{formatVND(totalAmount)}</td>
                  <td colSpan={2}></td>
                </tr>
                {totalDeposit > 0 && (
                  <tr>
                    <td colSpan={3} className="py-1 px-3 text-right text-gray-600">Phí vỏ/két:</td>
                    <td className="py-1 px-3 text-right font-medium">{formatVND(totalDeposit)}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                <tr className="border-t-2 font-bold">
                  <td colSpan={3} className="py-3 px-3 text-right">Tổng cộng:</td>
                  <td className="py-3 px-3 text-right text-lg text-brand-600">{formatVND(grandTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Pre-submit validation summary */}
        {itemsWithProduct.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold mb-3">🔍 Kiểm tra trước khi tạo đơn</h2>
            <div className="space-y-2">
              {/* ATP check summary */}
              <div className={`flex items-start gap-3 px-4 py-3 rounded-lg ${
                hasAtpIssue ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
              }`}>
                <span className="text-xl">{hasAtpIssue ? '❌' : '✅'}</span>
                <div>
                  <p className={`font-semibold text-sm ${hasAtpIssue ? 'text-red-700' : 'text-green-700'}`}>
                    Kiểm tra tồn kho (ATP)
                  </p>
                  {hasAtpIssue ? (
                    <div className="text-sm text-red-600 mt-1">
                      <p>Các sản phẩm sau <strong>KHÔNG ĐỦ</strong> tồn kho:</p>
                      <ul className="list-disc ml-4 mt-1">
                        {atpIssues.map((item, i) => {
                          const atp = atpResults[item.product_id]
                          return (
                            <li key={i}>
                              <strong>{item.product_name || item.product_id}</strong>: 
                              cần {formatNumber(item.quantity)}, tồn khả dụng chỉ {formatNumber(atp?.atp || 0)}
                              {' '}(thiếu {formatNumber(item.quantity - (atp?.atp || 0))})
                            </li>
                          )
                        })}
                      </ul>
                      <p className="mt-1 font-semibold">→ Không thể tạo đơn. Vui lòng giảm số lượng hoặc đổi sản phẩm.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-green-600 mt-1">
                      Tất cả {itemsWithProduct.length} sản phẩm đều đủ tồn kho khả dụng ✓
                    </p>
                  )}
                </div>
              </div>

              {/* Credit check summary */}
              {creditInfo && totalAmount > 0 && (
                <div className={`flex items-start gap-3 px-4 py-3 rounded-lg ${
                  creditExceeded ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
                }`}>
                  <span className="text-xl">{creditExceeded ? '⚠️' : '✅'}</span>
                  <div>
                    <p className={`font-semibold text-sm ${creditExceeded ? 'text-yellow-700' : 'text-green-700'}`}>
                      Kiểm tra hạn mức nợ
                    </p>
                    {creditExceeded ? (
                      <div className="text-sm text-yellow-700 mt-1">
                        <p>
                          Tiền hàng <strong>{formatVND(totalAmount)}</strong> vượt hạn mức khả dụng <strong>{formatVND(creditInfo.available_limit)}</strong>
                          {' '}(vượt {formatVND(totalAmount - creditInfo.available_limit)})
                        </p>
                        <p className="mt-1">→ Đơn sẽ được tạo ở trạng thái <strong className="text-orange-700">"Chờ duyệt"</strong> — cần quản lý/kế toán phê duyệt.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-green-600 mt-1">
                        Tiền hàng {formatVND(totalAmount)} trong hạn mức khả dụng {formatVND(creditInfo.available_limit)} → Đơn sẽ <strong>"Đã xác nhận"</strong> ✓
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Final status prediction */}
              {creditInfo && totalAmount > 0 && !hasAtpIssue && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  creditExceeded ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <span className="text-xl">📋</span>
                  <p className="text-sm font-medium">
                    Dự kiến trạng thái đơn sau khi tạo:{' '}
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      creditExceeded ? 'bg-orange-200 text-orange-800' : 'bg-green-200 text-green-800'
                    }`}>
                      {creditExceeded ? '⏳ Chờ duyệt (pending_approval)' : '✅ Đã xác nhận (confirmed)'}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error + Submit */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200">
            ❌ {error}
          </div>
        )}

        <div className="flex gap-3 items-center">
          <button
            type="submit"
            disabled={submitting || items.length === 0 || hasAtpIssue}
            className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {submitting ? 'Đang tạo...' : hasAtpIssue ? '🚫 Không đủ tồn kho' : '✅ Tạo đơn hàng'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Hủy
          </button>
          {hasAtpIssue && (
            <span className="text-sm text-red-600 font-medium">
              Vui lòng điều chỉnh số lượng để tạo đơn
            </span>
          )}
        </div>
      </form>
    </div>

      {/* RIGHT: Zalo Preview (40%) */}
      <div className="flex-[2] min-w-[320px] sticky top-4 self-start">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">Z</span>
            Zalo Preview — Tin nhắn xác nhận
          </h3>

          {/* Mock Zalo message */}
          <div className="bg-gray-100 rounded-xl p-4 text-sm space-y-2 border">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-white text-xs font-bold">BHL</div>
              <div>
                <div className="font-medium text-xs">Beer Hà Lội</div>
                <div className="text-xs text-gray-400">Xác nhận đơn hàng</div>
              </div>
            </div>

            <div className="space-y-1.5 text-gray-700">
              <p>Xin chào <strong>{selectedCustomer?.name || '___'}</strong>,</p>
              <p>Đơn hàng của quý NPP:</p>
              <div className="bg-white rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ngày giao</span>
                  <span className="font-medium">{deliveryDate || '___'}</span>
                </div>
                {itemsWithProduct.length > 0 ? (
                  itemsWithProduct.slice(0, 5).map((item, i) => {
                    const prod = products.find(p => p.id === item.product_id)
                    return (
                      <div key={i} className="flex justify-between">
                        <span className="truncate max-w-[60%]">{prod?.name || '—'}</span>
                        <span>×{item.quantity}</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-gray-400 text-center py-2">Chưa có sản phẩm</div>
                )}
                {itemsWithProduct.length > 5 && (
                  <div className="text-gray-400 text-center">... và {itemsWithProduct.length - 5} sản phẩm khác</div>
                )}
                <div className="pt-1 border-t flex justify-between font-medium">
                  <span>Tổng tiền</span>
                  <span className="text-brand-600">{formatVND(grandTotal)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Vui lòng bấm Xác nhận hoặc Từ chối bên dưới.</p>
            </div>

            {/* Action buttons preview */}
            <div className="flex gap-2 pt-2">
              <div className="flex-1 py-2 bg-green-500 text-white rounded-lg text-center text-xs font-medium">✅ Xác nhận</div>
              <div className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg text-center text-xs font-medium">❌ Từ chối</div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Tin nhắn Zalo sẽ tự động gửi sau khi tạo đơn
          </p>

          {/* Status indicators */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${customerId ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className={customerId ? 'text-gray-700' : 'text-gray-400'}>Khách hàng đã chọn</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${itemsWithProduct.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className={itemsWithProduct.length > 0 ? 'text-gray-700' : 'text-gray-400'}>{itemsWithProduct.length} sản phẩm</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${!hasAtpIssue && itemsWithProduct.length > 0 ? 'bg-green-500' : hasAtpIssue ? 'bg-red-500' : 'bg-gray-300'}`} />
              <span className={hasAtpIssue ? 'text-red-600' : 'text-gray-700'}>
                {hasAtpIssue ? 'Tồn kho không đủ' : 'ATP OK'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${creditExceeded ? 'bg-amber-500' : creditInfo ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className={creditExceeded ? 'text-amber-600' : 'text-gray-700'}>
                {creditExceeded ? 'Vượt hạn mức → Chờ duyệt' : creditInfo ? 'Hạn mức OK' : 'Chưa có thông tin'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
