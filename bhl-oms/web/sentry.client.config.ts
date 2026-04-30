import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://bef6b6bd4de51ed9d7ed78047b61298a@o4511092744454144.ingest.us.sentry.io/4511092773486592",

  // Low sample rate — enough signal without CPU/network overhead on every page
  tracesSampleRate: 0.05,

  // Replay: OFF by default to save ~70 KB on initial load.
  // Only record full replay when an error occurs (then capture 100%).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // BrowserTracing is lightweight; Replay is lazy-added after idle.
  integrations: [
    Sentry.browserTracingIntegration(),
  ],

  environment: process.env.NODE_ENV || "development",

  ignoreErrors: [
    "ResizeObserver loop",
    "Network request failed",
    "Load failed",
  ],
});

// Lazy-add Replay integration after the page is interactive and idle.
// This avoids the ~70 KB worker blocking the critical rendering path.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  const addReplay = async () => {
    const { replayIntegration } = await import('@sentry/nextjs')
    Sentry.addIntegration(
      replayIntegration({ maskAllText: false, blockAllMedia: true })
    )
  }
  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(addReplay, { timeout: 5000 })
  } else {
    setTimeout(addReplay, 3000)
  }
}
