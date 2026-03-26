import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://bef6b6bd4de51ed9d7ed78047b61298a@o4511092744454144.ingest.us.sentry.io/4511092773486592",
  tracesSampleRate: 0.3,
  environment: process.env.NODE_ENV || "development",
});
