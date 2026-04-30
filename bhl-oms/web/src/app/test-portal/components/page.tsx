'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, getUser } from '@/lib/api'
import { useEffect } from 'react'
import {
  // P0
  Modal, ConfirmDialog, Input, Textarea, FormField, Tabs, Badge, Tooltip, Alert, Button,
  // P1
  Drawer, DataTable, FilterBar, ActionMenu, DateRangePicker,
  // Extra
  StatusChip,
} from '@/components/ui'
import type { ColumnDef, FilterOption, ActionMenuItem } from '@/components/ui'
import { Trash2, Edit, Eye } from 'lucide-react'

// ─── Types ───────────────────────────────────────────
interface SampleRow {
  id: string
  name: string
  status: 'active' | 'inactive' | 'pending'
  amount: number
}

const SAMPLE_ROWS: SampleRow[] = [
  { id: '1', name: 'Nguyễn Văn A', status: 'active', amount: 1200000 },
  { id: '2', name: 'Trần Thị B', status: 'inactive', amount: 850000 },
  { id: '3', name: 'Lê Văn C', status: 'pending', amount: 3400000 },
  { id: '4', name: 'Phạm Thị D', status: 'active', amount: 620000 },
]

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
  { value: 'pending', label: 'Chờ duyệt' },
]

const COLUMNS: ColumnDef<SampleRow>[] = [
  { key: 'name', label: 'Tên', sortable: true },
  { key: 'status', label: 'Trạng thái', render: (row) => <StatusChip status={row.status} /> },
  { key: 'amount', label: 'Số tiền', render: (row) => <span className="tabular-nums">{row.amount.toLocaleString('vi-VN')}đ</span>, align: 'right' },
]

