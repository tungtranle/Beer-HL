'use client'

/**
 * Button — the only Button you should use.
 *
 * Variants: primary (brand), secondary (outline), ghost (text), danger, success.
 * Sizes: sm, md (default), lg.
 * States: loading (spinner + disabled), disabled.
 *
 * Reference: UX_AUDIT_REPORT.md §3.1 (anti-pattern: 200+ ad-hoc buttons)
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  fullWidth?: boolean
  children?: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/20 focus-visible:ring-brand-500',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300 focus-visible:ring-brand-500',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:ring-brand-500',
  subtle: 'bg-brand-50 hover:bg-brand-100 text-brand-700 focus-visible:ring-brand-500',
  danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/20 focus-visible:ring-rose-500',
  success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 focus-visible:ring-emerald-500',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

const ICON_SIZE: Record<Size, number> = { sm: 14, md: 16, lg: 18 }

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  fullWidth,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const iconPx = ICON_SIZE[size]
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[BASE, VARIANT[variant], SIZE[size], fullWidth ? 'w-full' : '', className].join(' ')}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={iconPx} aria-hidden="true" />
      ) : (
        LeftIcon && <LeftIcon size={iconPx} aria-hidden="true" />
      )}
      {children}
      {!loading && RightIcon && <RightIcon size={iconPx} aria-hidden="true" />}
    </button>
  )
}
