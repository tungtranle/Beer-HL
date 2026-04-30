const { withSentryConfig } = require("@sentry/nextjs");

// In Docker production, Next.js server proxies to sibling containers via their service names.
// Locally, falls back to localhost.
const API_ORIGIN = process.env.INTERNAL_API_ORIGIN || 'http://localhost:8080'
const OSRM_ORIGIN = process.env.INTERNAL_OSRM_ORIGIN || 'http://localhost:5000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' && process.platform !== 'win32' ? 'standalone' : undefined,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Compress responses from Node server (fallback if nginx not doing it)
  compress: true,
  // Bundle optimisation — tree-shake large icon/util packages
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-leaflet'],
  },
  // Cache-Control: only HTML pages no-cache; static chunks are content-hashed → immutable
  async headers() {
    return [
      // Static JS/CSS chunks — content-hashed filename → safe to cache 1 year
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Optimised images
      {
        source: '/_next/image(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      // Icons & manifest — short cache, fine to update with a new deploy
      {
        source: '/(icon-.*|manifest\\.json)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      // Service worker — always revalidate so updates propagate immediately
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // HTML pages — no-cache so new deploys take effect on next navigation
      {
        source: '/((?!_next/static|_next/image|icon-|manifest\\.json|sw\\.js).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
    ]
  },
  async rewrites() {
    return [
      // Go backend API proxy — routes /v1/* to backend port 8080
      {
        source: '/v1/:path*',
        destination: `${API_ORIGIN}/v1/:path*`,
      },
      // OSRM routing — proxied server-side (avoids CORS from browser to Docker)
      {
        source: '/osrm/:path*',
        destination: `${OSRM_ORIGIN}/:path*`,
      },
    ]
  },
}

if (process.env.NODE_ENV !== 'production') {
  module.exports = nextConfig
} else {
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    disableServerWebpackPlugin: true,
    disableClientWebpackPlugin: true,
  })
}
