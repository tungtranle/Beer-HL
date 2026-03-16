'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getUser, clearAuth } from '@/lib/api'
import { useRouter } from 'next/navigation'

const roleLabels: Record<string, string> = {
  driver: 'Tài xế',
  admin: 'Quản trị viên',
  dispatcher: 'Điều phối viên',
  warehouse: 'Thủ kho',
  accountant: 'Kế toán',
}

export default function DriverProfilePage() {
  const user = getUser()
  const router = useRouter()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/driver" className="text-2xl">←</Link>
        <h1 className="text-xl font-bold">Thông tin cá nhân</h1>
      </div>

      {/* Avatar & Name */}
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-3xl mx-auto mb-3">
          👤
        </div>
        <h2 className="text-xl font-bold text-gray-900">{user.full_name}</h2>
        <span className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
          {roleLabels[user.role] || user.role}
        </span>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 className="font-semibold text-gray-700">Thông tin tài khoản</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Tên đăng nhập</span>
            <span className="font-medium">{user.username}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Họ và tên</span>
            <span className="font-medium">{user.full_name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Vai trò</span>
            <span className="font-medium">{roleLabels[user.role] || user.role}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Mã nhân viên</span>
            <span className="font-medium text-gray-400">{user.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <h3 className="font-semibold text-gray-700">Thông tin ứng dụng</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Phiên bản</span>
            <span className="font-medium">1.0.0-demo</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Hệ thống</span>
            <span className="font-medium">BHL OMS-TMS-WMS</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button onClick={() => setShowLogoutConfirm(true)}
        className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition">
        🚪 Đăng xuất
      </button>

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 space-y-4">
            <h3 className="text-lg font-bold text-center">Xác nhận đăng xuất?</h3>
            <p className="text-sm text-gray-500 text-center">Bạn sẽ cần đăng nhập lại để sử dụng ứng dụng</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                Hủy
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
