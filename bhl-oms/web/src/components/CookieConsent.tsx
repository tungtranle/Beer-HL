"use client"
import { useEffect, useState } from 'react'

const COOKIE_KEY = 'bhl_consent_analytics'

export default function CookieConsent() {
  // mounted=false on server → no hydration mismatch; banner shows only after client hydration
  const [mounted, setMounted] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try { setAccepted(localStorage.getItem(COOKIE_KEY) !== null) } catch {}
  }, [])

  if (!mounted || accepted) return null

  function accept() {
    try {
      localStorage.setItem(COOKIE_KEY, '1')
      setAccepted(true)
      window.dispatchEvent(new CustomEvent('bhl_consent_change', { detail: { accepted: true } }))
    } catch {}
  }
  function decline() {
    try {
      localStorage.setItem(COOKIE_KEY, '0')
      setAccepted(true)
      window.dispatchEvent(new CustomEvent('bhl_consent_change', { detail: { accepted: false } }))
    } catch {}
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border rounded-lg p-4 shadow-lg">
      <p className="text-sm text-gray-700">Chúng tôi dùng cookie để cải thiện trải nghiệm. Cho phép thu thập dữ liệu phân tích?</p>
      <div className="flex gap-2 shrink-0">
        <button onClick={decline} className="flex-1 sm:flex-none px-4 py-2 text-sm border rounded-md hover:bg-gray-50 transition-colors">Không</button>
        <button onClick={accept} className="flex-1 sm:flex-none px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors">Đồng ý</button>
      </div>
    </div>
  )
}
