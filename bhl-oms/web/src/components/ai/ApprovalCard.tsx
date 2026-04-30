'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExplainabilityPopover } from './ExplainabilityPopover'

interface ApprovalCardProps {
  title: string
  detail: string
  confidence?: number
  reasons?: string[]
  onApprove?: () => void
  onReject?: () => void
  disabled?: boolean
}

export function ApprovalCard({ title, detail, confidence, reasons = [], onApprove, onReject, disabled }: ApprovalCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{detail}</p>
          <div className="mt-2"><ExplainabilityPopover confidence={confidence} reasons={reasons} source="approval" /></div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="success" size="sm" leftIcon={CheckCircle2} onClick={onApprove} disabled={disabled}>Duyệt</Button>
          <Button variant="secondary" size="sm" leftIcon={XCircle} onClick={onReject} disabled={disabled}>Từ chối</Button>
        </div>
      </div>
    </div>
  )
}