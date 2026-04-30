'use client'

/**
 * Drawer / SidePanel — panel trượt từ phải (hoặc trái).
 * Dùng cho: chi tiết đơn hàng, form nhập nhanh, filter nâng cao.
 *
 * Reference: BHL_Component_System_Proposal.md §4.3 P1
 *
 * @example
 * <Drawer open={open} onClose={() => setOpen(false)} title="Chi tiết đơn">
 *   <OrderDetailPanel id={orderId} />
 * </Drawer>
 */

import { useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type DrawerSide = 'right' | 'left'
type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Header right slot */
  headerActions?: ReactNode
  footer?: ReactNode
  side?: DrawerSide
  size?: DrawerSize
  /** Click backdrop to close (default: true) */
  closeOnBackdrop?: boolean
  hideClose?: boolean
  children: ReactNode
  className?: string
}

const WIDTH: Record<DrawerSize, string> = {
  sm: 'max-w-xs w-full',
  md: 'max-w-sm w-full',
  lg: 'max-w-md w-full',
  xl: 'max-w-xl w-full',
  full: 'max-w-2xl w-full',
}

const TRANSLATE: Record<DrawerSide, { open: string; closed: string; pos: string }> = {
  right: { open: 'translate-x-0', closed: 'translate-x-full', pos: 'right-0' },
  left:  { open: 'translate-x-0', closed: '-translate-x-full', pos: 'left-0' },
}

export function Drawer({
  open,
  onClose,
  title,
  headerActions,
  footer,
  side = 'right',
  size = 'md',
  closeOnBackdrop = true,
  hideClose = false,
  children,
  className = '',
}: DrawerProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() },
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

  if (typeof document === 'undefined') return null

  const { open: tOpen, closed: tClosed, pos } = TRANSLATE[side]

  const panel = (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={[
          'fixed top-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out',
          WIDTH[size],
          pos,
          open ? tOpen : tClosed,
          className,
        ].join(' ')}
      >
        {/* Header */}
        {(title || headerActions || !hideClose) && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 flex-shrink-0">
            <h2 className="text-base font-semibold text-slate-800 truncate">{title}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerActions}
              {!hideClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-200 bg-slate-50">
            {footer}
          </div>
        )}
      </div>
    </>
  )

  return createPortal(panel, document.body)
}
