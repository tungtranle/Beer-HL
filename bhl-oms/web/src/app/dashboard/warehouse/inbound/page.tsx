'use client'

// WMS Phase 9 task 9.7 — Inbound: nhập kho pallet + in nhãn ZPL.

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Product { id: string; sku: string; name: string }
interface Pallet { id: string; lpn_code: string; qr_payload: string }

export default function InboundPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [warehouseID, _setWarehouseID] = useState('a0000000-0000-0000-0000-000000000001')
  const [productID, setProductID] = useState('')
  const [batch, setBatch] = useState('')
  const [prodDate, setProdDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [qty, setQty] = useState(480)
  const [binCode, setBinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ pallet: Pallet; zpl: string } | null>(null)

  useEffect(() => {
    apiFetch<any>('/products').then(r => setProducts((r.data || []).slice(0, 200))).catch(() => {})
  }, [])

  const submit = async () => {
    if (!productID || !batch || !prodDate || !expiryDate) {
      toast.error('Điền đủ thông tin')
      return
    }
    setBusy(true)
    try {
      const r: any = await apiFetch('/warehouse/inbound/receive', {
        method: 'POST',
        body: {
          warehouse_id: warehouseID,
          product_id: productID,
          batch_number: batch,
          production_date: prodDate,
          expiry_date: expiryDate,
          qty,
          bin_code: binCode || undefined,
        },
      })
      setCreated(r.data)
      toast.success('Nhập kho thành công LPN ' + r.data.pallet.lpn_code)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const downloadZPL = () => {
    if (!created) return
    const blob = new Blob([created.zpl], { type: 'application/zpl' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${created.pallet.lpn_code}.zpl`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printDirect = () => {
    if (!created) return
    // Open ZPL in new window for printing via Zebra Browser Print extension
    const win = window.open('', '_blank')
    if (win) {
      win.document.write('<pre>' + created.zpl + '</pre>')
      win.document.close()
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📦 Nhập kho pallet (1 pallet = 1 lô)</h1>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium">Sản phẩm</label>
          <select className="w-full border rounded px-2 py-2" value={productID}
            onChange={e => setProductID(e.target.value)}>
            <option value="">— Chọn —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Số lô (batch)</label>
            <input className="w-full border rounded px-2 py-2" value={batch} onChange={e => setBatch(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Số lượng</label>
            <input type="number" className="w-full border rounded px-2 py-2" value={qty}
              onChange={e => setQty(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Ngày SX</label>
            <input type="date" className="w-full border rounded px-2 py-2" value={prodDate} onChange={e => setProdDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">HSD</label>
            <input type="date" className="w-full border rounded px-2 py-2" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium">Bin (tùy chọn — bỏ trống nếu chưa putaway)</label>
            <input className="w-full border rounded px-2 py-2" value={binCode} onChange={e => setBinCode(e.target.value)} />
          </div>
        </div>
        <button onClick={submit} disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {busy ? 'Đang lưu…' : 'Nhập kho + In nhãn'}
        </button>
      </div>

      {created && (
        <div className="mt-4 bg-green-50 border-2 border-green-400 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">✅</span>
            <div>
              <div className="text-xs text-green-700 font-medium uppercase tracking-wide">Nhập kho thành công</div>
              <div className="font-mono text-2xl font-black text-green-800 tracking-wider">{created.pallet.lpn_code}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 mb-3 border border-green-200">
            <span className="text-xs text-gray-500">QR Payload: </span>
            <span className="font-mono text-xs text-gray-700 break-all">{created.pallet.qr_payload}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadZPL} className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800">⬇ Tải .zpl</button>
            <button onClick={printDirect} className="flex-1 px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">🖨 In nhãn ZPL</button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">Xem mã ZPL</summary>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-64 border">{created.zpl}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
