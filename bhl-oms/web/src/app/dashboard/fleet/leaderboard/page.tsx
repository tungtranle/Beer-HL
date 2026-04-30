'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface LeaderboardEntry {
  rank: number
  driver_id: string
  driver_name: string
  avg_score: number
  total_trips: number
  badge_count: number
}

const _medalEmoji = (rank: number) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  const load = async () => {
    try {
      setLoading(true)
      const res = await apiFetch<any>(`/drivers/leaderboard?period=${period}&limit=30`)
      setEntries(res.data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [period])

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)
  const maxScore = entries.length > 0 ? Math.max(...entries.map(e => e.avg_score)) : 100

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900"> Bảng xếp hạng Tài xế</h1>
        <div className="flex gap-2">
          {[{ key: 'week', label: 'Tuần' }, { key: 'month', label: 'Tháng' }, { key: 'quarter', label: 'Quý' }].map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${period === p.key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl"/>)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-2"></div>
          <p>Chưa có dữ liệu xếp hạng</p>
        </div>
      ) : (
        <>
          {/* Podium for top 3 */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-4 mb-6">
              {/* 2nd place */}
              {top3[1] && (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-3xl">🥈</div>
                  <div className="text-sm font-semibold text-gray-700 text-center max-w-[80px] truncate">{top3[1].driver_name}</div>
                  <div className="bg-gray-200 rounded-t-lg w-20 flex items-center justify-center py-2 h-20">
                    <span className="text-lg font-bold text-gray-700">{top3[1].avg_score.toFixed(1)}</span>
                  </div>
                </div>
              )}
              {/* 1st place */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-4xl">🥇</div>
                <div className="text-sm font-bold text-gray-900 text-center max-w-[80px] truncate">{top3[0].driver_name}</div>
                <div className="bg-yellow-400 rounded-t-lg w-24 flex items-center justify-center py-2 h-28">
                  <span className="text-xl font-black text-white">{top3[0].avg_score.toFixed(1)}</span>
                </div>
              </div>
              {/* 3rd place */}
              {top3[2] && (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-3xl">🥉</div>
                  <div className="text-sm font-semibold text-gray-700 text-center max-w-[80px] truncate">{top3[2].driver_name}</div>
                  <div className="bg-orange-200 rounded-t-lg w-20 flex items-center justify-center py-2 h-16">
                    <span className="text-lg font-bold text-orange-700">{top3[2].avg_score.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rest of ranking with score bars */}
          {rest.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border divide-y">
              {rest.map(e => (
                <div key={e.driver_id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition">
                  <span className="w-8 text-center text-sm font-bold text-gray-500">#{e.rank}</span>
                  <span className="w-36 font-medium text-gray-800 truncate">{e.driver_name}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(e.avg_score / maxScore) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-brand-600 tabular-nums w-10 text-right">{e.avg_score.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right">{e.total_trips} chuyến</span>
                  {e.badge_count > 0 && <span className="text-xs">🏅 {e.badge_count}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
