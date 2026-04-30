'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface UndoBannerProps {
  message: string
  ttlSeconds?: number
  onUndo?: () => void
}

export function UndoBanner({ message, ttlSeconds = 30, onUndo }: UndoBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm"><strong>Đã ghi nhận.</strong> {message} Có thể hoàn tác trong {ttlSeconds}s.</div>
      <Button variant="secondary" size="sm" leftIcon={RotateCcw} onClick={onUndo}>Hoàn tác</Button>
    </div>
  )
}