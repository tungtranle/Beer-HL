'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { formatVND } from '@/lib/status-config'
import SearchableSelect from '@/lib/SearchableSelect'
import { handleError } from '@/lib/handleError'
interface Product {
  id: string; sku: string; name: string; price: number; deposit_price: number;
  weight_kg: number; volume_m3: number; unit: string
}

interface ATPResult {
  product_id: string; product_name: string; atp: number; available: number; reserved: number
}

interface OrderItemInput {
  product_id: string; quantity: number
  product_name?: string; price?: number; deposit_price?: number; amount?: number
}

interface Order {
  id: string; order_number: string; customer_id: string; customer_name: string
  warehouse_id: string; warehouse_name: string; delivery_date: string; notes: string
  status: string; items: { product_id: string; quantity: number; unit_price: number; amount: number }[]
}

export default function EditOrderPage() {
  const params = useParams()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [order, setOrder] = useState<Order | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItemInput[]>([])
  const [atpResults, setAtpResults] = useState<Record<string, ATPResult>>({})
  const [atpLoading, setAtpLoading] = useState(false)

  const [creditInfo, setCreditInfo] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const atpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load master data + existing order
  useEffect(() => {
    Promise.all([
      apiFetch<any>('/products').then((r) => r.data || []),
      apiFetch<any>('/customers').then((r) => r.data || []),
      apiFetch<any>('/warehouses').then((r) => r.data || []),
      apiFetch<any>(`/orders/${params.id}`).then((r) => r.data),
    ])
      .then(([prods, custs, whs, ord]) => {
        setProducts(prods)
        setCustomers(custs)
        setWarehouses(whs)
        setOrder(ord)

        setCustomerId(ord.customer_id)
        setWarehouseId(ord.warehouse_id)
        setDeliveryDate(ord.delivery_date)
        setNotes(ord.notes || '')

        const mapped: OrderItemInput[] = (ord.items || []).map((item: any) => {
          const prod = prods.find((p: Product) => p.id === item.product_id)
          return {
            product_id: item.product_id,
            quantity: item.quantity,
            product_name: prod?.name || item.product_name,
            price: item.unit_price || prod?.price,
            deposit_price: prod?.deposit_price,
            amount: item.amount || (item.unit_price * item.quantity),
          }
        })
        setItems(mapped)
      })
      .catch(err => handleError(err))
      .finally(() => setLoading(false))
  }, [params.id])

  // Load customer credit info
  useEffect(() => {
    if (!customerId) { setCreditInfo(null); return }
    apiFetch<any>(`/customers/${customerId}`).then((r) => setCreditInfo(r.data)).catch(err => handleError(err))
  }, [customerId])

  // ATP batch check — debounced
  const fetchATP = useCallback((wId: string, orderItems: OrderItemInput[]) => {
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
        .catch(err => handleError(err, { userMessage: 'Không kiểm tra được tồn kho, vui lòng thử lại' }))
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

  const addItem = () => setItems([...items, { product_id: '', quantity: 1 }])

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

    if ((field === 'product_id' || field === 'quantity') && warehouseId) {
      fetchATP(warehouseId, newItems)
    }
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    if (warehouseId) fetchATP(warehouseId, newItems)
  }

  // Computed
  const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0)
  const totalDeposit = items.reduce((sum, i) => {
    const dp = i.deposit_price || products.find(p => p.id === i.product_id)?.deposit_price || 0
    return sum + dp * i.quantity
  }, 0)
  const grandTotal = totalAmount + totalDeposit

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

    if (hasAtpIssue) {
      setError('Không thể lưu: có sản phẩm vượt tồn kho khả dụng (ATP). Vui lòng điều chỉnh số lượng.')
      return
    }

    setSubmitting(true)
    try {
      const res: any = await apiFetch(`/orders/${params.id}`, {
        method: 'PUT',
        body: {
          customer_id: customerId,
          warehouse_id: warehouseId,
          delivery_date: deliveryDate,
          notes: notes || undefined,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        },
      })

      const updated = res.data
      if (updated.status === 'pending_approval') {
        toast.warning(`Đơn ${updated.order_number} đã cập nhật — VƯỢT HẠN MỨC → Chờ kế toán duyệt`)
      } else {
        toast.success(`Đơn ${updated.order_number} đã cập nhật thành công! (Đã xác nhận)`)
      }
      router.push(`/dashboard/orders/${params.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // formatVND imported from status-config (single source of truth)

  const formatNumber = (n: number) =>
    new Intl.NumberFormat('vi-VN').format(n)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div></div>

  const canEdit = order && ['draft', 'confirmed', 'pending_approval'].includes(order.status)
  if (!canEdit) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">Không thể sửa đơn hàng ở trạng thái hiện tại</p>
      <button onClick={() => router.back()} className="text-brand-500 hover:underline">← Quay lại</button>
    </div>
  )

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-1">← Quay lại</button>
        <h1 className="text-2xl font-bold text-gray-800">Sửa đơn hàng — {order?.order_number}</h1>
      </div>

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
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required>
                <option value="">-- Chọn kho --</option>
                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày giao</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ghi chú (tùy chọn)" />
            </div>
          </div>

          {/* Credit info panel */}
          {creditInfo && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <div className={`px-4 py-2 text-sm font-semibold ${
                creditInfo.available_limit > 0 ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'
              }`}>
                💳 Hạn mức tín dụng — {creditInfo.code}
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
                {totalAmount > 0 && (
                  <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    creditExceeded ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                    {creditExceeded ? (
                      <>⚠️ Đơn hàng <strong>{formatVND(totalAmount)}</strong> VƯỢT hạn mức khả dụng <strong>{formatVND(creditInfo.available_limit)}</strong> → Đơn sẽ ở trạng thái <strong>&quot;Chờ duyệt&quot;</strong></>
                    ) : (
                      <>✅ Đơn hàng <strong>{formatVND(totalAmount)}</strong> trong hạn mức khả dụng <strong>{formatVND(creditInfo.available_limit)}</strong> → Đơn sẽ <strong>&quot;Đã xác nhận&quot;</strong></>
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
            <button type="button" onClick={addItem} className="px-3 py-1 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">+ Thêm sản phẩm</button>
          </div>

          {items.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nh\u1ea5n &quot;Th\u00eam s\u1ea3n ph\u1ea9m&quot; \u0111\u1ec3 b\u1eaft \u0111\u1ea7u</p>
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
                        <input type="number" min={1} value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value) || 0)}
                          className={`w-full px-2 py-1 border rounded text-right text-sm ${!atpOk ? 'border-red-400 bg-red-50 text-red-700' : ''}`} />
                      </td>
                      <td className="py-2 px-3 text-right">{item.price ? formatVND(item.price) : '-'}</td>
                      <td className="py-2 px-3 text-right font-medium">{item.amount ? formatVND(item.amount) : '-'}</td>
                      <td className="py-2 px-3 text-center">
                        {!item.product_id ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : atpLoading ? (
                          <span className="text-gray-400 text-xs">Đang kiểm...</span>
                        ) : atpChecked ? (
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            atpOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            <span>{atpOk ? '✅' : '❌'}</span>
                            <span>ATP: {formatNumber(atp!.atp)}</span>
                            <span className="text-gray-400">/ Đặt: {formatNumber(item.quantity)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Chọn kho để kiểm tra</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">✕</button>
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
            <h2 className="font-semibold mb-3">🔍 Kiểm tra trước khi lưu</h2>
            <div className="space-y-2">
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
                      <p className="mt-1 font-semibold">→ Không thể lưu. Vui lòng giảm số lượng hoặc đổi sản phẩm.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-green-600 mt-1">
                      Tất cả {itemsWithProduct.length} sản phẩm đều đủ tồn kho khả dụng ✓
                    </p>
                  )}
                </div>
              </div>

              {creditInfo && totalAmount > 0 && (
                <div className={`flex items-start gap-3 px-4 py-3 rounded-lg ${
                  creditExceeded ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
                }`}>
                  <span className="text-xl">{creditExceeded ? '⚠️' : '✅'}</span>
                  <div>
                    <p className={`font-semibold text-sm ${creditExceeded ? 'text-yellow-700' : 'text-green-700'}`}>
                      Kiểm tra hạn mức tín dụng
                    </p>
                    {creditExceeded ? (
                      <div className="text-sm text-yellow-700 mt-1">
                        <p>
                          Tiền hàng <strong>{formatVND(totalAmount)}</strong> vượt hạn mức khả dụng <strong>{formatVND(creditInfo.available_limit)}</strong>
                          {' '}(vượt {formatVND(totalAmount - creditInfo.available_limit)})
                        </p>
                        <p className="mt-1">→ Đơn sẽ chuyển về trạng thái <strong className="text-orange-700">&quot;Chờ duyệt&quot;</strong> — cần quản lý/kế toán phê duyệt.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-green-600 mt-1">
                        Tiền hàng {formatVND(totalAmount)} trong hạn mức khả dụng {formatVND(creditInfo.available_limit)} → Đơn sẽ <strong>&quot;Đã xác nhận&quot;</strong> ✓
                      </p>
                    )}
                  </div>
                </div>
              )}

              {creditInfo && totalAmount > 0 && !hasAtpIssue && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                  creditExceeded ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <span className="text-xl">📋</span>
                  <p className="text-sm font-medium">
                    Dự kiến trạng thái đơn sau khi lưu:{' '}
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

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200">❌ {error}</div>}

        <div className="flex gap-3 items-center">
          <button type="submit" disabled={submitting || items.length === 0 || hasAtpIssue}
            className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Đang lưu...' : hasAtpIssue ? '🚫 Không đủ tồn kho' : '💾 Lưu thay đổi'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">Hủy</button>
          {hasAtpIssue && (
            <span className="text-sm text-red-600 font-medium">Vui lòng điều chỉnh số lượng để lưu đơn</span>
          )}
        </div>
      </form>
    </div>
  )
}
