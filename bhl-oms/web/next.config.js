const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/v1/:path*',
      },
      {
        source: '/osrm/:path*',
        destination: 'http://localhost:5000/:path*',
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
