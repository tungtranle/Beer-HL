'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { getToken } from '@/lib/api'
// Self-hosted leaflet CSS — bundled locally (no cross-origin round-trip)
import 'leaflet/dist/leaflet.css'

interface VehiclePosition {
  vehicle_id: string
  vehicle_plate?: string
  driver_name?: string
  trip_status?: string
  lat: number
  lng: number
  speed: number
  heading: number
  ts: string
}

const statusColors: Record<string, string> = {
  moving: '#22c55e',   // green
  idle: '#f59e0b',     // amber
  offline: '#9ca3af',  // gray
}

export default function DispatcherMapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const wsRef = useRef<WebSocket | null>(null)
  const [vehicles, setVehicles] = useState<Map<string, VehiclePosition>>(new Map())
  const [connected, setConnected] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (mapRef.current) return

      const map = L.map(mapContainerRef.current!, {
        center: [20.86, 106.68], // Hải Phòng area (BHL HQ)
        zoom: 12,
      })

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map)

      mapRef.current = map
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update markers when vehicles change
  const updateMarkers = useCallback(async (positions: Map<string, VehiclePosition>) => {
    if (!mapRef.current) return
    const L = (await import('leaflet')).default

    positions.forEach((pos, vehicleId) => {
      const isMoving = pos.speed > 2
      const color = isMoving ? statusColors.moving : statusColors.idle

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 32px; height: 32px;
          background: ${color}; border: 2px solid white;
          border-radius: 50%; display: flex;
          align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          font-size: 14px; color: white;
          transform: rotate(${pos.heading || 0}deg);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const existingMarker = markersRef.current.get(vehicleId)
      const tripLabel = pos.trip_status === 'in_transit' ? 'Đang giao hàng' : pos.trip_status === 'planned' ? 'Chờ xuất phát' : pos.trip_status === 'started' ? 'Đã xuất phát' : ''
      const popupContent = `
        <div style="min-width:180px">
          <b style="font-size:14px">${pos.vehicle_plate || vehicleId}</b><br/>
          <span style="color:#555"> ${pos.driver_name || 'Chưa xác định'}</span><br/>
          ${tripLabel ? `<span style="color:#2563eb"> ${tripLabel}</span><br/>` : ''}
          <span style="color:#666"> ${pos.speed?.toFixed(1) || 0} km/h</span><br/>
          <span style="color:#999;font-size:11px"> ${pos.ts ? new Date(pos.ts).toLocaleTimeString('vi-VN') : '--'}</span>
        </div>
      `
      if (existingMarker) {
        existingMarker.setLatLng([pos.lat, pos.lng])
        existingMarker.setIcon(icon)
        existingMarker.setPopupContent(popupContent)
      } else {
        const marker = L.marker([pos.lat, pos.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(popupContent)
        marker.on('click', () => setSelectedVehicle(vehicleId))
        markersRef.current.set(vehicleId, marker)
      }
    })
  }, [])

  // Connect WebSocket for real-time updates
  useEffect(() => {
    const token = getToken()
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.port === '3000'
      ? `${window.location.hostname}:8080`
      : window.location.host
    const wsUrl = `${protocol}//${wsHost}/ws/gps?token=${token}`

    const connect = () => {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.vehicle_id) {
            setVehicles(prev => {
              const updated = new Map(prev)
              updated.set(data.vehicle_id, data)
              return updated
            })
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        setConnected(false)
        // Reconnect after 3 seconds
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  // Update markers when vehicles map changes
  useEffect(() => {
    updateMarkers(vehicles)
  }, [vehicles, updateMarkers])

  // Also poll REST endpoint as fallback
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res: any = await (await fetch('/v1/gps/latest', {
          headers: { Authorization: `Bearer ${getToken()}` }
        })).json()
        if (res.data) {
          const posMap = new Map<string, VehiclePosition>()
          Object.entries(res.data).forEach(([vehicleId, posData]: [string, any]) => {
            try {
              const pos = typeof posData === 'string' ? JSON.parse(posData) : posData
              posMap.set(vehicleId, {
                vehicle_id: pos.vehicle_id || vehicleId,
                vehicle_plate: pos.vehicle_plate || undefined,
                driver_name: pos.driver_name || undefined,
                trip_status: pos.trip_status || undefined,
                lat: pos.lat,
                lng: pos.lng,
                speed: pos.speed,
                heading: pos.heading,
                ts: pos.ts,
              })
            } catch { /* ignore */ }
          })
          setVehicles(prev => {
            const merged = new Map(prev)
            posMap.forEach((v, k) => {
              if (!merged.has(k)) merged.set(k, v)
            })
            return merged
          })
        }
      } catch { /* ignore REST errors */ }
    }

    fetchPositions()
    const interval = setInterval(fetchPositions, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/trips" className="text-xl">←</Link>
          <h1 className="text-lg font-bold"> Bản đồ điều phối</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">
            {connected ? 'Live' : 'Đang kết nối...'}
          </span>
          <span className="text-sm font-medium text-blue-600">{vehicles.size} xe</span>
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainerRef} className="flex-1" style={{ minHeight: 400 }} />

      {/* Vehicle list sidebar (bottom panel on mobile) */}
      <div className="bg-white border-t max-h-48 overflow-y-auto">
        <div className="p-2 space-y-1">
          {Array.from(vehicles.values()).map(v => (
            <div key={v.vehicle_id}
              onClick={() => {
                setSelectedVehicle(v.vehicle_id)
                const marker = markersRef.current.get(v.vehicle_id)
                if (marker && mapRef.current) {
                  mapRef.current.setView([v.lat, v.lng], 15)
                  marker.openPopup()
                }
              }}
              className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                selectedVehicle === v.vehicle_id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
              }`}>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${v.speed > 2 ? 'bg-green-500' : 'bg-amber-500'}`} />
                <div>
                  <span className="font-medium text-sm">{v.vehicle_plate || v.vehicle_id}</span>
                  {v.driver_name && <span className="text-xs text-gray-500 ml-2"> {v.driver_name}</span>}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">{v.speed?.toFixed(0) || 0} km/h</span>
                {v.trip_status && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                    v.trip_status === 'in_transit' ? 'bg-green-100 text-green-700' :
                    v.trip_status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {v.trip_status === 'in_transit' ? 'Đang giao' : v.trip_status === 'planned' ? 'Chờ giao' : v.trip_status}
                  </span>
                )}
              </div>
            </div>
          ))}
          {vehicles.size === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">Chưa có xe nào đang hoạt động</p>
          )}
        </div>
      </div>
    </div>
  )
}
