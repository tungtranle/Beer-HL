import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BHL OMS-TMS-WMS',
  description: 'Hệ thống Quản lý Đơn hàng - Vận tải - Kho vận | Bia Hạ Long',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d97706" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        ` }} />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
