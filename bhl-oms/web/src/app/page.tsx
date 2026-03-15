'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/api'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse text-xl text-gray-500">Đang tải...</div>
    </div>
  )
}
