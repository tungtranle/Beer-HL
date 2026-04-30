'use client'

/**
 * CommandPalette — U2 World-Class fix.
 * Global Cmd+K (Ctrl+K) launcher, Linear/Superhuman style.
 *
 * Trigger: Cmd+K / Ctrl+K from any page.
 * Esc / click outside to close.
 *
 * Items registered via static config — extend as needed.
 *
 * No external dep — built with Tailwind + lucide-react only (~250 LOC).
 *
 * Reference: docs/specs/UX_AUDIT_AND_REDESIGN.md §3.1
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, FileText, Truck, Users, Package, MapPin,
  BarChart3, Settings, PlusCircle, Bell, Warehouse,
  Bot, FlaskConical, ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'
import { useAIFeature } from '@/hooks/useAIFeature'

interface Command {
  id: string
  label: string
  hint?: string                  // secondary text
  icon: LucideIcon
  /** What roles can see this */
  roles?: string[]
  /** Action: navigation OR custom callback */
  href?: string
  onSelect?: () => void
  /** Search keywords (Vietnamese + ASCII) */
  keywords?: string[]
  group: 'Điều hướng' | 'Hành động' | 'Cài đặt' | 'Báo cáo' | 'AI'
}

const COMMANDS: Command[] = [
  // Navigation
  { id: 'nav-orders',        label: 'Danh sách đơn hàng',  icon: FileText,    href: '/dashboard/orders',          group: 'Điều hướng', keywords: ['orders', 'don', 'so'] },
  { id: 'nav-trips',         label: 'Chuyến xe',            icon: Truck,        href: '/dashboard/trips',           group: 'Điều hướng', keywords: ['trips', 'chuyen', 'xe'] },
  { id: 'nav-control-tower', label: 'Trung tâm điều phối',  icon: MapPin,      href: '/dashboard/control-tower',   group: 'Điều hướng', roles: ['admin', 'dispatcher'] },
  { id: 'nav-customers',     label: 'Khách hàng (NPP)',     icon: Users,        href: '/dashboard/customers',       group: 'Điều hướng' },
  { id: 'nav-products',      label: 'Sản phẩm (SKU)',       icon: Package,      href: '/dashboard/products',        group: 'Điều hướng' },
  { id: 'nav-warehouse',     label: 'Quản lý kho',          icon: Warehouse,    href: '/dashboard/warehouse',       group: 'Điều hướng', roles: ['admin', 'warehouse_handler'] },
  { id: 'nav-kpi',           label: 'Báo cáo KPI',          icon: BarChart3,    href: '/dashboard/kpi',             group: 'Báo cáo' },
  { id: 'nav-notifications', label: 'Thông báo',            icon: Bell,         href: '/dashboard/notifications',   group: 'Điều hướng' },
  { id: 'nav-settings',      label: 'Cài đặt hệ thống',     icon: Settings,     href: '/dashboard/settings',        group: 'Cài đặt',     roles: ['admin'] },
  { id: 'nav-ai-transparency', label: 'AI Transparency Center', icon: ShieldCheck, href: '/dashboard/ai/transparency', group: 'AI', roles: ['admin', 'management'] },
  { id: 'nav-ai-simulations', label: 'AI Simulation Lab', icon: FlaskConical, href: '/dashboard/ai/simulations', group: 'AI', roles: ['admin', 'dispatcher', 'management'] },
  { id: 'nav-ai-settings', label: 'Cài đặt AI Toggle', icon: Bot, href: '/dashboard/settings/ai', group: 'AI', roles: ['admin'] },

  // Actions
  { id: 'act-new-order',     label: 'Tạo đơn hàng mới',     icon: PlusCircle,   href: '/dashboard/orders/new',      group: 'Hành động',   roles: ['admin', 'dvkh'], keywords: ['create', 'tao don', 'new'] },
]

interface Props {
  /** Optional extra commands (e.g., from search results) */
  extraCommands?: Command[]
}

