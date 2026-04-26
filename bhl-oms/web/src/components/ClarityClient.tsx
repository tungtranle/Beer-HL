"use client"
import { useEffect, useState } from 'react'

const COOKIE_KEY = 'bhl_consent_analytics'
const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'wgqlli4s7j'
const CONSENT_EVENT = 'bhl_consent_change'

export default function ClarityClient() {
  const [consent, setConsent] = useState<boolean>(false)

  useEffect(() => {
    // Khởi tạo từ localStorage khi mount
    try { setConsent(localStorage.getItem(COOKIE_KEY) === '1') } catch {}

    // Nghe consent từ cùng tab (CustomEvent từ CookieConsent)
    const onConsent = (e: Event) => {
      setConsent((e as CustomEvent).detail?.accepted === true)
    }
    // Nghe consent từ tab khác (storage event)
    const onStorage = (e: StorageEvent) => {
      if (e.key === COOKIE_KEY) setConsent(e.newValue === '1')
    }
    window.addEventListener(CONSENT_EVENT, onConsent)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    if (!consent) return
    if (typeof window === 'undefined') return
    if (location.hostname !== 'bhl.symper.us') return
    // Tránh load 2 lần
    if (typeof (window as any).clarity === 'function') return
    try {
      ;(function(c: any,l: any,a: string,r: string,i: string,t?: any,y?: any){
        c[a]=c[a]||function(...args: unknown[]){(c[a].q=c[a].q||[]).push(args)};
        t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,'clarity','script',CLARITY_PROJECT_ID);
    } catch { /* fail silently */ }
  }, [consent])

  return null
}
