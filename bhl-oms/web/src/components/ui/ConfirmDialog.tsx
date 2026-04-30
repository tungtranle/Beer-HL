'use client'

/**
 * ConfirmDialog — 1-props confirm modal: title + message + onConfirm + danger.
 * Replaces: window.confirm() và các alert modal tự chế.
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 */

import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button + warning icon */
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 py-1">
        <div
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            danger ? 'bg-rose-100 text-rose-600' : 'bg-brand-50 text-brand-600'
          }`}
        >
          {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-sm mb-1">{title}</p>
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  )
}
