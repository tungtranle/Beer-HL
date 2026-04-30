'use client'

/**
 * Login — world-class first impression.
 *
 * UX features:
 *  - Two-pane layout (brand story left / form right) on desktop
 *  - Single-card centered on mobile
 *  - Username/password with leading icons + show-password toggle
 *  - Caps-lock detector (subtle warning)
 *  - Remember me checkbox (session persistence hint)
 *  - Inline error with icon + retry hint
 *  - Loading button state with spinner
 *  - Demo accounts hint (collapsed) for staging
 *
 * Reference: UX_AUDIT_REPORT.md §2 (Login redesign)
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, User, Lock, AlertCircle, ShieldCheck, Truck, Boxes, Beer, ChevronDown } from 'lucide-react'
import { apiFetch, setAuth } from '@/lib/api'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [capsOn, setCapsOn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Pre-fill remembered username
  useEffect(() => {
    const last = typeof window !== 'undefined' ? localStorage.getItem('bhl_last_user') : null
    if (last) setUsername(last)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res: any = await apiFetch('/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password },
      })
      setAuth(res.data.tokens.access_token, res.data.user, res.data.tokens.refresh_token)
      if (remember) localStorage.setItem('bhl_last_user', username.trim())
      else localStorage.removeItem('bhl_last_user')
      const next = new URLSearchParams(window.location.search).get('next')
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard')
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại — kiểm tra lại tên đăng nhập và mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  const onPwKey = (e: React.KeyboardEvent) => {
    if (typeof e.getModifierState === 'function') setCapsOn(e.getModifierState('CapsLock'))
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand pane (desktop only) */}
      <aside className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-brand-600 via-brand-500 to-amber-500 text-white p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute bottom-0 -left-10 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" aria-hidden />

        <div className="relative">
          <div className="inline-flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
              <Beer className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Bia Hạ Long</p>
              <p className="text-lg font-bold">BHL OMS · TMS · WMS</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight">
              Vận hành thông minh<br />từ kho đến từng NPP.
            </h2>
            <p className="mt-4 text-white/85 text-base max-w-md">
              Một nền tảng — quản lý đơn hàng, lập kế hoạch giao hàng tối ưu chi phí,
              kiểm soát kho FEFO, đối soát T+1.
            </p>
          </div>

          <ul className="space-y-3">
            {[
              { icon: Truck, label: 'VRP tối ưu chi phí cầu đường + nhiên liệu' },
              { icon: Boxes, label: 'WMS FEFO + đối chiếu lô-date theo HSD' },
              { icon: ShieldCheck, label: 'GPS anomaly + cảnh báo lệch tuyến realtime' },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/90">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20 shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">
          © {new Date().getFullYear()} Công ty CP Bia và NGK Hạ Long
        </p>
      </aside>

      {/* Right form pane */}
      <main className="flex flex-1 items-center justify-center p-6 bg-slate-50 lg:bg-white">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-amber-500 text-white shadow-lg shadow-brand-500/30">
              <Beer className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-600 font-semibold">Bia Hạ Long</p>
              <p className="text-lg font-bold text-slate-900">OMS · TMS · WMS</p>
            </div>
          </div>

          <div className="lg:bg-white lg:rounded-2xl lg:shadow-xl lg:ring-1 lg:ring-slate-200/70 lg:p-8 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/70 p-8">
            <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
            <p className="text-sm text-slate-500 mt-1">Sử dụng tài khoản nội bộ được cấp</p>

            <form onSubmit={handleSubmit} className="space-y-4 mt-7">
              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoFocus={!username}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                    placeholder="Ví dụ: dispatcher01"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus={!!username}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={onPwKey}
                    onKeyDown={onPwKey}
                    className="w-full h-11 pl-10 pr-11 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                    placeholder="Nhập mật khẩu"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"
                    aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {capsOn && (
                  <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Đang bật Caps Lock
                  </p>
                )}
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                  />
                  Ghi nhớ tên đăng nhập
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelp((v) => !v)}
                  className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div role="alert" className="flex gap-2 items-start bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm px-3 py-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" loading={loading} fullWidth size="lg">
                {loading ? 'Đang xác thực...' : 'Đăng nhập'}
              </Button>
            </form>

            {/* Help collapsible */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="w-full flex items-center justify-between text-sm font-medium text-slate-700 hover:text-slate-900"
                aria-expanded={showHelp}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  Cần hỗ trợ đăng nhập?
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition ${showHelp ? 'rotate-180' : ''}`} />
              </button>
              {showHelp && (
                <div className="mt-3 text-xs text-slate-500 space-y-1.5 leading-relaxed">
                  <p>• Liên hệ <strong className="text-slate-700">quản trị hệ thống</strong> để được cấp tài khoản và phân quyền phù hợp với nghiệp vụ.</p>
                  <p>• Mật khẩu bị khoá sau 5 lần sai liên tiếp — vui lòng chờ 15 phút hoặc nhờ admin reset.</p>
                  <p>• Hỗ trợ kỹ thuật: <strong className="text-slate-700">it@bialongdaily.vn</strong></p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile footer */}
          <p className="lg:hidden text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} Công ty CP Bia và NGK Hạ Long
          </p>
        </div>
      </main>
    </div>
  )
}
