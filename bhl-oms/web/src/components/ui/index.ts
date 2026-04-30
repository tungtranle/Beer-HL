// Design system primitives — single import surface.
// Reference: UX_AUDIT_REPORT.md §3 design system
// Component system: BHL_Component_System_Proposal.md

// ── Primitives (Tầng 1) ──────────────────────────────────────
export { Button } from './Button'
export { Card, CardHeader } from './Card'
export { Input } from './Input'
export type { InputProps } from './Input'
export { Textarea } from './Textarea'
export type { TextareaProps } from './Textarea'
export { FormField } from './FormField'
export { Badge } from './Badge'
export { Alert } from './Alert'
export { Tooltip } from './Tooltip'

// ── Composite (Tầng 2) ───────────────────────────────────────
export { Modal } from './Modal'
export { ConfirmDialog } from './ConfirmDialog'
export { Tabs } from './Tabs'
export type { TabItem } from './Tabs'
export { Drawer } from './Drawer'
export { DataTable } from './DataTable'
export type { ColumnDef, SortDir } from './DataTable'
export { FilterBar } from './FilterBar'
export type { FilterOption } from './FilterBar'
export { ActionMenu } from './ActionMenu'
export type { ActionMenuItem } from './ActionMenu'
export { DateRangePicker } from './DateRangePicker'
export type { DateRange } from './DateRangePicker'

// ── Feedback / Status ────────────────────────────────────────
export { PageHeader } from './PageHeader'
export { KpiCard } from './KpiCard'
export { EmptyState } from './EmptyState'
export { LoadingState } from './LoadingState'
export { StatusChip } from './StatusChip'
export { SkeletonLine, SkeletonAvatar, SkeletonCard, SkeletonTableRow, SkeletonGrid, WithSkeleton } from './Skeleton'
export { Pagination } from './Pagination'
export type { PaginationProps } from './Pagination'
