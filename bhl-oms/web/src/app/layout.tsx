import type { Metadata } from 'next'
import './globals.css'
import ClarityClient from '../components/ClarityClient'
import CookieConsent from '../components/CookieConsent'

export const metadata: Metadata = {
  title: 'BHL - Quản lý Đơn hàng, Vận chuyển & Kho',
  description: 'Hệ thống Quản lý Đơn hàng - Vận tải - Kho vận | Bia Hạ Long',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d97706" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        ` }} />
        {/* Microsoft Clarity client loader + cookie consent (client-side) */}
        <ClarityClient />
        <CookieConsent />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
