/**
 * Nominatim (OpenStreetMap) — uso razoável: debounce, cache em sessão, User-Agent identificável.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

import type { GeocodeHit, GeocodingPort } from './GeocodingPort'

export type { GeocodeHit } from './GeocodingPort'

/** Identifique a app; ajuste contato em produção se a OSM solicitar. */
const USER_AGENT = 'gestao-mw-publi/1.0 (panel admin geocoding)'

const forwardCache = new Map<string, GeocodeHit | null>()
const reverseCache = new Map<string, string | null>()

function cacheKeyReverse(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}

export function buildPanelAddressQuery(parts: {
  address_line1: string
  city: string
  state: string
  postal_code: string
}): string {
  const bits = [
    parts.address_line1.trim(),
    parts.city.trim(),
    parts.state.trim(),
    parts.postal_code.trim(),
    'Brazil',
  ].filter(Boolean)
  return bits.join(', ')
}

export async function nominatimForward(query: string): Promise<GeocodeHit | null> {
  const q = query.trim()
  if (!q) return null
  if (forwardCache.has(q)) return forwardCache.get(q) ?? null

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '0')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
  })
  if (!res.ok) {
    forwardCache.set(q, null)
    return null
  }
  const data = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[]
  const row = data?.[0]
  if (!row?.lat || !row?.lon) {
    forwardCache.set(q, null)
    return null
  }
  const hit: GeocodeHit = {
    lat: parseFloat(row.lat),
    lon: parseFloat(row.lon),
    displayName: row.display_name,
  }
  if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) {
    forwardCache.set(q, null)
    return null
  }
  forwardCache.set(q, hit)
  return hit
}

export async function nominatimReverse(lat: number, lon: number): Promise<string | null> {
  const key = cacheKeyReverse(lat, lon)
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null

  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '0')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
  })
  if (!res.ok) {
    reverseCache.set(key, null)
    return null
  }
  const data = (await res.json()) as { display_name?: string }
  const label = data?.display_name?.trim() || null
  reverseCache.set(key, label)
  return label
}

export const nominatimGeocoding: GeocodingPort = {
  forwardGeocode: nominatimForward,
  reverseGeocode: nominatimReverse,
}
