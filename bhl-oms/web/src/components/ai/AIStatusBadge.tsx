'use client'

import { Bot, ShieldCheck, ShieldOff } from 'lucide-react'

interface AIStatusBadgeProps {
  enabled: boolean
  label?: string
  route?: 'cloud' | 'local' | 'rules' | 'blocked'
}

export function AIStatusBadge({ enabled, label = 'AI', route = 'rules' }: AIStatusBadgeProps) {
  const Icon = enabled ? ShieldCheck : ShieldOff
  const tone = enabled ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tone}`}>
      {enabled ? <Bot className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      {label} {enabled ? 'ON' : 'OFF'} · {route}
    </span>
  )
}