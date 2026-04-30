'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { handleError } from '@/lib/handleError'
import { useRouter } from 'next/navigation'
import { PageHeader, Button } from '@/components/ui'
import { Factory, Package, Sparkles, AlertTriangle, CheckCircle2, Search } from 'lucide-react'

interface BottleClassification {
  id: string; trip_id: string; trip_number: string
  product_id: string; product_name: string
  bottles_sent: number; bottles_returned_good: number
  bottles_returned_damaged: number; bottles_missing: number
  notes: string; classified_at: string
}

interface BottleSummary {
  total_sent: number; total_returned_good: number
  total_returned_damaged: number; total_missing: number
  trips_processed: number
}

interface Trip {
  id: string; trip_number: string; vehicle_plate: string
  driver_name: string; status: string
}

// F9: Production Planning Feed (BHL WorldClass Strategy)
interface SkuForecast {
  sku_id: string
  sku_name: string
  predicted_qty: number
  unit: string
  vs_last_week_pct: number | null
  safety_stock_alert: boolean
  priority_score: number
}

interface ProductionPlan {
  forecast_as_of: string
  forecast_week: string
  warehouse_name: string
  sku_forecast: SkuForecast[]
  max_qty: number
  alert_count: number
}

export default function WorkshopPage() {
  const router = useRouter()
  const user = getUser()
  const [activeTab, setActiveTab] = useState<'classify' | 'planning'>('classify')
  const [summary, setSummary] = useState<BottleSummary | null>(null)
  const [tripSearch, setTripSearch] = useState('')
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [classifications, setClassifications] = useState<BottleClassification[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [planningData, setPlanningData] = useState<ProductionPlan | null>(null)
  const [planningLoading, setPlanningLoading] = useState(false)

  // Form
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [sent, setSent] = useState(0)
  const [returnedGood, setReturnedGood] = useState(0)
  const [returnedDmg, setReturnedDmg] = useState(0)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!user || !['admin', 'warehouse', 'workshop'].includes(user.role)) {
      router.replace('/dashboard')
      return
    }
    apiFetch<any>('/warehouse/bottles/summary')
      .then(r => setSummary(r.data))
      .catch(err => handleError(err))
      .finally(() => setLoading(false))
    // F9: Load production planning feed (graceful fail — available after AI Demand module)
    setPlanningLoading(true)
    apiFetch<any>('/workshop/production-plan')
      .then(r => setPlanningData(r.data))
      .catch(() => {})
      .finally(() => setPlanningLoading(false))
  }, [])

  const searchTrip = async () => {
    if (!tripSearch.trim()) return
    try {
      const res: any = await apiFetch(`/trips?search=${encodeURIComponent(tripSearch.trim())}`)
      const trips = res.data || []
      if (trips.length > 0) {
        setSelectedTrip(trips[0])
        const bc: any = await apiFetch(`/warehouse/bottles/trip/${trips[0].id}`)
        setClassifications(bc.data || [])
      } else {
        toast.warning('Không tìm thấy chuyến xe')
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  const handleClassify = async () => {
    if (!selectedTrip || !productId) return
    setSubmitting(true)
    try {
      await apiFetch('/warehouse/bottles/classify', {
        method: 'POST',
        body: {
          trip_id: selectedTrip.id,
          trip_number: selectedTrip.trip_number,
          product_id: productId,
          product_name: productName,
          bottles_sent: sent,
          bottles_returned_good: returnedGood,
          bottles_returned_damaged: returnedDmg,
          notes,
        },
      })
      // Reload
      const bc: any = await apiFetch(`/warehouse/bottles/trip/${selectedTrip.id}`)
      setClassifications(bc.data || [])
      const sm: any = await apiFetch('/warehouse/bottles/summary')
      setSummary(sm.data)
      // Reset form
      setProductId(''); setProductName(''); setSent(0); setReturnedGood(0); setReturnedDmg(0); setNotes('')
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Tab navigation */}
      <div className="flex items-center justify-between mb-6">
      <PageHeader
        title="Phân xưởng"
        subtitle="Phân loại vỏ chai & Kế hoạch sản xuất"
        icon={Factory}
        iconTone="neutral"
      />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('classify')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5 ${
              activeTab === 'classify' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="w-3.5 h-3.5" aria-hidden="true" /> Phân loại vỏ
          </button>
          <button
            onClick={() => setActiveTab('planning')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              activeTab === 'planning' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Kế hoạch SX
            {planningData?.alert_count ? (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{planningData.alert_count}</span>
            ) : (
              <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded">AI</span>
            )}
          </button>
        </div>
      </div>

      {/* Tab: Classify (existing) */}
      {activeTab === 'classify' && (
        <div className="space-y-6">
        {summary && (
        <>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 mb-1">Vỏ xuất</div>
            <div className="text-2xl font-bold text-blue-700">{summary.total_sent.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-500 mb-1">Thu hồi tốt</div>
            <div className="text-2xl font-bold text-green-700">{summary.total_returned_good.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
            <div className="text-xs text-gray-500 mb-1">Hư hỏng</div>
            <div className="text-2xl font-bold text-amber-700">{summary.total_returned_damaged.toLocaleString()}</div>
          </div>
          <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500 ${summary.total_missing > 0 ? 'animate-pulse' : ''}`}>
            <div className="text-xs text-gray-500 mb-1">Thiếu/mất</div>
            <div className="text-2xl font-bold text-red-700">{summary.total_missing.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400">
            <div className="text-xs text-gray-500 mb-1">Chuyến đã xử lý</div>
            <div className="text-2xl font-bold text-gray-700">{summary.trips_processed}</div>
          </div>
        </div>
        {/* Recovery rate bar */}
        {summary.total_sent > 0 && (() => {
          const recoveryRate = Math.round(((summary.total_returned_good + summary.total_returned_damaged) / summary.total_sent) * 100)
          const goodPct = Math.round((summary.total_returned_good / summary.total_sent) * 100)
          const dmgPct = Math.round((summary.total_returned_damaged / summary.total_sent) * 100)
          return (
            <div className="bg-white rounded-xl shadow-sm p-4 border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Tỷ lệ thu hồi vỏ</span>
                <span className={`text-sm font-bold ${recoveryRate >= 90 ? 'text-green-600' : recoveryRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{recoveryRate}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-green-500 h-full transition-all" style={{ width: `${goodPct}%` }} />
                <div className="bg-amber-400 h-full transition-all" style={{ width: `${dmgPct}%` }} />
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Tốt {goodPct}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Hỏng {dmgPct}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Thiếu {100 - goodPct - dmgPct}%</span>
              </div>
            </div>
          )
        })()}
        </>
        )}

      {/* Search trip */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Tìm chuyến xe</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={tripSearch}
            onChange={e => setTripSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchTrip()}
            placeholder="Nhập mã chuyến (VD: TR-20260316-001)"
            className="flex-1 px-4 py-2 border rounded-lg text-sm"
          />
          <button onClick={searchTrip} className="px-6 py-2 bg-[#F68634] text-white rounded-lg hover:bg-[#e5752a] transition text-sm inline-flex items-center gap-1.5">
            <Search className="w-4 h-4" aria-hidden="true" /> Tìm
          </button>
        </div>
      </div>

      {/* Trip detail + classify form */}
      {selectedTrip && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-700">Chuyến: {selectedTrip.trip_number}</h2>
              <p className="text-sm text-gray-500">{selectedTrip.vehicle_plate} — {selectedTrip.driver_name}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">{selectedTrip.status}</span>
          </div>

          {/* Existing classifications */}
          {classifications.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Đã phân loại:</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3">Sản phẩm</th>
                    <th className="text-right py-2 px-3">Xuất</th>
                    <th className="text-right py-2 px-3">Tốt</th>
                    <th className="text-right py-2 px-3">Hỏng</th>
                    <th className="text-right py-2 px-3">Thiếu</th>
                    <th className="text-left py-2 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {classifications.map(bc => (
                    <tr key={bc.id} className="border-t">
                      <td className="py-2 px-3">{bc.product_name}</td>
                      <td className="py-2 px-3 text-right">{bc.bottles_sent}</td>
                      <td className="py-2 px-3 text-right text-green-600">{bc.bottles_returned_good}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{bc.bottles_returned_damaged}</td>
                      <td className={`py-2 px-3 text-right font-medium ${bc.bottles_missing > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {bc.bottles_missing}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">{bc.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add new classification */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Thêm phân loại:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500">Mã SP</label>
                <input type="text" value={productId} onChange={e => setProductId(e.target.value)}
                  placeholder="UUID sản phẩm" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Tên SP</label>
                <input type="text" value={productName} onChange={e => setProductName(e.target.value)}
                  placeholder="Bia Heineken 330ml" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vỏ xuất</label>
                <input type="number" value={sent} onChange={e => setSent(+e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vỏ thu tốt</label>
                <input type="number" value={returnedGood} onChange={e => setReturnedGood(+e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vỏ hư hỏng</label>
                <input type="number" value={returnedDmg} onChange={e => setReturnedDmg(+e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Ghi chú</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ghi chú..." className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                Thiếu: <strong className={sent - returnedGood - returnedDmg > 0 ? 'text-red-600' : 'text-green-600'}>
                  {Math.max(0, sent - returnedGood - returnedDmg)}
                </strong>
              </div>
              <button
                onClick={handleClassify}
                disabled={!productId || submitting}
                className="ml-auto px-6 py-2 bg-[#F68634] text-white rounded-lg hover:bg-[#e5752a] transition text-sm disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : 'Phân loại'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}

      {/* Tab: F9 Production Planning Feed */}
      {activeTab === 'planning' && (
        <div className="space-y-5">
          {planningLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full" />
            </div>
          ) : planningData ? (
            <>
              {/* Header info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-blue-800">Kế hoạch sản xuất — {planningData.forecast_week}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Kho: {planningData.warehouse_name} · Cập nhật: {planningData.forecast_as_of}</p>
                </div>
                {planningData.alert_count > 0 && (
                  <div className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> {planningData.alert_count} cảnh báo tồn kho
                  </div>
                )}
              </div>

              {/* SKU forecast list */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">Dự báo nhu cầu theo SKU (7 ngày tới)</h3>
                  <span className="text-xs text-gray-400">{planningData.sku_forecast.length} SKUs</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {planningData.sku_forecast
                    .sort((a, b) => b.priority_score - a.priority_score)
                    .map((sku) => (
                      <div key={sku.sku_id} className="px-4 py-3 flex items-center gap-4">
                        {/* Priority badge */}
                        {sku.safety_stock_alert && (
                          <span className="shrink-0 text-[10px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" /> Ư u tiên</span>
                        )}
                        {/* SKU name + bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-800 truncate pr-2">{sku.sku_name}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-sm font-bold text-blue-700">{sku.predicted_qty.toLocaleString()}</span>
                              <span className="text-xs text-gray-400">{sku.unit}</span>
                              {sku.vs_last_week_pct !== null && (
                                <span className={`text-[10px] font-semibold px-1 rounded ${
                                  sku.vs_last_week_pct > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
                                }`}>
                                  {sku.vs_last_week_pct > 0 ? '↑' : '↓'}{Math.abs(sku.vs_last_week_pct)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                sku.safety_stock_alert ? 'bg-red-400' : 'bg-blue-400'
                              }`}
                              style={{ width: `${Math.min(100, planningData.max_qty > 0 ? (sku.predicted_qty / planningData.max_qty) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center">Dự báo từ AI Demand Model · Hiểu chỉnh theo mùa vụ (Prophet + Croston)</p>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔮</div>
              <p className="text-base font-semibold text-gray-700">Tính năng đang phát triển</p>
              <p className="text-sm text-gray-400 mt-2">Kế hoạch sản xuất từ AI Demand Forecast sẽ hiển thị ở đây sau khi module khởi động</p>
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5 max-w-sm mx-auto text-left">
                <p className="text-xs font-bold text-blue-700 mb-3">Khi hoàn thiện sẽ hiển thị:</p>
                <ul className="text-xs text-blue-600 space-y-2">
                  <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span>Dự báo nhu cầu 7 ngày tới theo SKU (Prophet cho 21 SKU core, Croston cho SKU Tết)</li>
                  <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span>Cảnh báo tồn kho dưới ngưỡng an toàn</li>
                  <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span>Thứ tự ưu tiên sản xuất theo mức độ khan hiếm</li>
                  <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span>So sánh dự báo vs đơn thực tế (feedback loop)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
