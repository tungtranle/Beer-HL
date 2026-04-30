'use client'

/**
 * Textarea — multiline text input chuẩn: label, error, hint.
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 */

import { type TextareaHTMLAttributes, forwardRef } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  /** Default 4 */
  rows?: number
  /** Full width (default: true) */
  fullWidth?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, rows = 4, fullWidth = true, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

  const base =
    'rounded-lg border bg-white text-sm text-slate-900 placeholder-slate-400 px-3 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed resize-y'
  const borderCls = error
    ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400'
    : 'border-slate-200 hover:border-slate-300'

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {rest.required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`${base} ${borderCls} ${className}`}
        style={{ width: fullWidth ? '100%' : undefined }}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
})
