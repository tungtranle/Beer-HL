'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { toast } from '@/lib/useToast'

interface SystemConfig {
  key: string
  value: string
  description?: string
  updated_at: string
}

export default function SystemConfigsPage() {
  const router = useRouter()
  const user = getUser()
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/admin/configs')
      const data: SystemConfig[] = res.data || []
      setConfigs(data)
      const vals: Record<string, string> = {}
      data.forEach(c => { vals[c.key] = c.value })
      setEditValues(vals)
      setDirty(false)
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được cấu hình hệ thống' })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const changed = configs
        .filter(c => editValues[c.key] !== c.value)
        .map(c => ({ key: c.key, value: editValues[c.key] }))

      if (changed.length === 0) {
        setDirty(false)
        setSaving(false)
        return
      }

      await apiFetch('/admin/configs', {
        method: 'PUT',
        body: { configs: changed },
      })
      await loadConfigs()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚙️ Cấu hình hệ thống</h1>
          <p className="text-sm text-gray-500">Quản lý các tham số cấu hình chung (cutoff, timeout, feature flags...)</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/settings')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Quản trị hệ thống
        </button>
      </div>

      {configs.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          <p className="text-lg font-medium">Chưa có cấu hình nào</p>
          <p className="text-sm mt-1">Hệ thống đang dùng giá trị mặc định. Thêm cấu hình qua database.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Tham số</th>
                <th className="px-4 py-3 font-medium">Giá trị</th>
                <th className="px-4 py-3 font-medium">Mô tả</th>
                <th className="px-4 py-3 font-medium">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {configs.map(c => (
                <tr key={c.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">{c.key}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={editValues[c.key] ?? c.value}
                      onChange={e => handleChange(c.key, e.target.value)}
                      className={`w-full px-2 py-1 border rounded text-sm ${
                        editValues[c.key] !== c.value ? 'border-brand-400 bg-brand-50' : 'border-gray-200'
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.description || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{c.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {dirty && (
            <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
              <button
                onClick={loadConfigs}
                className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
              >
                Hủy thay đổi
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
