'use client'

// WMS Phase 9 — Universal scan page (PDA HID + camera BarcodeDetector).
// Routes:
//   - Pallet QR (GS1: starts with "(00)") → /warehouse/pallets/:lpn
//   - Bin QR ("(BIN)..." or "BHL-BIN-...") → /warehouse/bins/:code
// Tools: any user can lookup; the LogScan record is auto-inserted by backend.

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

type ScanResult = {
  ok: boolean
  type?: 'pallet' | 'bin'
  data?: any
  error?: string
}

// Parse a QR payload to detect type + extract code.
function parseQR(raw: string): { type: 'pallet' | 'bin' | 'unknown'; code: string } {
  const s = raw.trim()
  if (s.startsWith('(00)')) {
    // GS1 SSCC — extract LPN between (00) and next AI
    const m = s.match(/^\(00\)([^()]+)/)
    return { type: 'pallet', code: m ? m[1] : s }
  }
  if (s.startsWith('(BIN)')) {
    return { type: 'bin', code: s.replace(/^\(BIN\)/, '') }
  }
  if (/^BHL-LP-/.test(s)) return { type: 'pallet', code: s }
  if (/^[A-Z]\d?-\d+/.test(s)) return { type: 'bin', code: s }
  return { type: 'unknown', code: s }
}

export default function WarehouseScanPage() {
  const [history, setHistory] = useState<ScanResult[]>([])
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const hidBufferRef = useRef('')
  const hidTimerRef = useRef<any>(null)

  // ── PDA hardware-scanner KeyEvent listener ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore when typing in inputs
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Enter') {
        if (hidBufferRef.current.length >= 3) {
          handleScan(hidBufferRef.current)
        }
        hidBufferRef.current = ''
        return
      }
      if (e.key.length === 1) {
        hidBufferRef.current += e.key
        clearTimeout(hidTimerRef.current)
        hidTimerRef.current = setTimeout(() => { hidBufferRef.current = '' }, 200)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Camera (BarcodeDetector API or fallback msg) ──
  const startCamera = async () => {
    try {
      const BD: any = (window as any).BarcodeDetector
      if (!BD) {
        toast.error('Trình duyệt không hỗ trợ BarcodeDetector. Vui lòng dùng PDA hoặc nhập tay.')
        return
      }
      detectorRef.current = new BD({ formats: ['qr_code', 'data_matrix', 'code_128'] })
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
      tickDetect()
    } catch (e: any) {
      toast.error('Không truy cập được camera: ' + e.message)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraOn(false)
  }

  const tickDetect = async () => {
    if (!cameraOn && !streamRef.current) return
    try {
      if (videoRef.current && detectorRef.current) {
        const codes = await detectorRef.current.detect(videoRef.current)
        if (codes && codes.length) {
          const raw = codes[0].rawValue
          if (raw) {
            handleScan(raw)
          }
        }
      }
    } catch {}
    if (streamRef.current) requestAnimationFrame(tickDetect)
  }

  // ── Lookup ──
  const handleScan = async (raw: string) => {
    if (busy) return
    setBusy(true)
    const parsed = parseQR(raw)
    try {
      if (parsed.type === 'pallet') {
        const res: any = await apiFetch(`/warehouse/pallets/${encodeURIComponent(parsed.code)}`)
        addHistory({ ok: true, type: 'pallet', data: res.data })
      } else if (parsed.type === 'bin') {
        const res: any = await apiFetch(`/warehouse/bins/${encodeURIComponent(parsed.code)}/contents`)
        addHistory({ ok: true, type: 'bin', data: res.data })
      } else {
        addHistory({ ok: false, error: 'QR không nhận dạng: ' + raw })
        toast.error('QR không nhận dạng')
      }
    } catch (e: any) {
      addHistory({ ok: false, error: e.message })
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const addHistory = (r: ScanResult) => {
    setHistory(prev => [r, ...prev].slice(0, 20))
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📷 Quét QR Pallet / Bin</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex gap-2 mb-3">
          {!cameraOn ? (
            <button onClick={startCamera} className="px-4 py-2 bg-blue-600 text-white rounded">
              Bật camera
            </button>
          ) : (
            <button onClick={stopCamera} className="px-4 py-2 bg-gray-600 text-white rounded">
              Tắt camera
            </button>
          )}
          <span className="text-sm text-gray-500 self-center">
            Hoặc dùng PDA (HID): quét + Enter tự động
          </span>
        </div>
        {cameraOn && (
          <video ref={videoRef} className="w-full max-h-80 bg-black rounded" muted playsInline />
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            placeholder="Nhập tay LPN hoặc bin_code (Enter)"
            className="flex-1 border rounded px-3 py-2"
            onKeyDown={e => {
              if (e.key === 'Enter' && manualInput.trim()) {
                handleScan(manualInput.trim())
                setManualInput('')
              }
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-2">Lịch sử quét (gần nhất)</h2>
        {history.length === 0 && <p className="text-gray-500">Chưa có lượt quét.</p>}
        <div className="space-y-2">
          {history.map((h, i) => (
            <div key={i} className={'p-3 rounded border ' + (h.ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50')}>
              {h.ok ? (
                h.type === 'pallet' ? (
                  <div>
                    <div className="font-mono font-semibold">{h.data.lpn_code}</div>
                    <div className="text-sm">
                      {h.data.product_name} · Lô {h.data.batch_number} · HSD {h.data.expiry_date}
                    </div>
                    <div className="text-xs text-gray-600">
                      Bin {h.data.current_bin_code || '—'} · SL {h.data.qty}/{h.data.initial_qty} · {h.data.status}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-mono font-semibold">Bin {h.data.bin?.bin_code}</div>
                    <div className="text-sm">
                      {h.data.occupied}/{h.data.capacity} pallet · {(h.data.bin?.bin_type)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {(h.data.pallets || []).slice(0, 3).map((p: any) => p.lpn_code).join(', ')}
                    </div>
                  </div>
                )
              ) : (
                <div className="text-red-700 text-sm">{h.error}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
