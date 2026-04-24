'use client'

/**
 * Skeleton primitives — replace plain "Đang tải..." text.
 * Pattern: matching final layout shape so user perceives stability.
 *
 * Reference: docs/specs/UX_AUDIT_AND_REDESIGN.md §3.5
 */

import type { ReactNode } from 'react'

interface SkeletonProps {
  className?: string
}

/** Single line — text placeholder */
export function SkeletonLine({ className = '' }: SkeletonProps) {
  return <div className={`h-3 rounded bg-gray-200 animate-pulse ${className}`} />
}

/** Avatar / icon circle */
export function SkeletonAvatar({ className = 'h-10 w-10' }: SkeletonProps) {
  return <div className={`rounded-full bg-gray-200 animate-pulse ${className}`} />
}

/** Card with header + 3 lines (default list item) */
export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-1/3" />
          <SkeletonLine className="w-1/4 h-2" />
        </div>
      </div>
      <SkeletonLine className="w-full mb-2" />
      <SkeletonLine className="w-5/6 mb-2" />
      <SkeletonLine className="w-2/3" />
    </div>
  )
}

/** Table-like row skeleton */
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-4 py-3 border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLine key={i} className="flex-1" />
      ))}
    </div>
  )
}

/** Grid of N cards (for dashboard) */
export function SkeletonGrid({ count = 4, cols = 4 }: { count?: number; cols?: number }) {
  const gridCls = cols === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  cols === 3 ? 'grid-cols-1 md:grid-cols-3' :
                  cols === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'
  return (
    <div className={`grid ${gridCls} gap-4`}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

/** Wrapper: show skeleton while loading, else render children */
export function WithSkeleton({
  loading, skeleton, children,
}: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  return <>{loading ? skeleton : children}</>
}
