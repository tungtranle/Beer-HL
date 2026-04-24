import { toast } from './useToast'

/**
 * TD-020: Unified error handler thay thế `console.error` raw.
 * - Luôn log ra console (giữ stack trace cho dev).
 * - Hiển thị toast.error nếu `userMessage` được cung cấp (user-facing actions).
 * - KHÔNG show toast cho background polling/silent loads — chỉ pass `silent: true`.
 */
export interface HandleErrorOptions {
  /** Thông điệp tiếng Việt hiển thị cho user. Nếu bỏ qua → KHÔNG show toast (silent). */
  userMessage?: string
  /** Bắt buộc silent (không show toast) kể cả khi có userMessage. */
  silent?: boolean
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    if (typeof anyErr.message === 'string') return anyErr.message
    if (typeof anyErr.error === 'string') return anyErr.error
  }
  return 'Có lỗi không xác định'
}

function extractTraceRef(err: unknown): string | undefined {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    if (typeof anyErr.trace_ref === 'string') return anyErr.trace_ref
    if (typeof anyErr.traceRef === 'string') return anyErr.traceRef
  }
  return undefined
}

/**
 * Thay thế `console.error(err)` standard.
 *   handleError(err, { userMessage: 'Không lưu được đơn hàng' })
 *   handleError(err) // silent — chỉ log console
 */
export function handleError(err: unknown, opts: HandleErrorOptions = {}): void {
  // Always log for dev visibility
  console.error('[handleError]', err)
  if (opts.silent || !opts.userMessage) return
  const detail = extractMessage(err)
  const msg = detail && detail !== opts.userMessage
    ? `${opts.userMessage}: ${detail}`
    : opts.userMessage
  toast.error(msg, extractTraceRef(err))
}

/**
 * Shorthand cho user actions (save/submit/delete) — luôn show toast.
 */
export function notifyError(err: unknown, userMessage: string): void {
  handleError(err, { userMessage })
}
