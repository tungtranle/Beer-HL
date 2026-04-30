'use client'

/**
 * Modal — overlay + Esc close + backdrop click + scroll lock.
 * Uses createPortal to render in document.body — avoids z-index hell.
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 * Replaces: 22 file dùng `fixed inset-0` ad-hoc
 */

import { useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Right-aligned header actions */
  headerActions?: ReactNode
  footer?: ReactNode
  size?: ModalSize
  /** Click backdrop to close (default: true) */
  closeOnBackdrop?: boolean
  /** Hide the × button */
  hideClose?: boolean
  children: ReactNode
  className?: string
}

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[95vw] w-full',
}

export function Modal({
  open,
  onClose,
  title,
  headerActions,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  hideClose = false,
  children,
  className = '',
}: ModalProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, handleKey])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`relative z-10 w-full ${SIZE[size]} bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/70 flex flex-col max-h-[90vh] ${className}`}
      >
        {/* Header */}
        {(title || !hideClose) && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
            {title ? (
              <h2 className="text-base font-semibold text-slate-900 leading-tight">{title}</h2>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {headerActions}
              {!hideClose && (
                <button
                  onClick={onClose}
                  aria-label="Đóng"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
