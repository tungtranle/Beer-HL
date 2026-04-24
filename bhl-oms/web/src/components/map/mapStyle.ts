/**
 * Google Maps-like style for MapLibre GL JS
 * Uses free OpenFreeMap vector tiles (no API key required)
 * Schema: OpenMapTiles (https://openmaptiles.org/schema/)
 *
 * Colors cloned from Google Maps:
 *   Water:    #a8d5f5      Park:     #c8e6c9
 *   Roads:    #fff/#fce8a6  Highway:  #f9a825
 *   Building: #e8e4df      Land:     #f5f5f5
 *   Labels:   #3c4043      Font:     Noto Sans (≈Roboto)
 */

import type { StyleSpecification } from 'maplibre-gl'

export const googleMapsStyle: StyleSpecification = {
  version: 8,
  name: 'BHL Google Maps Style',
  sources: {
    openmaptiles: {
      type: 'vector',
      tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
      maxzoom: 14,
      attribution:
        '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    // ── 1. Background ────────────────────────────────────
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#f5f5f5' },
    },

    // ── 2. Landcover (grass, wood, etc.) ──────────────────
    {
      id: 'landcover-grass',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', 'class', 'grass'],
      paint: { 'fill-color': '#c8e6c9', 'fill-opacity': 0.6 },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', 'class', 'wood'],
      paint: { 'fill-color': '#c8e6c9', 'fill-opacity': 0.5 },
    },

    // ── 3. Landuse (park, residential, commercial) ───────
    {
      id: 'landuse-park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', 'class', 'park', 'cemetery'],
      paint: { 'fill-color': '#c8e6c9', 'fill-opacity': 0.7 },
    },
    {
      id: 'park-fill',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': '#c8e6c9', 'fill-opacity': 0.6 },
    },
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'residential'],
      paint: { 'fill-color': '#f0ede9', 'fill-opacity': 0.5 },
    },
    {
      id: 'landuse-commercial',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', 'class', 'commercial', 'retail'],
      paint: { 'fill-color': '#f5f0e8', 'fill-opacity': 0.5 },
    },
    {
      id: 'landuse-industrial',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'industrial'],
      paint: { 'fill-color': '#eee8e0', 'fill-opacity': 0.5 },
    },

    // ── 4. Water ─────────────────────────────────────────
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#a8d5f5' },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#a8d5f5',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2, 18, 5],
      },
    },

    // ── 5. Buildings ─────────────────────────────────────
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': '#e8e4df',
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.6, 16, 0.8],
      },
    },
    {
      id: 'building-outline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'line-color': '#dcd8d0',
        'line-width': 0.5,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.5],
      },
    },

    // ── 6. Road casings (outlines) ───────────────────────
    // Order: bottom → top (minor → motorway)
    {
      id: 'road-path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'path'], ['!=', 'brunnel', 'tunnel']],
      minzoom: 14,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e0e0e0',
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.5, 18, 2],
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'road-minor-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: [
        'all',
        ['in', 'class', 'tertiary', 'minor', 'service'],
        ['!=', 'brunnel', 'tunnel'],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e0e0e0',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 0.3, 14, 2, 18, 12],
      },
    },
    {
      id: 'road-secondary-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'secondary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e0e0e0',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.8, 12, 3, 18, 16],
      },
    },
    {
      id: 'road-primary-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'primary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e8d090',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 7, 1, 12, 3.5, 18, 18],
      },
    },
    {
      id: 'road-trunk-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'trunk'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e09000',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 1, 12, 4, 18, 20],
      },
    },
    {
      id: 'road-motorway-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'motorway'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#e09000',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 1.2, 12, 5, 18, 22],
      },
    },

    // ── 7. Road fills (on top of casings) ────────────────
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: [
        'all',
        ['in', 'class', 'tertiary', 'minor', 'service'],
        ['!=', 'brunnel', 'tunnel'],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 0.1, 14, 1.5, 18, 10],
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'secondary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.4, 12, 2.5, 18, 14],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'primary'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#fce8a6',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 7, 0.6, 12, 3, 18, 16],
      },
    },
    {
      id: 'road-trunk',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'trunk'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#f9a825',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.6, 12, 3.5, 18, 18],
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'class', 'motorway'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#f9a825',
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.8, 12, 4, 18, 20],
      },
    },

    // ── 8. Rail ──────────────────────────────────────────
    {
      id: 'rail',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', 'class', 'rail'],
      minzoom: 10,
      paint: {
        'line-color': '#bdbdbd',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 1.5],
        'line-dasharray': [4, 3],
      },
    },

    // ── 9. Boundaries ────────────────────────────────────
    {
      id: 'boundary-country',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['==', 'admin_level', 2],
      paint: { 'line-color': '#9e9e9e', 'line-width': 1.5, 'line-dasharray': [3, 2] },
    },
    {
      id: 'boundary-state',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['==', 'admin_level', 4],
      paint: { 'line-color': '#bdbdbd', 'line-width': 0.8, 'line-dasharray': [2, 2] },
    },

    // ── 10. Labels ───────────────────────────────────────
    // Road labels
    {
      id: 'road-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 13],
        'text-max-angle': 30,
      },
      paint: { 'text-color': '#3c4043', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    },
    // Water labels
    {
      id: 'water-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Italic'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 14],
      },
      paint: { 'text-color': '#6d9bc3', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    },
    // Place labels — country
    {
      id: 'place-country',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'country'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 12, 6, 18],
      },
      paint: { 'text-color': '#3c4043', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    },
    // Place labels — state
    {
      id: 'place-state',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'state'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 14],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': '#8c8c8c', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    },
    // Place labels — city
    {
      id: 'place-city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'city'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 12, 18],
      },
      paint: { 'text-color': '#3c4043', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    },
    // Place labels — town
    {
      id: 'place-town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'town'],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 15],
      },
      paint: { 'text-color': '#3c4043', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    },
    // Place labels — village
    {
      id: 'place-village',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'village'],
      minzoom: 10,
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 13],
      },
      paint: { 'text-color': '#3c4043', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    },
    // Place labels — suburb / neighbourhood
    {
      id: 'place-suburb',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', 'class', 'suburb', 'neighbourhood'],
      minzoom: 12,
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
      },
      paint: { 'text-color': '#8c8c8c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    },
  ],
}

// ── Satellite style using Esri World Imagery (free, no API key) ─────────────
export const satelliteStyle: StyleSpecification = {
  version: 8,
  name: 'BHL Satellite',
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    },
    labels: {
      type: 'vector',
      tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
      maxzoom: 14,
    },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'satellite-bg',
      type: 'raster',
      source: 'satellite',
      paint: { 'raster-opacity': 1 },
    },
    // Road labels on top of satellite
    {
      id: 'sat-road-label',
      type: 'symbol',
      source: 'labels',
      'source-layer': 'transportation_name',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.6)',
        'text-halo-width': 1.5,
      },
    },
    // Place labels
    {
      id: 'sat-place-label',
      type: 'symbol',
      source: 'labels',
      'source-layer': 'place',
      filter: ['in', 'class', 'city', 'town', 'village'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 16],
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.7)',
        'text-halo-width': 2,
      },
    },
  ],
}
