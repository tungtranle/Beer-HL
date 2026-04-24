/**
 * safeParseVND — parse chuỗi tiền Việt Nam thành số nguyên (VND không có số lẻ).
 * Thay thế toàn bộ parseFloat/parseInt cho các trường tiền tệ.
 *
 * Hành vi:
 *  - "12,500"     → 12500
 *  - "1.200.000"  → 1200000
 *  - "1200000"    → 1200000
 *  - "abc"        → 0
 *  - ""           → 0
 *  - undefined    → 0
 *  - số âm        → throw Error (tiền không âm trong nghiệp vụ BHL)
 */
export function safeParseVND(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') {
    if (isNaN(value)) return 0
    if (value < 0) throw new Error(`safeParseVND: giá trị âm không hợp lệ: ${value}`)
    return Math.round(value)
  }

  // Remove thousand separators (. or ,) but keep the last segment for decimal
  // VND format: "1.200.000" or "1,200,000" — both mean one million two hundred thousand
  // No decimal in VND — strip all separators
  const cleaned = String(value)
    .trim()
    .replace(/[^\d.,\-]/g, '') // keep digits, dot, comma, minus
    .replace(/[.,]/g, '')      // remove all separators — VND has no decimal

  if (cleaned === '' || cleaned === '-') return 0

  const n = parseInt(cleaned, 10)
  if (isNaN(n)) return 0
  if (n < 0) throw new Error(`safeParseVND: giá trị âm không hợp lệ: ${value}`)
  return n
}

/**
 * Variant không throw — trả 0 nếu âm (dùng cho trường hợp display-only).
 */
export function safeParseVNDSafe(value: string | number | null | undefined): number {
  try {
    return safeParseVND(value)
  } catch {
    return 0
  }
}
