export type GeocodeHit = {
  lat: number
  lon: number
  displayName?: string
}

/** Contrato para trocar Nominatim por outro provedor depois. */
export interface GeocodingPort {
  forwardGeocode(query: string): Promise<GeocodeHit | null>
  reverseGeocode(lat: number, lon: number): Promise<string | null>
}
