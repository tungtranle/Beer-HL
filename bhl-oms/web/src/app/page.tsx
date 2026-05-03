'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/api'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const token = getToken()
        if (token) {
          router.replace('/dashboard')
        } else {
          router.replace('/login')
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse text-xl text-gray-500">Đang tải...</div>
    </div>
  )
}
