'use client'

// WMS Phase 9 task 9.7 — Inbound: nhập kho pallet với GỢI Ý VỊ TRÍ CẤT (bin guidance).
// World-class WMS UX: thủ kho thấy ngay "Cất vào A-03-02" trên phiếu nhập, không cần nhớ mã bin.

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Product { id: string; sku: string; name: string }
interface Pallet { id: string; lpn_code: string; qr_payload: string; current_bin_code?: string }
interface BinSuggestion {
  bin: { id: string; bin_code: string; zone: string | null; row_code: string | null; level_code: string | null; velocity_class: string | null }
  occupied_pallets: number
  free_slots: number
  score: number
  reason: string
}

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

  // Suggest-bin state
  const [suggestions, setSuggestions] = useState<BinSuggestion[] | null>(null)
  const [loadingSuggest, setLoadingSuggest] = useState(false)

  useEffect(() => {
    apiFetch<any>('/products').then(r => setProducts((r.data || []).slice(0, 200))).catch(() => {})
  }, [])

  // Reset suggestions whenever inputs that affect them change
  useEffect(() => { setSuggestions(null) }, [productID, qty, warehouseID])

  const fetchSuggestions = async () => {
    if (!productID) {
      toast.error('Chọn sản phẩm trước')
      return
    }
    setLoadingSuggest(true)
    try {
      const r: any = await apiFetch(`/warehouse/inbound/suggest-bin-preview?warehouse_id=${warehouseID}&product_id=${productID}&qty=${qty}`)
      setSuggestions(r.data || [])
    } catch (e: any) {
      toast.error('Không lấy được gợi ý: ' + e.message)
    } finally {
      setLoadingSuggest(false)
    }
  }

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
    const win = window.open('', '_blank')
    if (win) {
      win.document.write('<pre>' + created.zpl + '</pre>')
      win.document.close()
    }
  }

  const printSlip = () => {
    if (!created) return
    window.print()
  }

  const productName = products.find(p => p.id === productID)?.name || ''
  const productSKU = products.find(p => p.id === productID)?.sku || ''

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 print:hidden"> Phiếu nhập kho — gợi ý vị trí cất</h1>

      <div className="bg-white rounded-lg shadow p-4 space-y-3 print:hidden">
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
            <label className="block text-sm font-medium">Số lượng (chai/lon)</label>
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
        </div>

        {/* Suggest-bin block */}
        <div className="border-t pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium"> Vị trí cất hàng (bin)</label>
            <button
              type="button"
              onClick={fetchSuggestions}
              disabled={loadingSuggest || !productID}
              className="text-xs px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-50 hover:bg-emerald-700"
            >
              {loadingSuggest ? 'Đang gợi ý…' : ' Gợi ý vị trí tốt nhất'}
            </button>
          </div>

          <input
            className="w-full border rounded px-2 py-2 font-mono text-lg"
            placeholder="VD: A-03-02 (bỏ trống nếu chưa rõ)"
            value={binCode}
            onChange={e => setBinCode(e.target.value.toUpperCase())}
          />

          {suggestions && suggestions.length === 0 && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              Không có bin trống. Liên hệ trưởng kho.
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {suggestions.map((s, idx) => {
                const selected = binCode === s.bin.bin_code
                return (
                  <button
                    key={s.bin.id}
                    type="button"
                    onClick={() => setBinCode(s.bin.bin_code)}
                    className={`text-left p-3 rounded-lg border-2 transition ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xl font-black tracking-wider">{s.bin.bin_code}</span>
                      {idx === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded">TỐT NHẤT</span>}
                    </div>
                    <div className="text-xs text-slate-600">
                      Trống {s.free_slots}/{s.free_slots + s.occupied_pallets} slot
                      {s.bin.velocity_class && <> · class {s.bin.velocity_class}</>}
                    </div>
                    {s.reason && <div className="text-[11px] text-slate-500 mt-1">{s.reason}</div>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button onClick={submit} disabled={busy}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded font-medium disabled:opacity-50 hover:bg-blue-700">
          {busy ? 'Đang lưu…' : '📥 Nhập kho + In nhãn'}
        </button>
      </div>

      {created && (
        <>
          {/* On-screen confirmation */}
          <div className="mt-4 bg-green-50 border-2 border-green-400 rounded-xl p-5 shadow-sm print:hidden">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">✓</span>
              <div>
                <div className="text-xs text-green-700 font-medium uppercase tracking-wide">Nhập kho thành công</div>
                <div className="font-mono text-2xl font-black text-green-800 tracking-wider">{created.pallet.lpn_code}</div>
              </div>
            </div>
            {(created.pallet.current_bin_code || binCode) && (
              <div className="bg-white rounded-lg p-3 mb-3 border-2 border-emerald-300">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Vị trí cất</div>
                <div className="font-mono text-3xl font-black text-emerald-700 tracking-widest">
                  {created.pallet.current_bin_code || binCode}
                </div>
              </div>
            )}
            <div className="bg-white rounded-lg px-3 py-2 mb-3 border border-green-200">
              <span className="text-xs text-gray-500">QR Payload: </span>
              <span className="font-mono text-xs text-gray-700 break-all">{created.pallet.qr_payload}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={printSlip} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">🖨 In phiếu</button>
              <button onClick={downloadZPL} className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800">⬇ Tải .zpl</button>
              <button onClick={printDirect} className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">🖨 In nhãn ZPL</button>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">Xem mã ZPL</summary>
              <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-64 border">{created.zpl}</pre>
            </details>
          </div>

          {/* Printable slip — only visible when print() is called */}
          <div className="hidden print:block print:p-8">
            <h1 className="text-2xl font-bold mb-1">PHIẾU NHẬP KHO</h1>
            <div className="text-sm text-slate-600 mb-4">Ngày {new Date().toLocaleString('vi-VN')}</div>
            <table className="w-full border-collapse text-sm mb-6">
              <tbody>
                <tr><td className="border px-2 py-1 font-semibold w-1/3">LPN</td><td className="border px-2 py-1 font-mono text-lg">{created.pallet.lpn_code}</td></tr>
                <tr><td className="border px-2 py-1 font-semibold">Sản phẩm</td><td className="border px-2 py-1">{productSKU} — {productName}</td></tr>
                <tr><td className="border px-2 py-1 font-semibold">Lô / HSD</td><td className="border px-2 py-1">{batch} — HSD {expiryDate}</td></tr>
                <tr><td className="border px-2 py-1 font-semibold">Số lượng</td><td className="border px-2 py-1">{qty}</td></tr>
                <tr><td className="border px-2 py-1 font-semibold">→ CẤT VÀO BIN</td><td className="border px-2 py-1 font-mono text-2xl font-black">{created.pallet.current_bin_code || binCode || '— (chưa chỉ định)'}</td></tr>
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-8 mt-12 text-sm">
              <div className="text-center">
                <div>Người nhập</div>
                <div className="border-t mt-12 pt-1">Ký, ghi rõ họ tên</div>
              </div>
              <div className="text-center">
                <div>Trưởng kho xác nhận</div>
                <div className="border-t mt-12 pt-1">Ký, ghi rõ họ tên</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
