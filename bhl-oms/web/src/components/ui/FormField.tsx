'use client'

/**
 * FormField — wrapper: label + any input + error/hint.
 * Dùng khi cần wrap custom input không phải <Input> / <Textarea>.
 * Thống nhất spacing và layout giữa các form field.
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 */

import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className = '',
  children,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-700 leading-tight"
      >
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      {children}

      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}
