/**
 * Design tokens — single source of truth for visual design language.
 *
 * Reference: UX_AUDIT_REPORT.md §3.2
 *
 * Use TS tokens for runtime decisions; use Tailwind classes for static styling.
 * Tailwind palette (brand-50..700) is already defined in tailwind.config.js.
 */

// ─── Brand colors (matches tailwind brand-* scale) ────────────────────────
export const brand = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#F68634', // BHL primary orange
  600: '#ea580c',
  700: '#c2410c',
} as const

// ─── Semantic colors per status family ────────────────────────────────────
export const semantic = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', border: 'border-emerald-200', solid: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', border: 'border-amber-200', solid: 'bg-amber-500' },
  danger:  { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', border: 'border-rose-200', solid: 'bg-rose-500' },
  info:    { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', border: 'border-sky-200', solid: 'bg-sky-500' },
  neutral: { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200', border: 'border-slate-200', solid: 'bg-slate-500' },
  brand:   { bg: 'bg-brand-50', text: 'text-brand-700', ring: 'ring-brand-200', border: 'border-brand-200', solid: 'bg-brand-500' },
} as const

export type SemanticTone = keyof typeof semantic

// ─── Spacing scale (use directly in Tailwind classes; documented for consistency)
export const spacing = {
  xs: '0.5rem',  // 8px  — between related items in a row
  sm: '0.75rem', // 12px — between fields
  md: '1rem',    // 16px — between sections inside a card
  lg: '1.5rem',  // 24px — between cards
  xl: '2rem',    // 32px — between page sections
  '2xl': '3rem', // 48px — page top padding
} as const

// ─── Radii — prefer rounded-xl for cards, rounded-2xl for prominent surfaces
export const radius = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
} as const

// ─── Shadows — soft elevation system
export const shadow = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-md',
  hover: 'hover:shadow-md transition-shadow',
} as const

// ─── Transitions (motion vocabulary)
export const motion = {
  fast: 'transition duration-150 ease-out',
  base: 'transition duration-200 ease-out',
  slow: 'transition duration-300 ease-out',
  spring: 'transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
} as const

// ─── Typography scale
export const text = {
  display: 'text-3xl font-bold tracking-tight text-slate-900',
  h1: 'text-2xl font-bold tracking-tight text-slate-900',
  h2: 'text-xl font-semibold text-slate-900',
  h3: 'text-base font-semibold text-slate-900',
  body: 'text-sm text-slate-700',
  caption: 'text-xs text-slate-500',
  metric: 'text-3xl font-bold tabular-nums text-slate-900',
  metricSm: 'text-xl font-semibold tabular-nums text-slate-900',
} as const

// ─── Focus ring — accessibility
export const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'

// ─── Surface helper — page card baseline
export const surface = {
  card: 'rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60',
  cardHover: 'rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60 hover:shadow-md hover:ring-brand-200 transition',
  cardElevated: 'rounded-2xl bg-white shadow-md ring-1 ring-slate-200/40',
  inset: 'rounded-lg bg-slate-50 ring-1 ring-slate-200/60',
} as const

// ─── Tone helper for KPI/Card accents
export function toneClasses(tone: SemanticTone) {
  return semantic[tone]
}
