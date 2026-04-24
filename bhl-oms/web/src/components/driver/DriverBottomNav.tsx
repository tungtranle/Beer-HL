'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Truck, User, Bell, type LucideIcon } from 'lucide-react'

interface Tab {
  href: string
  label: string
  icon: LucideIcon
}

const tabs: Tab[] = [
  { href: '/dashboard/driver', label: 'Chuyến', icon: Truck },
  { href: '/dashboard/notifications', label: 'Thông báo', icon: Bell },
  { href: '/dashboard/driver/profile', label: 'Tôi', icon: User },
]

export function DriverBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200/80 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.08)]"
      aria-label="Driver navigation"
    >
      <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive =
            tab.href === '/dashboard/driver'
              ? pathname === '/dashboard/driver'
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
                isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all ${
                  isActive ? 'bg-brand-50' : ''
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                {isActive && (
                  <span className="absolute -top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-500" />
                )}
              </div>
              <span className={`text-[11px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
