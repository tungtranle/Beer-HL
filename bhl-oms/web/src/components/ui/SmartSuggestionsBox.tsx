'use client'

/**
 * SmartSuggestionsBox — F3 World-Class Strategy.
 * Inline trong order form: "Khách thường mua thêm" với confidence/lift.
 *
 * Rules (per DATA_DICTIONARY §7):
 *  - Hide rule confidence < 0.60
 *  - Auto-add badge for confidence ≥ 0.985 (bundle nghiệp vụ)
 *  - Always show explainability "Tại sao?"
 *
 * Data source: ml_features.basket_rules
 */

import { Sparkles, Plus, Lock } from 'lucide-react'
import { ExplainabilityButton } from './ExplainabilityModal'
import { EmptyState } from './EmptyState'
import { SkeletonLine } from './Skeleton'

export interface BasketRule {
  antecedent: string
  consequent: string
  confidence: number       // 0–1
  lift: number
  support: number
  pair_count: number
  /** Optional: matching product_id in OMS to enable Add */
  product_id?: string
}

interface Props {
  rules?: BasketRule[]
  loading?: boolean
  /** Called when user clicks "+ Thêm". Pass `quantity` (defaulted) */
  onAdd?: (rule: BasketRule, suggestedQty?: number) => void
  /** Default qty to suggest */
  defaultQty?: number
  className?: string
}

const AUTO_BUNDLE_THRESHOLD = 0.985

export function SmartSuggestionsBox({
  rules, loading, onAdd, defaultQty = 1, className = '',
}: Props) {
  if (loading) {
    return (
      <div className={`rounded-xl border border-brand-200 bg-brand-50/30 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <SkeletonLine className="w-32 h-3" />
        </div>
        <SkeletonLine className="w-full mb-2" />
        <SkeletonLine className="w-3/4" />
      </div>
    )
  }

  // Filter & sort
  const visible = (rules || [])
    .filter((r) => r.confidence >= 0.60)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  if (visible.length === 0) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-gray-50 p-4 ${className}`}>
        <EmptyState
          icon={Sparkles}
          title="Chưa có gợi ý SKU"
          defaultMessage="Thêm sản phẩm vào đơn để xem gợi ý 'thường mua thêm'"
        />
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-brand-200 bg-brand-50/30 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <h4 className="text-sm font-medium text-brand-700">Khách thường mua thêm</h4>
        </div>
        <span className="text-[11px] text-gray-500">{visible.length} gợi ý</span>
      </div>

      <ul className="space-y-2">
        {visible.map((rule, i) => {
          const isAutoBundle = rule.confidence >= AUTO_BUNDLE_THRESHOLD
          const confidencePct = (rule.confidence * 100).toFixed(0)
          return (
            <li
              key={`${rule.antecedent}-${rule.consequent}-${i}`}
              className="flex items-start justify-between gap-2 bg-white rounded-lg border border-gray-200 p-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">{rule.consequent}</span>
                  {isAutoBundle && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      <Lock className="h-2.5 w-2.5" aria-hidden="true" /> Bundle
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {confidencePct}% NPP đặt cùng &quot;{rule.antecedent}&quot;
                  {rule.lift > 1 && <span className="ml-1">· lift {rule.lift.toFixed(1)}</span>}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <ExplainabilityButton
                  size="sm"
                  featureId="F3"
                  model="Apriori (basket analysis)"
                  dataSource={`${rule.pair_count.toLocaleString('vi-VN')} đơn lịch sử có chứa &quot;${rule.antecedent}&quot;`}
                  logic={[
                    `Support: ${(rule.support * 100).toFixed(2)}% (tỉ lệ đồng xuất hiện)`,
                    `Confidence: ${confidencePct}% (P(${rule.consequent} | ${rule.antecedent}))`,
                    `Lift: ${rule.lift.toFixed(2)} ${rule.lift > 1 ? '(positive correlation)' : ''}`,
                    isAutoBundle
                      ? `Confidence ≥ 98.5% → bundle nghiệp vụ, đề xuất tự động`
                      : `Confidence ≥ 60% → gợi ý thủ công`,
                  ]}
                  quality={{ label: 'Cập nhật', value: 'Hàng tháng', isGood: true }}
                />
                {onAdd && rule.product_id && (
                  <button
                    type="button"
                    onClick={() => onAdd(rule, defaultQty)}
                    className="inline-flex items-center gap-1 text-xs bg-brand text-white px-2 h-7 rounded hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label={`Thêm ${rule.consequent} vào đơn`}
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    Thêm
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
