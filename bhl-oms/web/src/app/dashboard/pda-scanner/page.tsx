'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface ScanResult {
  barcode: string
  product_name: string
  product_sku: string
  lot_number: string | null
  quantity: number
  scanned_at: string
}

export default function PDABarcodeScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [manualInput, setManualInput] = useState('')
  const [error, setError] = useState('')
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      setCameraAvailable(true)
    } catch {
      setCameraAvailable(false)
      setError('Không thể truy cập camera. Vui lòng nhập mã barcode thủ công.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  useEffect(() => {
    return () => { stopCamera() }
  }, [stopCamera])

  const lookupBarcode = async (barcode: string) => {
    setError('')
    try {
      const res: any = await apiFetch('/warehouse/barcode-scan', {
        method: 'POST',
        body: JSON.stringify({ barcode: barcode.trim(), warehouse_id: '' }),
      })
      const result: ScanResult = {
        barcode: barcode.trim(),
        product_name: res.data?.product_name || 'Unknown',
        product_sku: res.data?.product_sku || barcode,
        lot_number: res.data?.lot_number || null,
        quantity: res.data?.quantity || 0,
        scanned_at: new Date().toLocaleTimeString('vi-VN'),
      }
      setLastScan(result)
      setScanHistory(prev => [result, ...prev.slice(0, 49)])
    } catch (err: any) {
      setError(err.message || 'Không tìm thấy sản phẩm')
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualInput.trim()) {
      lookupBarcode(manualInput.trim())
      setManualInput('')
    }
  }

  // BarcodeDetector API (Chrome 83+)
  useEffect(() => {
    if (!scanning || !videoRef.current) return

    let active = true
    const detectBarcode = async () => {
      if (!active || !videoRef.current) return

      // Try BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code']
          })
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0 && active) {
            const value = barcodes[0].rawValue
            lookupBarcode(value)
            // Pause briefly after scan
            await new Promise(r => setTimeout(r, 2000))
          }
        } catch { /* detection failed, retry */ }
      }

      if (active) requestAnimationFrame(detectBarcode)
    }

    const timer = setTimeout(detectBarcode, 500)
    return () => { active = false; clearTimeout(timer) }
  }, [scanning])

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-2xl">←</Link>
        <h1 className="text-xl font-bold">📱 PDA Barcode Scanner</h1>
      </div>

      {/* Camera View */}
      {cameraAvailable && (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} className="w-full" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scan Frame Overlay */}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-40 border-2 border-green-400 rounded-lg opacity-75">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Camera Toggle */}
      <button
        onClick={scanning ? stopCamera : startCamera}
        className={`w-full py-2.5 rounded-lg font-medium ${
          scanning
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-brand-500 text-white hover:bg-brand-600'
        }`}>
        {scanning ? '⏹ Dừng camera' : '📷 Bật camera quét'}
      </button>

      {/* Manual Input */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={e => setManualInput(e.target.value)}
          placeholder="Nhập mã barcode thủ công..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          autoFocus={!cameraAvailable}
        />
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          Tra cứu
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Last Scan Result */}
      {lastScan && (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div className="flex-1">
              <div className="font-bold text-green-900 text-lg leading-tight">{lastScan.product_name}</div>
              <div className="font-mono text-xs text-green-600 mt-0.5">{lastScan.product_sku}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-green-700 tabular-nums">{lastScan.quantity.toLocaleString()}</div>
              <div className="text-xs text-green-500">tồn kho</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-mono">{lastScan.barcode}</span>
            {lastScan.lot_number && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Lô {lastScan.lot_number}</span>}
            <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded text-xs ml-auto">{lastScan.scanned_at}</span>
          </div>
        </div>
      )}

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold text-gray-700">Lịch sử quét</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{scanHistory.length} mã</span>
          </div>
          <div className="space-y-1.5">
            {scanHistory.map((scan, idx) => (
              <div key={idx} className={`rounded-lg p-2.5 flex justify-between items-center border ${idx === 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'}`}>
                <div>
                  <div className="font-medium text-sm text-gray-800">{scan.product_name}</div>
                  <div className="text-xs text-gray-400 font-mono">{scan.barcode} · {scan.scanned_at}</div>
                </div>
                <div className="text-sm font-bold tabular-nums text-brand-600">{scan.quantity.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
