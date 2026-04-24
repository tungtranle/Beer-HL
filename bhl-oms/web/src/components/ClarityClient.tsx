"use client"
import { useEffect, useState } from 'react'

const COOKIE_KEY = 'bhl_consent_analytics'

export default function ClarityClient() {
  const [consent, setConsent] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(COOKIE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const onStorage = () => {
      try { setConsent(localStorage.getItem(COOKIE_KEY) === '1') } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!consent) return
    const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID
    try {
      if (CLARITY_ID && location.hostname === 'bhl.symper.us') {
        ;(function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window,document,"clarity","script",CLARITY_ID);
      }
    } catch (e) {
      // fail silently
    }
  }, [consent])

  return null
}
