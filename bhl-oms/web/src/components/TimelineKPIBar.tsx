'use client'

/**
 * TimelineKPIBar — §23 UX Spec v5
 * 4 thẻ KPI ở đầu timeline, đọc trong 3 giây.
 */

interface TimelineKPIProps {
  createdAt: string
  deliveredAt?: string
  tripInfo?: string
  reconStatus?: string
}

function formatDuration(ms: number): string {
  if (ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} phút`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  if (hours < 24) return remainMins > 0 ? `${hours}g ${remainMins}p` : `${hours} giờ`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  return remainHours > 0 ? `${days}d ${remainHours}g` : `${days} ngày`
}

export function TimelineKPIBar({ createdAt, deliveredAt, tripInfo, reconStatus }: TimelineKPIProps) {
  const processingTime = deliveredAt
    ? formatDuration(new Date(deliveredAt).getTime() - new Date(createdAt).getTime())
    : 'Đang xử lý'

  // Check if order was created before 16:00 cutoff
  const created = new Date(createdAt)
  const cutoffHour = 16
  const isOnTime = created.getHours() < cutoffHour

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 uppercase tracking-wider">Thời gian xử lý</div>
        <div className={`font-bold text-sm mt-0.5 ${deliveredAt ? 'text-gray-800' : 'text-amber-600'}`}>
          {processingTime}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 uppercase tracking-wider">Cutoff</div>
        <div className={`font-bold text-sm mt-0.5 ${isOnTime ? 'text-green-600' : 'text-gray-500'}`}>
          {isOnTime ? 'Trước 16h ✓' : 'T+1'}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 uppercase tracking-wider">Chuyến xe</div>
        <div className="font-medium text-sm mt-0.5 text-gray-700 truncate">
          {tripInfo || 'Chưa xếp'}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-[11px] text-gray-500 uppercase tracking-wider">Đối soát</div>
        <div className={`font-bold text-sm mt-0.5 ${
          reconStatus?.includes('Khớp') ? 'text-green-600' :
          reconStatus?.includes('Lệch') ? 'text-red-600' : 'text-gray-500'
        }`}>
          {reconStatus || 'Chưa đối soát'}
        </div>
      </div>
    </div>
  )
}
