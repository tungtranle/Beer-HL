'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface RolePermission {
  id: string
  role: string
  resource: string
  action: string
  allowed: boolean
}

const ROLES = ['admin', 'dispatcher', 'dvkh', 'accountant', 'driver', 'warehouse', 'security', 'management', 'workshop'] as const

const roleLabels: Record<string, string> = {
  admin: 'Admin', dispatcher: 'Điều phối', dvkh: 'DVKH',
  accountant: 'Kế toán', driver: 'Tài xế', warehouse: 'Thủ kho',
  security: 'Bảo vệ', management: 'BGĐ', workshop: 'Phân xưởng',
}

const RESOURCES = [
  'orders', 'trips', 'warehouse', 'customers', 'products', 'vehicles',
  'drivers', 'reconciliation', 'kpi', 'admin', 'notifications', 'planning',
] as const

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const

const actionLabels: Record<string, string> = {
  view: 'Xem', create: 'Tạo', edit: 'Sửa',
  delete: 'Xóa', approve: 'Duyệt', export: 'Xuất',
}

export default function PermissionsPage() {
  const router = useRouter()
  const user = getUser()
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('dispatcher')
  const [filterResource, setFilterResource] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    loadPermissions()
  }, [])

  const loadPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/admin/permissions')
      setPermissions(res.data || [])
    } catch (err: any) {
      toast.error('Lỗi tải danh sách quyền: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const isAllowed = (role: string, resource: string, action: string): boolean => {
    if (role === 'admin') return true
    const p = permissions.find(p => p.role === role && p.resource === resource && p.action === action)
    return p?.allowed ?? false
  }

  const handleToggle = async (role: string, resource: string, action: string) => {
    if (role === 'admin') return // admin always has all permissions
    const key = `${role}:${resource}:${action}`
    setSaving(key)
    const currentValue = isAllowed(role, resource, action)
    try {
      await apiFetch('/admin/permissions', {
        method: 'PUT',
        body: { role, resource, action, allowed: !currentValue },
      })
      // Optimistic update
      setPermissions(prev => {
        const idx = prev.findIndex(p => p.role === role && p.resource === resource && p.action === action)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], allowed: !currentValue }
          return updated
        }
        return [...prev, { id: '', role, resource, action, allowed: !currentValue }]
      })
      toast.success(`Đã ${!currentValue ? 'cấp' : 'thu hồi'} quyền ${actionLabels[action]} ${resource} cho ${roleLabels[role]}`)
    } catch (err: any) {
      toast.error('Lỗi cập nhật quyền: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  const resourcesFiltered = filterResource
    ? RESOURCES.filter(r => r.includes(filterResource.toLowerCase()))
    : RESOURCES

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#F68634] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🔐 Ma trận phân quyền</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý quyền truy cập theo vai trò — thay đổi có hiệu lực ngay</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/settings')}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          ← Quay lại
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {ROLES.map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedRole === role
                ? 'bg-[#F68634] text-white shadow-sm'
                : role === 'admin'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {roleLabels[role]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Lọc theo tài nguyên..."
          value={filterResource}
          onChange={e => setFilterResource(e.target.value)}
          className="w-64 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F68634]/30 focus:border-[#F68634] outline-none"
        />
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-40">Tài nguyên</th>
                {ACTIONS.map(action => (
                  <th key={action} className="text-center px-3 py-3 font-semibold text-gray-700 w-24">
                    {actionLabels[action]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resourcesFiltered.map((resource, ri) => (
                <tr key={resource} className={`border-b border-gray-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800 capitalize">{resource}</span>
                  </td>
                  {ACTIONS.map(action => {
                    const allowed = isAllowed(selectedRole, resource, action)
                    const isAdmin = selectedRole === 'admin'
                    const key = `${selectedRole}:${resource}:${action}`
                    const isSaving = saving === key
                    return (
                      <td key={action} className="text-center px-3 py-3">
                        <button
                          onClick={() => handleToggle(selectedRole, resource, action)}
                          disabled={isAdmin || isSaving}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition ${
                            isAdmin
                              ? 'bg-green-100 text-green-600 cursor-not-allowed'
                              : allowed
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          } ${isSaving ? 'opacity-50' : ''}`}
                          title={isAdmin ? 'Admin có toàn quyền' : allowed ? 'Đang cho phép — nhấn để thu hồi' : 'Đang từ chối — nhấn để cấp quyền'}
                        >
                          {isSaving ? (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-[#F68634] rounded-full animate-spin" />
                          ) : allowed ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-green-100 flex items-center justify-center">
            <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          Cho phép
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center">
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          Từ chối
        </div>
        <span className="text-gray-400">• Admin luôn có toàn quyền</span>
        <span className="text-gray-400">• Thay đổi có hiệu lực ngay (cache 5 phút)</span>
      </div>
    </div>
  )
}
