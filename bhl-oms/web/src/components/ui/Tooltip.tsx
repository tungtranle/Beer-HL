'use client'

/**
 * Tooltip — hover tooltip cho icon buttons, shortened text, etc.
 * Pure CSS + state approach — no external dependency.
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 *
 * Usage:
 *   <Tooltip content="Sao chép mã đơn">
 *     <Button variant="ghost" size="sm"><Copy size={14} /></Button>
 *   </Tooltip>
 */

import { useState, useRef, type ReactNode, type ReactElement, cloneElement } from 'react'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  children: ReactElement
  side?: TooltipSide
  delay?: number
  className?: string
}

const SIDE_CLASSES: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

const ARROW_CLASSES: Record<TooltipSide, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent',
}

export function Tooltip({ content, children, side = 'top', delay = 0, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (delay > 0) {
      timerRef.current = setTimeout(() => setVisible(true), delay)
    } else {
      setVisible(true)
    }
  }

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  return (
    <span className="relative inline-flex">
      {cloneElement(children, {
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-slate-800 rounded-md whitespace-nowrap pointer-events-none ${SIDE_CLASSES[side]} ${className}`}
        >
          {content}
          {/* Arrow */}
          <span
            className={`absolute w-0 h-0 border-4 ${ARROW_CLASSES[side]}`}
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  )
}