// ─── Section wrapper ──────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────
export default function ComponentCatalogPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  // Auth guard — admin only
  useEffect(() => {
    const token = getToken()
    const user = getUser()
    if (!token || !user || !['admin', 'management'].includes(user.role)) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [router])

  // State for interactive demos
  const [modal1Open, setModal1Open] = useState(false)
  const [confirm1Open, setConfirm1Open] = useState(false)
  const [drawer1Open, setDrawer1Open] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [textareaVal, setTextareaVal] = useState('')
  const [activeTab, setActiveTab] = useState('tab1')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const menuItems: ActionMenuItem[] = [
    { label: 'Xem chi tiết', icon: Eye, onClick: () => alert('View') },
    { label: 'Chỉnh sửa', icon: Edit, onClick: () => alert('Edit') },
    { separator: true },
    { label: 'Xóa', icon: Trash2, danger: true, onClick: () => alert('Delete') },
  ]

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-800">← Quay lại</button>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">🧩 Component Catalog</h1>
          <p className="text-slate-500 mt-1">BHL Design System — 23 primitives. Chỉ admin có thể xem trang này.</p>
        </div>

        {/* ── P0 components ─────────────────────────────── */}
        <Section title="P0 — Overlays">
          <Row label="Modal">
            <Button variant="primary" onClick={() => setModal1Open(true)}>Mở Modal</Button>
            <Modal open={modal1Open} onClose={() => setModal1Open(false)} title="Ví dụ Modal" size="md"
              footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal1Open(false)}>Hủy</Button><Button variant="primary" onClick={() => setModal1Open(false)}>Xác nhận</Button></div>}>
              <p className="text-slate-600">Đây là nội dung bên trong Modal. Nhấn ESC hoặc click ra ngoài để đóng.</p>
            </Modal>
          </Row>
          <Row label="ConfirmDialog">
            <Button variant="danger" onClick={() => setConfirm1Open(true)}>Xóa mục</Button>
            <ConfirmDialog
              open={confirm1Open}
              title="Xác nhận xóa?"
              message="Hành động này không thể hoàn tác."
              confirmLabel="Xóa"
              danger
              onConfirm={() => setConfirm1Open(false)}
              onClose={() => setConfirm1Open(false)}
            />
          </Row>
          <Row label="Drawer (right slide-in)">
            <Button variant="secondary" onClick={() => setDrawer1Open(true)}>Mở Drawer</Button>
            <Drawer open={drawer1Open} onClose={() => setDrawer1Open(false)} title="Drawer ví dụ" size="md">
              <div className="space-y-3">
                <p className="text-slate-600">Nội dung bên trong Drawer. Cuộn được nếu dài.</p>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="p-3 bg-slate-100 rounded-lg text-sm">Mục {i + 1}</div>
                ))}
              </div>
            </Drawer>
          </Row>
        </Section>

        <Section title="P0 — Form Elements">
          <Row label="Input — các variant">
            <Input placeholder="Default" value={inputVal} onChange={e => setInputVal(e.target.value)} />
            <Input placeholder="Disabled" disabled />
            <Input placeholder="Error" error="Trường này bắt buộc" />
          </Row>
          <Row label="Textarea">
            <div className="w-full max-w-md">
              <Textarea placeholder="Nhập ghi chú..." value={textareaVal} onChange={e => setTextareaVal(e.target.value)} rows={3} />
            </div>
          </Row>
          <Row label="FormField">
            <div className="w-full max-w-md space-y-3">
              <FormField label="Tên khách hàng" required>
                <Input placeholder="Nhập tên..." />
              </FormField>
              <FormField label="Ghi chú" hint="Tùy chọn">
                <Textarea placeholder="..." rows={2} />
              </FormField>
            </div>
          </Row>
        </Section>

        <Section title="P0 — Display">
          <Row label="Badge (count/dot)">
            <Badge count={3} tone="brand" />
            <Badge count={12} tone="success" />
            <Badge count={99} tone="warning" />
            <Badge count={5} tone="danger" />
            <Badge dot tone="brand" />
            <Badge dot tone="success" />
            <span className="text-sm text-slate-500">Badge = count/dot, dùng StatusChip cho status text</span>
          </Row>
          <Row label="StatusChip">
            <StatusChip status="pending" />
            <StatusChip status="confirmed" />
            <StatusChip status="delivering" />
            <StatusChip status="delivered" />
            <StatusChip status="cancelled" />
          </Row>
          <Row label="Alert — các tone">
            <div className="w-full space-y-2">
              <Alert tone="info">Thông báo thông tin.</Alert>
              <Alert tone="success">Thao tác thành công!</Alert>
              <Alert tone="warning">Cảnh báo: kiểm tra lại dữ liệu.</Alert>
              <Alert tone="danger">Lỗi xảy ra, thử lại sau.</Alert>
            </div>
          </Row>
          <Row label="Tooltip">
            <Tooltip content="Đây là nội dung tooltip">
              <span className="text-sm text-slate-600 underline decoration-dashed cursor-help">Hover vào đây</span>
            </Tooltip>
          </Row>
        </Section>

        <Section title="P0 — Navigation">
          <Row label="Tabs">
            <div className="w-full max-w-lg">
              <Tabs
                tabs={[
                  { key: 'tab1', label: 'Tab 1' },
                  { key: 'tab2', label: 'Tab 2' },
                  { key: 'tab3', label: 'Tab 3', badge: 5 },
                ]}
                activeKey={activeTab}
                onChange={setActiveTab}
              />
              <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-600">
                Nội dung của {activeTab}
              </div>
            </div>
          </Row>
        </Section>

        <Section title="P0 — Action">
          <Row label="Button — các variant">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="success">Success</Button>
          </Row>
          <Row label="Button — sizes">
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" size="md">Medium</Button>
            <Button variant="primary" size="lg">Large</Button>
          </Row>
          <Row label="Button — states">
            <Button variant="primary" loading>Loading...</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </Row>
        </Section>

        {/* ── P1 components ─────────────────────────────── */}
        <Section title="P1 — DataTable">
          <DataTable<SampleRow>
            columns={COLUMNS}
            data={SAMPLE_ROWS}
            keyField="id"
            stickyHeader
            onRowClick={(row) => alert(`Clicked: ${row.name}`)}
          />
        </Section>

        <Section title="P1 — FilterBar">
          <FilterBar
            search={filterSearch}
            onSearchChange={setFilterSearch}
            searchPlaceholder="Tìm khách hàng..."
            status={filterStatus}
            onStatusChange={setFilterStatus}
            statusOptions={STATUS_OPTIONS}
            onReset={() => { setFilterSearch(''); setFilterStatus('') }}
          />
          <p className="text-sm text-slate-500">Tìm: &quot;{filterSearch}&quot; | Trạng thái: &quot;{filterStatus}&quot;</p>
        </Section>

        <Section title="P1 — ActionMenu">
          <Row label="ActionMenu với ⋯ trigger">
            <div className="flex gap-4">
              {SAMPLE_ROWS.slice(0, 3).map(row => (
                <div key={row.id} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg text-sm">
                  <span>{row.name}</span>
                  <ActionMenu items={menuItems} />
                </div>
              ))}
            </div>
          </Row>
        </Section>

        <Section title="P1 — DateRangePicker">
          <Row label="DateRangePicker với presets">
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={(from, to) => { setDateFrom(from); setDateTo(to) }}
            />
            <span className="text-sm text-slate-500">
              {dateFrom || '—'} → {dateTo || '—'}
            </span>
          </Row>
        </Section>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-sm text-slate-400">
          BHL Component Catalog · {new Date().getFullYear()} · {23} primitives
        </div>
      </div>
    </div>
  )
}
