'use client'

import { useState, useEffect } from 'react'
import { getUser, clearAuth, apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/useToast'
import {
  ChevronRight, LogOut, Bell, Shield, HelpCircle, Smartphone,
  FileText, Star, Mail, Truck, MapPin,
} from 'lucide-react'

const roleLabels: Record<string, string> = {
  driver: 'Tài xế',
  admin: 'Quản trị viên',
  dispatcher: 'Điều phối viên',
  warehouse: 'Thủ kho',
  accountant: 'Kế toán',
}

interface SettingItem {
  icon: any
  label: string
  hint?: string
  onClick?: () => void
  href?: string
  danger?: boolean
}

export default function DriverProfilePage() {
  const user = getUser()
  const router = useRouter()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [gpsConsent, setGpsConsent] = useState<boolean>(false)
  const [consentSaving, setConsentSaving] = useState(false)

  const [monthlyStats, setMonthlyStats] = useState<{ trips: number; delivered: number; score: number; rank: number; rankTotal: number } | null>(null)

  useEffect(() => {
    if (!user) return
    apiFetch<any>(`/drivers/${user.id}/scorecard`)
      .then((r: any) => {
        const d = r.data
        if (d) setMonthlyStats({ trips: d.history?.[0]?.trips_count || 0, delivered: d.history?.[0]?.otd_score || 0, score: d.current_score || 0, rank: d.rank || 0, rankTotal: d.rank_total || 0 })
      }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) {
    if (typeof window !== 'undefined') router.push('/login')
    return null
  }

  const initials = (user.full_name || '?').split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const handleGpsConsentToggle = async () => {
    const newValue = !gpsConsent
    setConsentSaving(true)
    try {
      await apiFetch('/driver/gps-consent', {
        method: 'POST',
        body: { consent_given: newValue },
      })
      setGpsConsent(newValue)
      toast.success(newValue
        ? 'Đã bật chia sẻ GPS — xếp hạng & điểm thưởng sẽ được tính'
        : 'Đã tắt chia sẻ GPS — dữ liệu vị trí không còn được dùng cho KPI'
      )
    } catch {
      toast.error('Không thể lưu cài đặt — thử lại sau')
    } finally {
      setConsentSaving(false)
    }
  }

  const accountItems: SettingItem[] = [
    { icon: Bell, label: 'Thông báo', hint: 'Bật / tắt push', onClick: () => router.push('/dashboard/notifications') },
    { icon: Shield, label: 'Bảo mật', hint: 'Đổi mật khẩu' },
    { icon: Smartphone, label: 'Thiết bị & GPS', hint: 'Quyền vị trí' },
  ]

  const supportItems: SettingItem[] = [
    { icon: HelpCircle, label: 'Trung tâm trợ giúp', hint: 'Hướng dẫn sử dụng' },
    { icon: FileText, label: 'Điều khoản & chính sách' },
    { icon: Star, label: 'Đánh giá ứng dụng' },
    { icon: Mail, label: 'Liên hệ điều phối', hint: '24/7' },
  ]

  return (
    <div className="space-y-4 pb-4">
      {/* Hero */}
      <div className="-mx-4 -mt-4 px-4 pt-8 pb-20 bg-gradient-to-br from-brand-500 via-orange-500 to-amber-500 text-white relative overflow-hidden rounded-b-[28px]">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute top-12 -left-16 w-40 h-40 rounded-full bg-yellow-300/20 blur-2xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-2xl ring-2 ring-white/30 shadow-xl">
            {initials}
          </div>
          <h1 className="text-xl font-bold mt-3">{user.full_name}</h1>
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium">
            <Truck size={12} />
            {roleLabels[user.role] || user.role}
          </div>
        </div>
      </div>

      {/* Account info card — overlap hero */}
      <div className="-mt-12 bg-white rounded-2xl shadow-[0_4px_16px_-6px_rgba(0,0,0,0.08)] border border-gray-100 p-1">
        <InfoRow label="Tên đăng nhập" value={user.username} />
        <Divider />
        <InfoRow label="Mã nhân viên" value={user.id.slice(0, 8).toUpperCase()} mono />
        <Divider />
        <InfoRow label="Vai trò" value={roleLabels[user.role] || user.role} />
      </div>

      {/* Account section */}
      <SettingSection title="Tài khoản" items={accountItems} />

      {/* Monthly Performance */}
      <section>
        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">Hiệu suất tháng này</h2>
        {monthlyStats ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <div className={`text-2xl font-black tabular-nums ${monthlyStats.score >= 80 ? 'text-green-600' : monthlyStats.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{monthlyStats.score.toFixed(0)}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Điểm KPI</div>
              </div>
              <div className="text-center border-x border-gray-100">
                <div className="text-2xl font-black text-brand-600 tabular-nums">{monthlyStats.trips}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Chuyến</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-blue-600 tabular-nums">#{monthlyStats.rank}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">/{monthlyStats.rankTotal} xếp hạng</div>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${monthlyStats.score >= 80 ? 'bg-green-500' : monthlyStats.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${monthlyStats.score}%` }} />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-center text-xs text-gray-400">Đang tải dữ liệu hiệu suất...</div>
        )}
      </section>

      {/* NĐ13 GPS Consent Section */}
      <section>
        <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">Dữ liệu vị trí GPS</h2>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={17} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight">Dùng GPS tính hiệu suất cá nhân</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">Cho phép hệ thống sử dụng GPS để tính điểm, xếp hạng và phần thưởng cá nhân</p>
              </div>
              <button
                onClick={handleGpsConsentToggle}
                disabled={consentSaving}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                  gpsConsent ? 'bg-brand-500' : 'bg-gray-200'
                } disabled:opacity-50`}
                aria-label="Toggle GPS consent"
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  gpsConsent ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-bold text-blue-700 mb-0.5">Ðiều 13/2023/NĐ-CP — Bảo vệ dữ liệu cá nhân</p>
              <p className="text-[10px] text-blue-600 leading-relaxed">Dữ liệu GPS chỉ dùng để tính KPI cá nhân và xếp hạng đội xe. Bạn có thể rút lại sự đồng ý bất kỳ lúc nào mà không ảnh hưởng đến hợp đồng lao động.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Support section */}
      <SettingSection title="Hỗ trợ" items={supportItems} />

      {/* App info */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-center text-xs text-gray-400 space-y-0.5">
        <p className="font-semibold text-gray-700 text-sm">BHL OMS-TMS-WMS</p>
        <p>Phiên bản 1.0.0-demo</p>
        <p>© 2026 Beer Hạ Long</p>
      </div>

      {/* Logout */}
      <button onClick={() => setShowLogoutConfirm(true)}
        className="w-full h-13 py-3.5 bg-white border border-rose-200 text-rose-600 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-rose-50 active:scale-[0.98] transition shadow-sm">
        <LogOut size={18} />
        Đăng xuất
      </button>

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
              <LogOut size={26} className="text-rose-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900">Xác nhận đăng xuất?</h3>
              <p className="text-sm text-gray-500 mt-1">Bạn sẽ cần đăng nhập lại để sử dụng ứng dụng</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 h-12 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 active:scale-95 transition">
                Hủy
              </button>
              <button onClick={handleLogout}
                className="flex-1 h-12 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 active:scale-95 transition shadow-md shadow-rose-600/30">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingSection({ title, items }: { title: string; items: SettingItem[] }) {
  return (
    <section>
      <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">{title}</h2>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div key={item.label}>
              <button
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition text-left"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.danger ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600'}`}>
                  <Icon size={17} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-tight ${item.danger ? 'text-rose-600' : 'text-gray-900'}`}>{item.label}</p>
                  {item.hint && <p className="text-[11px] text-gray-500 mt-0.5">{item.hint}</p>}
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
              {i < items.length - 1 && <div className="h-px bg-gray-100 ml-16" />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-gray-100 mx-4" />
}
