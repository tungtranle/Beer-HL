/**
 * MapView — Google Maps-like map component built on MapLibre GL JS
 *
 * Features:
 *   • Google Maps color scheme (via custom vector style)
 *   • Search bar with Nominatim geocoding
 *   • Zoom +/- controls, My Location, Compass, Scale bar
 *   • Click-to-place teardrop marker with coordinate popup
 *   • Imperative API via ref for markers, routes, flyTo
 *   • Smooth animations throughout
 *
 * Usage:
 *   <MapView center={[20.86, 106.68]} zoom={12} />
 *   <MapView ref={mapRef} markers={[...]} routes={[...]} />
 */
'use client'

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type CSSProperties,
} from 'react'
import { googleMapsStyle, satelliteStyle } from './mapStyle'

// ── Public types ─────────────────────────────────────────

export interface MapMarker {
  id: string
  lat: number
  lng: number
  /** Marker colour — default red for teardrop, green for arrow */
  color?: string
  /** Small text label above marker */
  label?: string
  /** HTML string for the popup */
  popupHTML?: string
  /** Heading in degrees (0-360) — only for 'arrow' type */
  heading?: number
  /** 'teardrop' (Google pin) | 'arrow' (vehicle) | 'dot' | 'numbered' */
  type?: 'teardrop' | 'arrow' | 'dot' | 'numbered'
  /** Display number inside a circle — only for 'numbered' type */
  number?: number
  /** Fully custom HTML for the marker element */
  html?: string
  /** If set, renders a pulsing ring of this colour around the marker */
  pulseColor?: string
}

export interface MapRoute {
  id: string
  /** Array of [lat, lng] coordinate pairs */
  coordinates: [number, number][]
  color?: string
  width?: number
  dashArray?: number[]
  opacity?: number
}

export interface MapViewProps {
  /** Map center as [lat, lng] — default Hải Phòng */
  center?: [number, number]
  zoom?: number
  className?: string
  showSearchBar?: boolean
  showZoomControls?: boolean
  showMyLocation?: boolean
  showScaleBar?: boolean
  /** Show a teardrop marker on click with lat/lng popup */
  enableClickMarker?: boolean
  markers?: MapMarker[]
  routes?: MapRoute[]
  onMapClick?: (latlng: { lat: number; lng: number }) => void
  onMarkerClick?: (marker: MapMarker) => void
  /** React children rendered as an overlay above the map */
  children?: React.ReactNode
  /** Show Street View (Pegman) button — opens Google Maps Street View at current center */
  showStreetView?: boolean
  /** Show Map / Satellite toggle pill at bottom-left */
  showMapTypePill?: boolean
}

export interface MapViewRef {
  getMap(): maplibregl.Map | null
  flyTo(lat: number, lng: number, zoom?: number): void
  fitBounds(bounds: [[number, number], [number, number]]): void
  addMarker(marker: MapMarker): void
  removeMarker(id: string): void
  clearMarkers(): void
  addRoute(route: MapRoute): void
  removeRoute(id: string): void
  clearRoutes(): void
  resize(): void
}

// ── We lazily import maplibre-gl to avoid SSR issues ─────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MaplibreGL = typeof import('maplibre-gl')
let _mlgl: MaplibreGL | null = null
async function getMaplibre(): Promise<MaplibreGL> {
  if (!_mlgl) _mlgl = await import('maplibre-gl')
  return _mlgl
}

// ── SVG marker generators ────────────────────────────────

/** Classic Google Maps teardrop pin */
function teardropSVG(color = '#EA4335') {
  return `<svg width="27" height="43" viewBox="0 0 27 43" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="ts"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/></filter></defs>
    <path d="M13.5 0C6.044 0 0 6.044 0 13.5 0 23.625 13.5 43 13.5 43S27 23.625 27 13.5C27 6.044 20.956 0 13.5 0Z"
          fill="${color}" filter="url(#ts)"/>
    <circle cx="13.5" cy="13.5" r="5" fill="white"/>
  </svg>`
}

/** Directional arrow for vehicles — rotated via CSS transform */
function arrowSVG(color = '#22c55e', heading = 0) {
  return `<svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
    style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));transform:rotate(${heading}deg)">
    <path d="M12 2 L5 20 L12 15 L19 20 Z" fill="${color}" stroke="#fff"
          stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`
}

