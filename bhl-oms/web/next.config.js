const { withSentryConfig } = require("@sentry/nextjs");

// In Docker production, Next.js server proxies to sibling containers via their service names.
// Locally, falls back to localhost.
const API_ORIGIN = process.env.INTERNAL_API_ORIGIN || 'http://localhost:8080'
const OSRM_ORIGIN = process.env.INTERNAL_OSRM_ORIGIN || 'http://localhost:5000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Disable static cache for HTML pages so new deploys take effect immediately
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/v1/:path*`,
      },
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
