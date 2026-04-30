'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, SlidersHorizontal, ToggleLeft, ToggleRight } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { toast } from '@/lib/useToast'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'

interface FlagDefinition {
  key: string
  name: string
  description: string
  category: string
}

interface FlagState {
  id: string
  flag_key: string
  scope_type: 'org' | 'role' | 'user'
  scope_id: string
  enabled: boolean
  updated_at: string
}

interface FlagItem {
  definition: FlagDefinition
  org: FlagState | null
  roles: FlagState[]
  users: FlagState[]
}

const ROLE_OPTIONS = [
  { code: 'admin', label: 'Admin' },
  { code: 'dispatcher', label: 'Điều phối' },
  { code: 'driver', label: 'Tài xế' },
  { code: 'warehouse', label: 'Kho' },
  { code: 'accountant', label: 'Kế toán' },
  { code: 'management', label: 'BGĐ' },
  { code: 'dvkh', label: 'DVKH' },
  { code: 'security', label: 'Bảo vệ' },
  { code: 'workshop', label: 'Phân xưởng' },
]

const CATEGORY_LABELS: Record<string, string> = {
  master: 'Master',
  core: 'Core',
  driver: 'Driver',
  decision: 'Decision',
  automation: 'Automation',
  safety: 'Safety',
  forecast: 'Forecast',
  finance: 'Finance',
  ui: 'UI',
  governance: 'Governance',
}

export default function AISettingsPage() {
  const user = getUser()
  const [items, setItems] = useState<FlagItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [selectedFlag, setSelectedFlag] = useState<string>('ai.master')

  const selectedItem = useMemo(
    () => items.find(item => item.definition.key === selectedFlag) || items[0],
    [items, selectedFlag],
  )

  useEffect(() => {
    loadFlags()
  }, [])

  const loadFlags = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/admin/ai-flags')
      const nextItems = res.data || []
      setItems(nextItems)
      if (nextItems.length > 0 && !nextItems.some((item: FlagItem) => item.definition.key === selectedFlag)) {
        setSelectedFlag(nextItems[0].definition.key)
      }
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được cài đặt AI' })
    } finally {
      setLoading(false)
    }
  }

  const upsertFlag = async (flagKey: string, scopeType: 'org' | 'role', scopeId: string, enabled: boolean) => {
    const key = `${flagKey}:${scopeType}:${scopeId}`
    setSavingKey(key)
    try {
      await apiFetch('/admin/ai-flags', {
        method: 'PUT',
        body: { flag_key: flagKey, scope_type: scopeType, scope_id: scopeId, enabled, config: {} },
      })
      await loadFlags()
      toast.success(enabled ? 'Đã bật AI flag' : 'Đã tắt AI flag')
    } catch (err) {
      handleError(err, { userMessage: 'Không lưu được AI flag' })
    } finally {
      setSavingKey(null)
    }
  }

  const orgEnabled = (item: FlagItem) => Boolean(item.org?.enabled)
  const roleEnabled = (item: FlagItem, role: string) => Boolean(item.roles.find(state => state.scope_id === role)?.enabled)

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader title="Không có quyền truy cập" subtitle="Chỉ Admin được cấu hình AI Toggle." />
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand-600" aria-hidden="true" />
            Cài đặt AI
          </h1>
          <p className="text-sm text-slate-500 mt-1">AI là lớp tăng cường. Khi tắt flag, workflow lõi vẫn dùng được bằng UI baseline.</p>
        </div>
        <Button variant="secondary" onClick={loadFlags} leftIcon={SlidersHorizontal}>Tải lại</Button>
      </div>

      <Card className="border-l-4 border-l-brand-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Master AI Switch</div>
            <div className="text-xs text-slate-500 mt-1">Tắt master switch sẽ làm mọi AI feature effective = OFF, kể cả flag con đang bật.</div>
          </div>
          {items.find(item => item.definition.key === 'ai.master') && (
            <button
              type="button"
              onClick={() => upsertFlag('ai.master', 'org', 'bhl', !orgEnabled(items.find(item => item.definition.key === 'ai.master')!))}
              disabled={savingKey === 'ai.master:org:bhl'}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${orgEnabled(items.find(item => item.definition.key === 'ai.master')!) ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {orgEnabled(items.find(item => item.definition.key === 'ai.master')!) ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              {orgEnabled(items.find(item => item.definition.key === 'ai.master')!) ? 'Đang bật' : 'Đang tắt'}
            </button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Danh sách AI flags</h2>
            <p className="text-xs text-slate-500 mt-1">Default missing row = OFF.</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[680px] overflow-auto">
            {items.map(item => {
              const enabled = orgEnabled(item)
              const isSelected = selectedFlag === item.definition.key
              return (
                <button
                  key={item.definition.key}
                  type="button"
                  onClick={() => setSelectedFlag(item.definition.key)}
                  className={`w-full text-left px-5 py-4 transition ${isSelected ? 'bg-brand-50' : 'bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{item.definition.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{item.definition.key}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${enabled ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'bg-slate-100 text-slate-500'}`}>
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2 line-clamp-2">{item.definition.description}</div>
                </button>
              )
            })}
          </div>
        </Card>

        {selectedItem && (
          <Card>
            <CardHeader
              title={selectedItem.definition.name}
              subtitle={`${CATEGORY_LABELS[selectedItem.definition.category] || selectedItem.definition.category} · ${selectedItem.definition.key}`}
              action={
                <button
                  type="button"
                  onClick={() => upsertFlag(selectedItem.definition.key, 'org', 'bhl', !orgEnabled(selectedItem))}
                  disabled={savingKey === `${selectedItem.definition.key}:org:bhl`}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${orgEnabled(selectedItem) ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  {orgEnabled(selectedItem) ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  Org {orgEnabled(selectedItem) ? 'ON' : 'OFF'}
                </button>
              }
            />

            <p className="text-sm text-slate-600 mb-6">{selectedItem.definition.description}</p>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Role overrides</h3>
                <p className="text-xs text-slate-500 mb-3">Role flag ghi đè org flag. User flag sẽ ghi đè role trong API backend.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ROLE_OPTIONS.map(role => {
                  const enabled = roleEnabled(selectedItem, role.code)
                  const key = `${selectedItem.definition.key}:role:${role.code}`
                  return (
                    <div key={role.code} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{role.label}</div>
                        <div className="text-xs text-slate-400 font-mono">{role.code}</div>
                      </div>
                      <button
                        type="button"
                        disabled={savingKey === key}
                        onClick={() => upsertFlag(selectedItem.definition.key, 'role', role.code, !enabled)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${enabled ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
              Effective rule: `ai.master` OFF sẽ ép mọi feature OFF. Với từng feature, backend resolve theo thứ tự org → role → user, missing row = OFF.
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
