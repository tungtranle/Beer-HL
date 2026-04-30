'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, ShieldAlert } from 'lucide-react'
import { getToken, getUser } from '@/lib/api'
import AQFCommandCenter from './aqf-command-center'
import DemoScenarioPanel from './demo-scenario-panel'

export default function TestPortalPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    const user = getUser()
    setRole(user?.role || null)
    setAllowed(Boolean(token && user && ['admin', 'management'].includes(user.role)))
    setReady(true)
  }, [])

  if (!ready) {
    return <div className="min-h-screen bg-slate-50 grid place-items-center text-sm text-slate-500">Đang kiểm tra quyền truy cập...</div>
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 text-amber-700 grid place-items-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Test Portal cần đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-600">
            Chỉ tài khoản <code className="font-mono">admin</code> hoặc <code className="font-mono">management</code> được vào khu vực demo/QA.
            Tài khoản demo khách hàng: <code className="font-mono">qa.demo</code> / <code className="font-mono">demo123</code>.
          </p>
          {role && <p className="mt-2 text-xs text-slate-500">Role hiện tại: {role}</p>}
          <button
            type="button"
            onClick={() => router.push('/login?next=/test-portal')}
            className="mt-5 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600"
          >
            <LogIn className="h-4 w-4" /> Đăng nhập Test Portal
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <DemoScenarioPanel />
        <AQFCommandCenter />
      </div>
    </main>
  )
}
