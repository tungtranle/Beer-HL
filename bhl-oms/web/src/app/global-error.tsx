"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Đã xảy ra lỗi
          </h2>
          <p className="text-gray-600 mb-6">
            Hệ thống đã ghi nhận lỗi này. Vui lòng thử lại.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 mb-4">
              (Ref: {error.digest})
            </p>
          )}
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#F68634] text-white rounded-lg hover:bg-[#e5751f] transition-colors"
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
