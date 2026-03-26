const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8097/v1/:path*',
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Disable source map upload in dev (no auth token needed for basic setup)
  silent: true,
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
});
