'use client'

import MapView from '@/components/map/MapView'
import type { MapMarker, MapRoute } from '@/components/map/MapView'

/**
 * Demo page for the Google Maps-like MapView component.
 * Navigate to /dashboard/map-demo to see it in action.
 */

// Sample markers around Hải Phòng
const demoMarkers: MapMarker[] = [
  {
    id: 'depot',
    lat: 20.8561,
    lng: 106.6822,
    type: 'teardrop',
    color: '#EA4335',
    label: 'Kho BHL',
    popupHTML: `
      <div>
        <div style="font-size:14px;font-weight:600;color:#202124"> Kho Bia Hạ Long</div>
        <div style="font-size:12px;color:#5f6368;margin-top:4px">228 Lạch Tray, Ngô Quyền, HP</div>
      </div>`,
  },
  {
    id: 'truck-1',
    lat: 20.870,
    lng: 106.700,
    type: 'arrow',
    color: '#22c55e',
    heading: 45,
    label: '29C-123.45',
    popupHTML: `
      <div>
        <div style="font-weight:600"> 29C-123.45</div>
        <div style="font-size:12px;color:#5f6368">Tài xế: Nguyễn Văn A</div>
        <div style="font-size:12px;color:#16a34a">Đang giao • 42 km/h</div>
      </div>`,
  },
  {
    id: 'truck-2',
    lat: 20.840,
    lng: 106.660,
    type: 'arrow',
    color: '#f59e0b',
    heading: 180,
    label: '15B-456.78',
    popupHTML: `
      <div>
        <div style="font-weight:600"> 15B-456.78</div>
        <div style="font-size:12px;color:#5f6368">Tài xế: Trần Văn B</div>
        <div style="font-size:12px;color:#d97706">Dừng nghỉ • 0 km/h</div>
      </div>`,
  },
  {
    id: 'truck-3',
    lat: 20.880,
    lng: 106.650,
    type: 'arrow',
    color: '#ef4444',
    heading: 270,
    label: '30F-789.01',
    pulseColor: 'rgba(239,68,68,.3)',
    popupHTML: `
      <div>
        <div style="font-weight:600"> 30F-789.01</div>
        <div style="font-size:12px;color:#5f6368">Tài xế: Lê Văn C</div>
        <div style="font-size:12px;color:#dc2626;font-weight:700">⚠ Lệch tuyến 1.5km</div>
      </div>`,
  },
  {
    id: 'stop-1',
    lat: 20.850,
    lng: 106.710,
    type: 'numbered',
    number: 1,
    color: '#4285F4',
  },
  {
    id: 'stop-2',
    lat: 20.865,
    lng: 106.720,
    type: 'numbered',
    number: 2,
    color: '#4285F4',
  },
  {
    id: 'stop-3',
    lat: 20.875,
    lng: 106.715,
    type: 'numbered',
    number: 3,
    color: '#34a853',
  },
]

// Sample route
const demoRoutes: MapRoute[] = [
  {
    id: 'route-1',
    coordinates: [
      [20.8561, 106.6822],
      [20.855, 106.690],
      [20.852, 106.700],
      [20.850, 106.710],
      [20.858, 106.715],
      [20.865, 106.720],
      [20.872, 106.718],
      [20.875, 106.715],
    ],
    color: '#4285F4',
    width: 4,
  },
]

export default function MapDemoPage() {
  return (
    <div className="h-screen w-screen">
      <MapView
        center={[20.86, 106.68]}
        zoom={13}
        markers={demoMarkers}
        routes={demoRoutes}
        onMapClick={(latlng) => console.log('Click:', latlng)}
        onMarkerClick={(m) => console.log('Marker click:', m.id)}
      />
    </div>
  )
}
