'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { handleError } from '@/lib/handleError'
import { useRouter } from 'next/navigation'

interface UserItem {
  id: string; username: string; full_name: string; email: string | null
  role: string; is_active: boolean; warehouse_ids: string[]; created_at: string
}

interface RoleItem {
  code: string; name: string; description: string
}

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên', dvkh: 'Dịch vụ KH', dispatcher: 'Điều phối viên',
  accountant: 'Kế toán', driver: 'Tài xế', warehouse: 'Thủ kho',
  security: 'Bảo vệ', management: 'Ban giám đốc',
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700', dvkh: 'bg-blue-100 text-blue-700',
  dispatcher: 'bg-amber-100 text-amber-700', accountant: 'bg-green-100 text-green-700',
  driver: 'bg-purple-100 text-purple-700', warehouse: 'bg-indigo-100 text-indigo-700',
  security: 'bg-gray-100 text-gray-700', management: 'bg-teal-100 text-teal-700',
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const user = getUser()
  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'users' | 'roles' | 'sessions' | 'seasonal'>('users')
  const [seasonalMode, setSeasonalMode] = useState<{ enabled: boolean; label: string; vrp_buffer_pct: number } | null>(null)
  const [seasonalSaving, setSeasonalSaving] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [search, setSearch] = useState('')

  // Create/Edit user modal
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role: 'dvkh', email: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetUserId, setResetUserId] = useState('')
  const [resetUserName, setResetUserName] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Sessions
  interface SessionItem {
    id: string; user_id: string; user_name: string; role: string
    ip_address: string; user_agent: string; last_active: string; created_at: string
  }
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const loadSeasonalMode = async () => {
    try {
      const res: any = await apiFetch('/admin/seasonal-mode')
      setSeasonalMode(res.data || { enabled: false, label: 'Tết Nguyên Đán', vrp_buffer_pct: 20 })
    } catch { setSeasonalMode({ enabled: false, label: 'Tết Nguyên Đán', vrp_buffer_pct: 20 }) }
  }

  const handleSaveSeasonalMode = async () => {
    if (!seasonalMode) return
    setSeasonalSaving(true)
    try {
      await apiFetch('/admin/seasonal-mode', { method: 'PUT', body: seasonalMode })
      toast.success(seasonalMode.enabled ? 'Đã bật Chế độ mùa vụ' : 'Đã tắt Chế độ mùa vụ')
    } catch { toast.error('Không lưu được cài đặt mùa vụ') }
    finally { setSeasonalSaving(false) }
  }

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, rolesRes]: any[] = await Promise.all([
        apiFetch('/admin/users'),
        apiFetch('/admin/roles'),
      ])
      setUsers(usersRes.data || [])
      setRoles(rolesRes.data || [])
    } catch (err) { handleError(err, { userMessage: 'Không tải được danh sách user/role' }) }
    finally { setLoading(false) }
  }

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const res: any = await apiFetch('/admin/sessions')
      setSessions(res.data || [])
    } catch (err) { handleError(err, { userMessage: 'Không tải được danh sách phiên đăng nhập' }) }
    finally { setSessionsLoading(false) }
  }

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Thu hồi phiên đăng nhập này?')) return
    try {
      await apiFetch(`/admin/sessions/${sessionId}`, { method: 'DELETE' })
      toast.success('Đã thu hồi phiên đăng nhập')
      loadSessions()
    } catch (err: any) { toast.error(err.message) }
  }

  const handleRevokeAllSessions = async (userId: string, userName: string) => {
    if (!confirm(`Thu hồi tất cả phiên đăng nhập của "${userName}"?`)) return
    try {
      await apiFetch(`/admin/sessions/user/${userId}`, { method: 'DELETE' })
      toast.success('Đã thu hồi tất cả phiên')
      loadSessions()
    } catch (err: any) { toast.error(err.message) }
  }

  const openCreateModal = () => {
    setEditUser(null)
    setForm({ username: '', full_name: '', password: '', role: 'dvkh', email: '', is_active: true })
    setError('')
    setShowModal(true)
  }

  const openEditModal = (u: UserItem) => {
    setEditUser(u)
    setForm({ username: u.username, full_name: u.full_name, password: '', role: u.role, email: u.email || '', is_active: u.is_active })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (editUser) {
        await apiFetch(`/admin/users/${editUser.id}`, {
          method: 'PUT',
          body: { full_name: form.full_name, role: form.role, email: form.email || null, is_active: form.is_active },
        })
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Mật khẩu phải có ít nhất 6 ký tự')
          setSaving(false)
          return
        }
        await apiFetch('/admin/users', {
          method: 'POST',
          body: { username: form.username, full_name: form.full_name, password: form.password, role: form.role, email: form.email || null },
        })
      }
      setShowModal(false)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u: UserItem) => {
    try {
      await apiFetch(`/admin/users/${u.id}`, {
        method: 'PUT',
        body: { is_active: !u.is_active },
      })
      await loadData()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.warning('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }
    try {
      await apiFetch(`/admin/users/${resetUserId}/reset-password`, {
        method: 'PUT',
        body: { new_password: newPassword },
      })
      setShowResetModal(false)
      setNewPassword('')
      toast.success('Đặt lại mật khẩu thành công')
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  const filteredUsers = users.filter(u => {
    if (filterRole && u.role !== filterRole) return false
    if (search) {
      const q = search.toLowerCase()
      return u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q)
    }
    return true
  })

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚙️ Quản trị hệ thống</h1>
          <p className="text-sm text-gray-500">Quản lý người dùng, phân quyền</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'users' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          👤 Người dùng ({users.length})
        </button>
        <button onClick={() => setTab('roles')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'roles' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          🔑 Vai trò & Phân quyền
        </button>
        <button onClick={() => { setTab('sessions'); loadSessions() }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'sessions' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          🖥️ Phiên đăng nhập
        </button>
        <button onClick={() => router.push('/dashboard/settings/permissions')}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 transition border border-dashed border-gray-300">
          🔐 Ma trận phân quyền →
        </button>
        <button onClick={() => { setTab('seasonal'); loadSeasonalMode() }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'seasonal' ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          🎋 Chế độ mùa vụ
        </button>
      </div>

      {tab === 'users' && (
        <div>
          {/* Stats bar */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-white rounded-xl border shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="text-sm text-gray-700"><strong className="text-green-700">{users.filter(u => u.is_active).length}</strong> đang hoạt động</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
              <span className="text-sm text-gray-500">{users.filter(u => !u.is_active).length} bị khoá</span>
            </div>
            <div className="flex-1" />
            <span className="text-xs text-gray-400">{users.length} tài khoản tổng</span>
          </div>

          {/* Role summary */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-4">
            <button onClick={() => setFilterRole('')}
              className={`text-center p-2 rounded-lg text-xs transition ${!filterRole ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-white hover:bg-gray-50'}`}>
              <div className="font-bold text-lg">{users.length}</div>
              <div>Tất cả</div>
            </button>
            {Object.entries(roleLabels).map(([code, name]) => (
              <button key={code} onClick={() => setFilterRole(filterRole === code ? '' : code)}
                className={`text-center p-2 rounded-lg text-xs transition ${filterRole === code ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-white hover:bg-gray-50'}`}>
                <div className="font-bold text-lg">{roleCounts[code] || 0}</div>
                <div>{name}</div>
              </button>
            ))}
          </div>

          {/* Search + Add */}
          <div className="flex gap-3 mb-4">
            <input type="text" placeholder="Tìm kiếm theo tên hoặc username..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
            <button onClick={openCreateModal}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
              ➕ Thêm người dùng
            </button>
          </div>

          {/* Users table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4">Tên đăng nhập</th>
                  <th className="text-left py-3 px-4">Họ tên</th>
                  <th className="text-center py-3 px-4">Vai trò</th>
                  <th className="text-center py-3 px-4">Trạng thái</th>
                  <th className="text-center py-3 px-4">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const nameParts = u.full_name.trim().split(' ')
                  const initials = nameParts.length >= 2
                    ? (nameParts[nameParts.length - 2][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                    : u.full_name.slice(0, 2).toUpperCase()
                  return (
                  <tr key={u.id} className={`border-t hover:bg-gray-50 ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4 font-mono text-sm">{u.username}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{initials}</div>
                        <div>
                          <div className="font-medium">{u.full_name}</div>
                          {u.email && <div className="text-xs text-gray-400">{u.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || 'bg-gray-100'}`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => handleToggleActive(u)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.is_active ? '✓ Hoạt động' : '✗ Đã khóa'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(u)}
                          className="text-blue-600 hover:text-blue-800 text-xs">✏️ Sửa</button>
                        <button onClick={() => { setResetUserId(u.id); setResetUserName(u.full_name); setNewPassword(''); setShowResetModal(true) }}
                          className="text-orange-600 hover:text-orange-800 text-xs">🔑 Đặt lại MK</button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-400">Không tìm thấy người dùng nào</div>
            )}
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            ℹ️ Hệ thống có 8 vai trò với phân quyền cố định. Mỗi người dùng được gán đúng 1 vai trò.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(role => (
              <div key={role.code} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[role.code] || 'bg-gray-100'}`}>
                    {role.name}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">{role.code}</span>
                  <span className="text-xs text-gray-400 ml-auto">{roleCounts[role.code] || 0} người</span>
                </div>
                <p className="text-sm text-gray-600">{role.description}</p>
                <div className="mt-3 text-xs text-gray-400">
                  {role.code === 'admin' && 'Truy cập: Tất cả chức năng'}
                  {role.code === 'dvkh' && 'Truy cập: Tổng quan, Đơn hàng, Tạo đơn, Sản phẩm, Khách hàng'}
                  {role.code === 'dispatcher' && 'Truy cập: Tổng quan, Đơn hàng, Tạo đơn, Lập kế hoạch, Chuyến xe, Bản đồ, Sản phẩm, Khách hàng, Phương tiện, Tài xế'}
                  {role.code === 'accountant' && 'Truy cập: Tổng quan, Đơn hàng, Duyệt đơn, Đối soát, Chốt sổ ngày'}
                  {role.code === 'driver' && 'Truy cập: Chuyến xe của tôi'}
                  {role.code === 'warehouse' && 'Truy cập: Quản lý kho, Quét barcode, Kiểm tra cổng'}
                  {role.code === 'security' && 'Truy cập: Kiểm tra cổng'}
                  {role.code === 'management' && 'Truy cập: Tổng quan, Báo cáo KPI'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div>
          {sessionsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-4 border-[#F68634] border-t-transparent rounded-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Không có phiên đăng nhập nào</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4">Người dùng</th>
                    <th className="text-left py-3 px-4">Vai trò</th>
                    <th className="text-left py-3 px-4">IP</th>
                    <th className="text-left py-3 px-4">Thiết bị</th>
                    <th className="text-left py-3 px-4">Hoạt động gần nhất</th>
                    <th className="text-center py-3 px-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => {
                    const isRecent = Date.now() - new Date(s.last_active).getTime() < 300000
                    return (
                      <tr key={s.id} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{s.user_name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[s.role] || 'bg-gray-100'}`}>
                            {roleLabels[s.role] || s.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-500">{s.ip_address}</td>
                        <td className="py-3 px-4 text-xs text-gray-500 max-w-[200px] truncate" title={s.user_agent}>{s.user_agent}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isRecent ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="text-xs text-gray-500">{new Date(s.last_active).toLocaleString('vi-VN')}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleRevokeSession(s.id)}
                              className="text-red-600 hover:text-red-800 text-xs">🔒 Thu hồi</button>
                            <button onClick={() => handleRevokeAllSessions(s.user_id, s.user_name)}
                              className="text-orange-600 hover:text-orange-800 text-xs">⚡ Tất cả</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* F5 — Seasonal Mode */}
      {tab === 'seasonal' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800">🎋 Chế độ mùa vụ (Tết / Hè / Cao điểm)</h2>
              <p className="text-sm text-gray-500 mt-1">Khi bật, hệ thống sẽ tăng buffer tải trọng VRP và hiển thị banner cảnh báo cho tất cả vai trò.</p>
            </div>
            {!seasonalMode ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border">
                  <div>
                    <div className="font-semibold text-gray-800">Bật chế độ mùa vụ</div>
                    <div className="text-xs text-gray-500 mt-0.5">Tự động áp dụng buffer VRP và cảnh báo toàn hệ thống</div>
                  </div>
                  <button
                    onClick={() => setSeasonalMode({ ...seasonalMode, enabled: !seasonalMode.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${seasonalMode.enabled ? 'bg-brand-500' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${seasonalMode.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nhãn hiển thị</label>
                  <input
                    value={seasonalMode.label}
                    onChange={e => setSeasonalMode({ ...seasonalMode, label: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="VD: Tết Nguyên Đán 2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buffer tải trọng VRP (%)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={50} step={5}
                      value={seasonalMode.vrp_buffer_pct}
                      onChange={e => setSeasonalMode({ ...seasonalMode, vrp_buffer_pct: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm font-bold text-brand-600 w-10 text-right">{seasonalMode.vrp_buffer_pct}%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">VRP sẽ giảm tải trọng tối đa xuống {100 - seasonalMode.vrp_buffer_pct}% để đảm bảo tính linh hoạt trong mùa cao điểm.</p>
                </div>
                {seasonalMode.enabled && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <strong>⚠️ Chế độ {seasonalMode.label} đang bật.</strong> Tất cả người dùng sẽ thấy banner cảnh báo. VRP buffer: -{seasonalMode.vrp_buffer_pct}% tải trọng.
                  </div>
                )}
                <button
                  onClick={handleSaveSeasonalMode}
                  disabled={seasonalSaving}
                  className="w-full py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 transition"
                >
                  {seasonalSaving ? 'Đang lưu...' : 'Lưu cài đặt mùa vụ'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editUser ? '✏️ Sửa người dùng' : '➕ Thêm người dùng'}</h2>
            <div className="space-y-3">
              {!editUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập *</label>
                  <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="VD: dvkh05" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
                <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="VD: Nguyễn Văn A" />
              </div>
              {!editUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu * (ít nhất 6 ký tự)</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none">
                  {Object.entries(roleLabels).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              {editUser && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  <label className="text-sm text-gray-700">Tài khoản hoạt động</label>
                </div>
              )}
              {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm font-medium disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-2">🔑 Đặt lại mật khẩu</h2>
            <p className="text-sm text-gray-500 mb-4">Cho: <strong>{resetUserName}</strong></p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới (ít nhất 6 ký tự)</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleResetPassword}
                className="flex-1 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm font-medium">
                Xác nhận
              </button>
              <button onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
