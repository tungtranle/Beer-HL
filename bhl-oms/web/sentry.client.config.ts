import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://bef6b6bd4de51ed9d7ed78047b61298a@o4511092744454144.ingest.us.sentry.io/4511092773486592",
  
  // Performance monitoring
  tracesSampleRate: 0.3, // 30% of transactions
  
  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% when error occurs
  
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  environment: process.env.NODE_ENV || "development",
  
  // Filter out noisy errors
  ignoreErrors: [
    "ResizeObserver loop",
    "Network request failed",
    "Load failed",
  ],
});
