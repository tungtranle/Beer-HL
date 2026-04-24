'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Garage {
  id: string
  name: string
  address: string
  phone: string
  specialties: string[]
  is_preferred: boolean
  is_blacklisted: boolean
  avg_rating: string
  total_repairs: number
  avg_mttr_hours: number
}

export default function GaragesPage() {
  const [garages, setGarages] = useState<Garage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const res = await apiFetch<any>('/fleet/garages')
      setGarages(res.data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = garages.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.address.toLowerCase().includes(search.toLowerCase())
  )

  const bestGarage = garages.length > 0 ? garages.reduce((a, b) => parseFloat(a.avg_rating) >= parseFloat(b.avg_rating) ? a : b) : null
  const preferredCount = garages.filter(g => g.is_preferred).length
  const blacklistCount = garages.filter(g => g.is_blacklisted).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🏭 Quản lý Garage</h1>
        {garages.length > 0 && (
          <div className="flex gap-3 text-sm">
            <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">⭐ {preferredCount} Ưu tiên</span>
            {blacklistCount > 0 && <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full font-medium">🚫 {blacklistCount} Blacklist</span>}
            {bestGarage && <span className="px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full font-medium">🥇 {bestGarage.name} ({parseFloat(bestGarage.avg_rating).toFixed(1)}⭐)</span>}
          </div>
        )}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm garage theo tên, địa chỉ..."
        className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p className="text-gray-400 col-span-3 text-center py-8">Đang tải...</p> :
          filtered.length === 0 ? <p className="text-gray-400 col-span-3 text-center py-8">Không có garage</p> :
          filtered.map(g => (
            <div key={g.id} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{g.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{g.address}</p>
                </div>
                <div className="flex gap-1">
                  {g.is_preferred && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ưu tiên</span>}
                  {g.is_blacklisted && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Blacklist</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-brand-500">{parseFloat(g.avg_rating).toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Đánh giá</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-700">{g.total_repairs}</p>
                  <p className="text-xs text-gray-500">Lần sửa</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-700">{g.avg_mttr_hours.toFixed(0)}h</p>
                  <p className="text-xs text-gray-500">MTTR TB</p>
                </div>
              </div>
              {g.specialties && g.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {g.specialties.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}
