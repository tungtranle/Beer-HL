import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClarityClient from '../components/ClarityClient'
import CookieConsent from '../components/CookieConsent'

// Self-hosted via next/font — no external CDN round-trip, auto-subset, font-display:swap
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'BHL - Quản lý Đơn hàng, Vận chuyển & Kho',
  description: 'Hệ thống Quản lý Đơn hàng - Vận tải - Kho vận | Bia Hạ Long',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <head>
        <meta charSet="utf-8" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d97706" />
        {/* Map CSS is imported directly in map pages — no render-blocking cross-origin link here */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
              if (isLocalDev) {
                navigator.serviceWorker.getRegistrations()
                  .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
                  .then(() => caches.keys())
                  .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
                  .catch(() => {});
                return;
              }
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        ` }} />
      </head>
      <body className={`bg-gray-50 ${inter.className}`}>
        {children}
        {/* Microsoft Clarity — chỉ load trên bhl.symper.us sau khi có consent */}
        <ClarityClient />
        <CookieConsent />
      </body>
    </html>
  )
}
