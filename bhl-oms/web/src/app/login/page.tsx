'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, setAuth } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res: any = await apiFetch('/auth/login', {
        method: 'POST',
        body: { username, password },
      })

      setAuth(res.data.tokens.access_token, res.data.user, res.data.tokens.refresh_token)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-amber-700">🍺 BHL</h1>
            <p className="text-gray-500 mt-2">Hệ thống OMS-TMS-WMS</p>
            <p className="text-sm text-gray-400">Công ty CP Bia và NGK Hạ Long</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                placeholder="Nhập tên đăng nhập"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                placeholder="Nhập mật khẩu"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 font-medium mb-2">Demo accounts:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p><span className="font-mono bg-gray-200 px-1 rounded">dvkh01</span> — Dịch vụ khách hàng</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">dispatcher01</span> — Điều phối viên</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">driver01</span> — Tài xế</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">accountant01</span> — Kế toán</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">admin</span> — Quản trị</p>
              <p className="text-gray-400 mt-1">Mật khẩu: demo123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
