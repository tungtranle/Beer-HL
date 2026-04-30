'use client'

/**
 * Input — text input chuẩn: label, error, hint, prefix/suffix icon.
 * Replaces: 24 file dùng `<input className="...">` trần.
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 */

import { type InputHTMLAttributes, forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle } from 'lucide-react'

type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  size?: InputSize
  /** Full width (default: true) */
  fullWidth?: boolean
}

const SIZE_BASE: Record<InputSize, string> = {
  sm: 'h-8 text-xs px-2.5',
  md: 'h-10 text-sm px-3',
  lg: 'h-12 text-base px-4',
}

const SIZE_ICON_PADDING_L: Record<InputSize, string> = {
  sm: 'pl-7',
  md: 'pl-9',
  lg: 'pl-11',
}

const SIZE_ICON_PADDING_R: Record<InputSize, string> = {
  sm: 'pr-7',
  md: 'pr-9',
  lg: 'pr-11',
}

const SIZE_ICON_POS: Record<InputSize, string> = {
  sm: 'left-2 h-3.5 w-3.5',
  md: 'left-2.5 h-4 w-4',
  lg: 'left-3 h-5 w-5',
}

const SIZE_ICON_POS_R: Record<InputSize, string> = {
  sm: 'right-2 h-3.5 w-3.5',
  md: 'right-2.5 h-4 w-4',
  lg: 'right-3 h-5 w-5',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    size = 'md',
    fullWidth = true,
    className = '',
    id,
    ...rest
  },
  ref,
) {
  const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

  const base =
    'rounded-lg border bg-white text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed'
  const borderCls = error
    ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400'
    : 'border-slate-200 hover:border-slate-300'

  const paddingL = LeftIcon ? SIZE_ICON_PADDING_L[size] : ''
  const paddingR = RightIcon || error ? SIZE_ICON_PADDING_R[size] : ''

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
          {rest.required && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}
      <div className="relative">
        {LeftIcon && (
          <LeftIcon
            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${SIZE_ICON_POS[size]}`}
            aria-hidden="true"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={`${base} ${borderCls} ${SIZE_BASE[size]} ${paddingL} ${paddingR} ${className}`}
          style={{ width: fullWidth ? '100%' : undefined }}
          {...rest}
        />
        {(RightIcon || error) && (
          <span
            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${SIZE_ICON_POS_R[size]}`}
            aria-hidden="true"
          >
            {error ? (
              <AlertCircle className="text-rose-500" aria-hidden="true" />
            ) : RightIcon ? (
              <RightIcon />
            ) : null}
          </span>
        )}
      </div>
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