/** Simple coloured dot */
function dotSVG(color = '#4285F4') {
  return `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" fill="${color}" stroke="#fff" stroke-width="2"
            style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))"/>
  </svg>`
}

/** Numbered circle (for trip stops) */
function numberedSVG(n: number, color = '#4285F4') {
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"
    style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.3))">
    <circle cx="14" cy="14" r="13" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="14" y="14" text-anchor="middle" dominant-baseline="central"
          fill="#fff" font-family="Roboto,sans-serif" font-size="12" font-weight="700">${n}</text>
  </svg>`
}

// ── Pulse animation keyframes (injected once) ────────────
let pulseInjected = false
function injectPulseCSS() {
  if (pulseInjected || typeof document === 'undefined') return
  // Roboto from Google Fonts
  if (!document.getElementById('bhl-roboto-font')) {
    const link = document.createElement('link')
    link.id = 'bhl-roboto-font'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap'
    document.head.appendChild(link)
  }
  const style = document.createElement('style')
  style.textContent = `
    @keyframes bhl-map-pulse {
      0%   { transform:scale(1); opacity:.6 }
      100% { transform:scale(2.2); opacity:0 }
    }
    .bhl-pulse-ring {
      position:absolute; top:-6px; left:-6px; width:40px; height:40px;
      border-radius:50%; pointer-events:none;
      animation: bhl-map-pulse 1.5s cubic-bezier(0,0,.2,1) infinite;
    }
    /* Google-Maps-style popup override */
    .maplibregl-popup-content {
      padding:12px 16px !important; border-radius:8px !important;
      box-shadow:0 2px 12px rgba(0,0,0,.15) !important;
      font-family:Roboto,'Noto Sans',sans-serif; font-size:13px; color:#3c4043;
    }
    .maplibregl-popup-close-button {
      font-size:18px; color:#5f6368; padding:4px 8px;
    }
    .maplibregl-popup-close-button:hover { color:#202124; background:rgba(0,0,0,.04); border-radius:50%; }
    .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color:#fff; }
    /* Search autocomplete */
    .bhl-search-results { position:absolute; top:100%; left:0; right:0; background:#fff;
      border-radius:0 0 24px 24px; box-shadow:0 4px 12px rgba(0,0,0,.15);
      max-height:300px; overflow-y:auto; z-index:10; }
    .bhl-search-item { padding:10px 16px; cursor:pointer; font-size:13px; color:#3c4043;
      display:flex; align-items:center; gap:10px; transition:background .15s; }
    .bhl-search-item:hover { background:#f1f3f4; }
    .bhl-search-item:last-child { border-radius:0 0 24px 24px; }
    /* Google Maps control button hover */
    .bhl-map-btn:hover { background:#f5f5f5 !important; }
    .bhl-map-btn:active { background:#ebebeb !important; }
    /* Map/Satellite pill hover */
    .bhl-maptoggle-btn:hover { filter:brightness(0.95); }
  `
  document.head.appendChild(style)
  pulseInjected = true
}

// ── Nominatim geocoding ──────────────────────────────────
interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

async function geocode(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return []
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=vi`
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}

// ── Helper: create a DOM element for a MapMarker ─────────
function createMarkerElement(m: MapMarker): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:relative;cursor:pointer;transition:transform .15s;'
  wrap.onmouseenter = () => { wrap.style.transform = 'scale(1.12)' }
  wrap.onmouseleave = () => { wrap.style.transform = 'scale(1)' }

  // Pulse ring
  if (m.pulseColor) {
    const ring = document.createElement('div')
    ring.className = 'bhl-pulse-ring'
    ring.style.background = m.pulseColor.replace(')', ',.25)').replace('rgb', 'rgba')
      || `rgba(239,68,68,.25)`
    wrap.appendChild(ring)
  }

  // Label above marker
  if (m.label) {
    const lbl = document.createElement('div')
    lbl.style.cssText = `position:absolute;top:-18px;left:50%;transform:translateX(-50%);
      white-space:nowrap;background:${m.color || '#333'};color:#fff;font-size:9px;
      font-weight:700;padding:1px 5px;border-radius:8px;
      box-shadow:0 1px 3px rgba(0,0,0,.25);letter-spacing:.3px;line-height:13px;
      font-family:Roboto,sans-serif;`
    lbl.textContent = m.label
    wrap.appendChild(lbl)
  }

  // Marker body
  if (m.html) {
    wrap.innerHTML += m.html
  } else {
    const body = document.createElement('div')
    switch (m.type) {
      case 'arrow':
        body.innerHTML = arrowSVG(m.color || '#22c55e', m.heading || 0)
        break
      case 'dot':
        body.innerHTML = dotSVG(m.color || '#4285F4')
        break
      case 'numbered':
        body.innerHTML = numberedSVG(m.number ?? 0, m.color || '#4285F4')
        break
      case 'teardrop':
      default:
        body.innerHTML = teardropSVG(m.color || '#EA4335')
        break
    }
    wrap.appendChild(body)
  }

  return wrap
}

// ── Anchor offset per marker type ────────────────────────
function markerAnchor(m: MapMarker): [number, number] {
  switch (m.type) {
    case 'teardrop': return [13.5, 43]  // bottom center of teardrop
    case 'arrow':    return [14, 14]    // center of arrow
    case 'dot':      return [7, 7]
    case 'numbered': return [14, 14]
    default:         return [13.5, 43]
  }
}

// ══════════════════════════════════════════════════════════
//  MapView Component
// ══════════════════════════════════════════════════════════

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView(props, ref) {
  const {
    center = [20.86, 106.68],
    zoom = 12,
    className = '',
    showSearchBar = true,
    showZoomControls = true,
    showMyLocation = true,
    showScaleBar = true,
    enableClickMarker = true,
    markers: propMarkers,
    routes: propRoutes,
    onMapClick,
    onMarkerClick,
    children,
    showStreetView = true,
    showMapTypePill = true,
  } = props

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mlglRef = useRef<MaplibreGL | null>(null)
  // Managed markers: id → maplibregl.Marker instance
  const markersMap = useRef<Map<string, maplibregl.Marker>>(new Map())
  // Click marker + popup
  const clickMarker = useRef<maplibregl.Marker | null>(null)
  const clickPopup = useRef<maplibregl.Popup | null>(null)

  // UI state
  const [bearing, setBearing] = useState(0)
  const [locating, setLocating] = useState(false)
  const [mapType, setMapType] = useState<'map' | 'satellite'>('map')
  const mapCenterRef = useRef<[number, number]>(center)
  // Keep propRoutes in a ref so the style-switch effect can re-add them
  const propRoutesRef = useRef(propRoutes)
  propRoutesRef.current = propRoutes
  // Skip setStyle on first render (map is initialised with the correct style)
  const mapTypeInitRef = useRef(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  // ── Imperative API ───────────────────────────────────
  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    flyTo: (lat, lng, z) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: z, duration: 800 })
    },
    fitBounds: (bounds) => {
      const [[s, w], [n, e]] = bounds
      mapRef.current?.fitBounds([w, s, e, n], { padding: 60, duration: 800 })
    },
    addMarker: (m) => addMarkerToMap(m),
    removeMarker: (id) => removeMarkerFromMap(id),
    clearMarkers: () => clearAllMarkers(),
    addRoute: (r) => addRouteToMap(r),
    removeRoute: (id) => removeRouteFromMap(id),
    clearRoutes: () => clearAllRoutes(),
    resize: () => mapRef.current?.resize(),
  }))

  // ── Marker helpers ───────────────────────────────────
  const addMarkerToMap = useCallback((m: MapMarker) => {
    if (!mapRef.current || !mlglRef.current) return
    // Remove existing marker with same id
    markersMap.current.get(m.id)?.remove()

    const el = createMarkerElement(m)
    const anchor = markerAnchor(m)
    const marker = new mlglRef.current.Marker({ element: el, anchor: 'top-left', offset: [-anchor[0], -anchor[1]] })
      .setLngLat([m.lng, m.lat])
      .addTo(mapRef.current)

    if (m.popupHTML) {
      const popup = new mlglRef.current.Popup({ offset: [0, -anchor[1] - 4], maxWidth: '280px' })
        .setHTML(m.popupHTML)
      marker.setPopup(popup)
    }

    if (onMarkerClick) {
      el.addEventListener('click', () => onMarkerClick(m))
    }

    markersMap.current.set(m.id, marker)
  }, [onMarkerClick])

  const removeMarkerFromMap = useCallback((id: string) => {
    markersMap.current.get(id)?.remove()
    markersMap.current.delete(id)
  }, [])

  const clearAllMarkers = useCallback(() => {
    markersMap.current.forEach(m => m.remove())
    markersMap.current.clear()
  }, [])

  // ── Route helpers ────────────────────────────────────
  const addRouteToMap = useCallback((r: MapRoute) => {
    const map = mapRef.current
    if (!map) return
    const srcId = `route-src-${r.id}`
    const layerId = `route-layer-${r.id}`

    // Remove existing
    if (map.getLayer(layerId)) map.removeLayer(layerId)
    if (map.getSource(srcId)) map.removeSource(srcId)

    // Convert [lat,lng] → [lng,lat] for GeoJSON
    const coords = r.coordinates.map(([lat, lng]) => [lng, lat])

    map.addSource(srcId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    })

    map.addLayer({
      id: layerId,
      type: 'line',
      source: srcId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': r.color || '#4285F4',
        'line-width': r.width || 4,
        'line-opacity': r.opacity ?? 0.85,
        ...(r.dashArray ? { 'line-dasharray': r.dashArray } : {}),
      },
    })
  }, [])

  const removeRouteFromMap = useCallback((id: string) => {
    const map = mapRef.current
    if (!map) return
    const layerId = `route-layer-${id}`
    const srcId = `route-src-${id}`
    if (map.getLayer(layerId)) map.removeLayer(layerId)
    if (map.getSource(srcId)) map.removeSource(srcId)
  }, [])

  const clearAllRoutes = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const style = map.getStyle()
    style.layers.forEach(l => {
      if (l.id.startsWith('route-layer-')) map.removeLayer(l.id)
    })
    Object.keys(style.sources).forEach(s => {
      if (s.startsWith('route-src-')) map.removeSource(s)
    })
  }, [])

  // ── Initialize map ───────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    let cancelled = false

    const init = async () => {
      const mlgl = await getMaplibre()
      if (cancelled || !containerRef.current) return
      mlglRef.current = mlgl
      injectPulseCSS()

      const map = new mlgl.Map({
        container: containerRef.current,
        style: googleMapsStyle as maplibregl.StyleSpecification,
        center: [center[1], center[0]], // MapLibre uses [lng, lat]
        zoom,
        attributionControl: false,
        maxZoom: 19,
        fadeDuration: 200,
      })

      mapRef.current = map

      // Scale bar (bottom-left)
      if (showScaleBar) {
        map.addControl(new mlgl.ScaleControl({ unit: 'metric' }), 'bottom-left')
      }

      // Track bearing for compass
      map.on('rotate', () => setBearing(map.getBearing()))
      // Track center for Street View
      map.on('moveend', () => {
        const c = map.getCenter()
        mapCenterRef.current = [c.lat, c.lng]
      })

      // Click-to-place marker
      if (enableClickMarker) {
        map.on('click', (e) => {
          const { lat, lng } = e.lngLat
          onMapClick?.({ lat, lng })

          // Remove previous click marker
          clickMarker.current?.remove()
          clickPopup.current?.remove()

          // Create teardrop marker at click location
          const el = document.createElement('div')
          el.innerHTML = teardropSVG('#EA4335')
          el.style.cssText = 'cursor:pointer;transition:transform .2s;'
          el.style.animation = 'none'
          // Drop-in animation
          el.style.transform = 'translateY(-20px) scale(0.5)'
          requestAnimationFrame(() => {
            el.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1)'
            el.style.transform = 'translateY(0) scale(1)'
          })

          const popup = new mlgl.Popup({ offset: [0, -43], maxWidth: '240px', closeButton: true })
            .setHTML(`
              <div style="font-family:Roboto,'Noto Sans',sans-serif">
                <div style="font-size:14px;font-weight:500;color:#202124;margin-bottom:6px">
                   Vị trí đã chọn
                </div>
                <div style="font-size:12px;color:#5f6368;line-height:1.6">
                  <div>Lat: <b>${lat.toFixed(6)}</b></div>
                  <div>Lng: <b>${lng.toFixed(6)}</b></div>
                </div>
              </div>
            `)

          const marker = new mlgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map)

          popup.addTo(map)
          clickMarker.current = marker
          clickPopup.current = popup
        })
      }

      // Settle layout
      setTimeout(() => { if (!cancelled) map.resize() }, 0)
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersMap.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync prop markers ────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mlglRef.current || !propMarkers) return

    // Remove markers no longer in props
    const propIds = new Set(propMarkers.map(m => m.id))
    markersMap.current.forEach((_, id) => {
      if (!propIds.has(id)) removeMarkerFromMap(id)
    })

    // Add / update prop markers
    propMarkers.forEach(m => addMarkerToMap(m))
  }, [propMarkers, addMarkerToMap, removeMarkerFromMap])

  // ── Sync prop routes ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !propRoutes) return

    // Wait for style to load
    const syncRoutes = () => {
      propRoutes.forEach(r => addRouteToMap(r))
    }

    if (mapRef.current.isStyleLoaded()) {
      syncRoutes()
    } else {
      mapRef.current.once('styledata', syncRoutes)
    }
  }, [propRoutes, addRouteToMap])

  // ── Search handler ───────────────────────────────────
  const handleSearch = useCallback((text: string) => {
    setSearchText(text)
    clearTimeout(searchTimeout.current)
    if (!text.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    searchTimeout.current = setTimeout(async () => {
      const results = await geocode(text)
      setSearchResults(results)
      setSearchOpen(results.length > 0)
    }, 350)
  }, [])

  const handleSearchSelect = useCallback((r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 })
    setSearchText(r.display_name.split(',')[0])
    setSearchOpen(false)
    setSearchResults([])
  }, [])

  // ── Zoom ─────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 300 })
  }, [])

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 300 })
  }, [])

  // ── My Location ──────────────────────────────────────
  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000 })

        // Place a blue dot at user location
        if (mlglRef.current && mapRef.current) {
          // Remove existing location marker
          removeMarkerFromMap('__my_location__')
          addMarkerToMap({
            id: '__my_location__',
            lat: latitude,
            lng: longitude,
            type: 'dot',
            color: '#4285F4',
            pulseColor: 'rgba(66,133,244,.3)',
          })
        }
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [addMarkerToMap, removeMarkerFromMap])

  // ── Reset compass ────────────────────────────────────
  const handleResetNorth = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 })
  }, [])

  // ── Street View ──────────────────────────────────────
  const handleStreetView = useCallback(() => {
    const [lat, lng] = mapCenterRef.current
    window.open(
      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [])

  // ── Switch between map and satellite style ───────────
  useEffect(() => {
    if (!mapTypeInitRef.current) {
      mapTypeInitRef.current = true
      return
    }
    const map = mapRef.current
    if (!map) return
    const style = mapType === 'satellite' ? satelliteStyle : googleMapsStyle
    map.setStyle(style as maplibregl.StyleSpecification)
    // Re-add routes after the new style loads
    map.once('styledata', () => {
      propRoutesRef.current?.forEach(r => addRouteToMap(r))
    })
  }, [mapType, addRouteToMap])

  // ── Styles for controls (Google Maps clone) ──────────
  const controlBtn: CSSProperties = {
    width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, color: '#666',
    transition: 'background .15s, color .15s, box-shadow .15s',
    fontFamily: 'Roboto, sans-serif',
  }

  const controlShadow = '0 2px 6px rgba(0,0,0,0.3)'

  return (
    <div className={`relative w-full h-full ${className}`} style={{ fontFamily: 'Roboto, "Noto Sans", sans-serif' }}>
      {/* ── Map container ─────────────────────────────── */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* ── Search bar ────────────────────────────────── */}
      {showSearchBar && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10" style={{ width: 'min(480px, calc(100% - 24px))' }}>
          <div className="relative">
            <div
              className="flex items-center bg-white rounded-full overflow-hidden"
              style={{ boxShadow: controlShadow, transition: 'box-shadow .2s' }}
            >
              {/* Search icon */}
              <div className="pl-4 pr-2 text-gray-400 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
              </div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                placeholder="Tìm kiếm trên bản đồ"
                className="flex-1 py-3 pr-4 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
                style={{ fontFamily: 'inherit' }}
              />
              {searchText && (
                <button
                  onClick={() => { setSearchText(''); setSearchResults([]); setSearchOpen(false) }}
                  className="pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div className="bhl-search-results">
                {searchResults.map((r, i) => (
                  <div key={i} className="bhl-search-item" onMouseDown={() => handleSearchSelect(r)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" className="flex-shrink-0">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                    <span className="truncate">{r.display_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Compass (visible when rotated) ────────────── */}
      {bearing !== 0 && (
        <button
          onClick={handleResetNorth}
          className="absolute top-3 right-3 z-10 rounded-full bhl-map-btn"
          style={{ ...controlBtn, borderRadius: '50%', boxShadow: controlShadow }}
          title="Quay về hướng Bắc"
        >
          <svg
            width="22" height="22" viewBox="0 0 22 22"
            style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform .3s ease' }}
          >
            {/* North arrow — red triangle pointing up */}
            <polygon points="11,2 7,12 11,10 15,12" fill="#EA4335" />
            {/* South arrow — gray */}
            <polygon points="11,20 7,12 11,14 15,12" fill="#9aa0a6" />
          </svg>
        </button>
      )}

      {/* ── Right-side controls: Street View + Zoom + My Location ──── */}
      {(showZoomControls || showMyLocation || showStreetView) && (
        <div className="absolute bottom-24 right-3 z-10 flex flex-col gap-2">
          {/* Street View (Pegman) */}
          {showStreetView && (
            <button
              onClick={handleStreetView}
              className="bhl-map-btn rounded-lg"
              style={{ ...controlBtn, borderRadius: 8, boxShadow: controlShadow }}
              title="Xem Street View trên Google Maps"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="4" r="3" fill="#FBBC04"/>
                <path d="M6.5 9 Q10 7.5 13.5 9 L13 18 H11 L10 15 L9 18 H7 Z" fill="#FBBC04"/>
                <path d="M6.5 9 L5 13 M13.5 9 L15 13" stroke="#FBBC04" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Zoom +/- */}
          {showZoomControls && (
            <div
              className="flex flex-col rounded-lg overflow-hidden"
              style={{ boxShadow: controlShadow }}
            >
              <button
                onClick={handleZoomIn}
                style={{ ...controlBtn, borderBottom: '1px solid #e8eaed' }}
                className="bhl-map-btn"
                title="Phóng to"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
                  <line x1="9" y1="3" x2="9" y2="15" />
                  <line x1="3" y1="9" x2="15" y2="9" />
                </svg>
              </button>
              <button
                onClick={handleZoomOut}
                style={controlBtn}
                className="bhl-map-btn"
                title="Thu nhỏ"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="9" x2="15" y2="9" />
                </svg>
              </button>
            </div>
          )}

          {/* My Location */}
          {showMyLocation && (
            <button
              onClick={handleMyLocation}
              className="rounded-full bhl-map-btn"
              style={{
                ...controlBtn,
                borderRadius: '50%',
                boxShadow: controlShadow,
                position: 'relative',
              }}
              title="Vị trí của tôi"
            >
              {/* GPS crosshair icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={locating ? '#4285F4' : '#666'} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
              {/* Pulse ring when locating */}
              {locating && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '2px solid #4285F4',
                    animation: 'bhl-map-pulse 1.2s ease-out infinite',
                  }}
                />
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Map / Satellite toggle pill ───────────────── */}
      {showMapTypePill && (
        <div
          className="absolute z-10 flex rounded-lg overflow-hidden"
          style={{ boxShadow: controlShadow, bottom: 32, left: 8 }}
        >
          <button
            onClick={() => setMapType('map')}
            className="bhl-maptoggle-btn"
            style={{
              padding: '7px 13px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'Roboto, sans-serif',
              background: mapType === 'map' ? '#4285F4' : '#fff',
              color: mapType === 'map' ? '#fff' : '#3c4043',
              border: 'none',
              cursor: 'pointer',
              borderRight: '1px solid rgba(0,0,0,0.08)',
              transition: 'background .2s, color .2s',
            }}
            title="Bản đồ thường"
          >
            Bản đồ
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className="bhl-maptoggle-btn"
            style={{
              padding: '7px 13px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'Roboto, sans-serif',
              background: mapType === 'satellite' ? '#4285F4' : '#fff',
              color: mapType === 'satellite' ? '#fff' : '#3c4043',
              border: 'none',
              cursor: 'pointer',
              transition: 'background .2s, color .2s',
            }}
            title="Ảnh vệ tinh"
          >
            Vệ tinh
          </button>
        </div>
      )}

      {/* ── Overlay children ──────────────────────────── */}
      {children}
    </div>
  )
})

export default MapView
