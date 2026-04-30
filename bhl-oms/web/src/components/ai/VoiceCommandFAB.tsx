'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAIFeature } from '@/hooks/useAIFeature'
import { Button } from '@/components/ui/Button'

interface VoiceCommandResult {
  command?: string
  transcript: string
  confidence: number
  allowed: boolean
  confirm_required: boolean
  auto_cancel_second: number
  reasons?: string[]
}

interface SpeechRecognitionResultEventLike {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  abort?: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const commandLabel: Record<string, string> = {
  arrived_stop: 'Mở bước đã đến điểm giao',
  complete_delivery: 'Mở xác nhận đã giao',
  collect_payment: 'Mở ghi nhận thu tiền',
  report_issue: 'Mở báo sự cố',
  call_dispatcher: 'Gọi điều phối',
  open_next_stop: 'Mở điểm giao tiếp theo',
}

export function VoiceCommandFAB() {
  const { enabled } = useAIFeature('ai.voice')
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<VoiceCommandResult | null>(null)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const speechWindow = window as SpeechRecognitionWindow
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    setSupported(Boolean(Recognition))
  }, [])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
      recognitionRef.current?.abort?.()
    }
  }, [])

  const canRender = enabled && supported

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'vi-VN'
    window.speechSynthesis.speak(utterance)
  }

  const startListening = () => {
    if (!canRender || listening) return
    const speechWindow = window as SpeechRecognitionWindow
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.lang = 'vi-VN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    setResult(null)
    setError('')
    setListening(true)

    recognition.onresult = async (event: SpeechRecognitionResultEventLike) => {
      const transcript = event.results?.[0]?.[0]?.transcript || ''
      if (!transcript) return
      try {
        const res = await apiFetch<{ data: VoiceCommandResult }>('/ai/voice/parse', { method: 'POST', body: { transcript } })
        const parsed = res.data
        setResult(parsed)
        const label = parsed.command ? commandLabel[parsed.command] || parsed.command : 'chưa nhận diện được lệnh'
        speak(parsed.allowed ? `${label}. Vui lòng xác nhận trên màn hình.` : 'Lệnh chưa được phép hoặc chưa nhận diện được.')
        if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
        autoCloseRef.current = setTimeout(() => setResult(null), (parsed.auto_cancel_second || 10) * 1000)
      } catch {
        setError('Không phân tích được lệnh thoại')
        speak('Không phân tích được lệnh thoại. Vui lòng thao tác tay.')
      }
    }
    recognition.onerror = () => {
      setError('Không nghe được lệnh thoại')
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  const startHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(startListening, 500)
  }

  const endHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
  }

  const displayText = useMemo(() => {
    if (!result) return ''
    const label = result.command ? commandLabel[result.command] || result.command : 'Không nhận diện được lệnh'
    return result.allowed ? label : 'Lệnh chưa được phép'
  }, [result])

  if (!canRender) return null

  return (
    <>
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') startListening() }}
        className={`fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg active:scale-95 ${listening ? 'bg-rose-600 ai-pulse' : 'bg-brand-500'}`}
        aria-label="Giữ để ra lệnh thoại"
        title="Giữ để ra lệnh thoại"
      >
        {listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </button>

      {(result || error) && (
        <div className="fixed inset-x-3 bottom-24 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Lệnh thoại</div>
              <p className="mt-1 text-sm text-slate-600">{error || displayText}</p>
              {result?.transcript && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">“{result.transcript}”</p>}
              {result?.allowed && <p className="mt-2 text-xs text-amber-700">Lệnh chỉ mở bước xác nhận, không tự ghi trạng thái.</p>}
            </div>
            <button type="button" onClick={() => setResult(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          {result?.allowed && (
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="primary" size="sm" fullWidth onClick={() => setResult(null)}>Đã hiểu</Button>
              <Button type="button" variant="secondary" size="sm" fullWidth onClick={() => setResult(null)}>Hủy</Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}