export function CommandPalette({ extraCommands = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [intentCommands, setIntentCommands] = useState<Command[]>([])
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const userRole = getUser()?.role
  const { enabled: aiIntentEnabled } = useAIFeature('ai.intent')

  // Cmd+K / Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Auto-focus when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActiveIdx(0)
      setIntentCommands([])
    }
  }, [open])

  useEffect(() => {
    if (!open || !aiIntentEnabled || query.trim().length < 3) {
      setIntentCommands([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const res: any = await apiFetch(`/ai/intents?q=${encodeURIComponent(query)}`)
        if (cancelled) return
        const matches = (res.data || []).slice(0, 3)
        setIntentCommands(matches.map((match: any, index: number) => ({
          id: `ai-intent-${match.intent}-${index}`,
          label: `AI: ${match.action}`,
          hint: `${Math.round((match.confidence || 0) * 100)}% · Tier ${match.tier}`,
          icon: match.action === 'create_simulation' ? FlaskConical : Bot,
          href: match.href,
          onSelect: match.href ? undefined : () => router.push('/dashboard/ai/simulations'),
          group: 'AI',
          keywords: [match.intent, match.action],
        })))
      } catch {
        if (!cancelled) setIntentCommands([])
      }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, query, aiIntentEnabled, router])

  // Filter commands
  const visible = useMemo(() => {
    const all = [...COMMANDS, ...extraCommands, ...intentCommands].filter((c) => !c.roles || (userRole && c.roles.includes(userRole)))
    if (!query.trim()) return all
    const q = normalizeVi(query.trim().toLowerCase())
    return all.filter((c) => {
      const haystack = [c.label, c.hint, ...(c.keywords || [])].filter(Boolean).map((s) => normalizeVi(String(s).toLowerCase())).join(' ')
      return haystack.includes(q)
    })
  }, [query, userRole, extraCommands, intentCommands])

  // Group by group label
  const grouped = useMemo(() => {
    const map: Record<string, Command[]> = {}
    visible.forEach((c) => { (map[c.group] ||= []).push(c) })
    return map
  }, [visible])

  const flatList = visible

  // Arrow nav
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flatList.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatList[activeIdx]
        if (item) selectItem(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, activeIdx, flatList])

  const selectItem = (item: Command) => {
    setOpen(false)
    if (item.onSelect) item.onSelect()
    else if (item.href) router.push(item.href)
  }

  if (!open) return null

  let cursor = 0
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bảng lệnh nhanh"
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:pt-[10vh] bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0) }}
            placeholder="Tìm trang, hành động… (Esc để đóng)"
            className="flex-1 outline-none text-sm placeholder:text-gray-400"
            aria-label="Truy vấn lệnh"
            aria-controls="cmdk-list"
          />
          <kbd className="hidden sm:inline-flex text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">⌘K</kbd>
        </div>

        <div
          ref={listRef}
          id="cmdk-list"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Không có kết quả phù hợp</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">{group}</p>
                {items.map((item) => {
                  const idx = cursor++
                  const active = idx === activeIdx
                  const Icon = item.icon
                  return (
                    <button
                      type="button"
                      key={item.id}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => selectItem(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm ${
                        active ? 'bg-brand-50 text-brand-700' : 'text-gray-800 hover:bg-gray-50'
                      } focus-visible:bg-brand-50 focus-visible:outline-none`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-brand-600' : 'text-gray-400'}`} aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {item.hint && <span className="text-[11px] text-gray-400">{item.hint}</span>}
                      {active && <kbd className="text-[10px] font-mono bg-white text-gray-500 px-1 py-0.5 rounded border border-gray-200">↵</kbd>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-500">
          <span>↑↓ chọn · ↵ mở · esc đóng</span>
          <span>{flatList.length} kết quả</span>
        </div>
      </div>
    </div>
  )
}

/** Strip Vietnamese diacritics for fuzzy search. */
function normalizeVi(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}
