'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ChevronDown } from 'lucide-react'
import { clearAuth } from '@/lib/api'

interface Props {
  fullName: string
  _role: string
  initials: string
  roleLabel: string
}

/**
 * UserMenu — isolated 'use client' dropdown so its open/close state
 * does not trigger a re-render of the full DashboardLayout tree.
 */
export function UserMenu({ fullName, _role, initials, roleLabel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center gap-2 ml-0.5 pl-1.5 pr-2 py-1 rounded-lg hover:bg-gray-50 transition"
        aria-label={`Menu người dùng: ${fullName}`}
      >
        <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-[11px] font-bold">
          {initials}
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50 py-1.5 z-50 animate-fade-in">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{fullName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{roleLabel}</p>
          </div>
          <div className="p-1.5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
