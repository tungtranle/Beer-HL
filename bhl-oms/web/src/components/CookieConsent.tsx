"use client"
import { useEffect, useState } from 'react'

const COOKIE_KEY = 'bhl_consent_analytics'

export default function CookieConsent() {
  const [accepted, setAccepted] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem(COOKIE_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    try { if (typeof window !== 'undefined') setAccepted(localStorage.getItem(COOKIE_KEY) === '1') } catch {}
  }, [])

  if (accepted) return null

  function accept() {
    try { localStorage.setItem(COOKIE_KEY, '1'); setAccepted(true) } catch {}
  }
  function decline() {
    try { localStorage.setItem(COOKIE_KEY, '0'); setAccepted(true) } catch {}
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between bg-white border rounded-md p-3 shadow-md">
      <div className="text-sm">Chúng tôi dùng cookie để cải thiện trải nghiệm. Cho phép thu thập dữ liệu phân tích?</div>
      <div className="ml-4 flex gap-2">
        <button onClick={decline} className="px-3 py-1 text-sm border rounded">Không</button>
        <button onClick={accept} className="px-3 py-1 text-sm bg-amber-500 text-white rounded">Đồng ý</button>
      </div>
    </div>
  )
}
