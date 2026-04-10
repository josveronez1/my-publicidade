/** Tiles Carto Positron (mesmo visual do Media Kit). */
export const POSITRON_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

export const POSITRON_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>'

/**
 * Basemap compartilhado: menos “travamento” em flyTo/pan.
 * - keepBuffer: mais tiles mantidos fora da viewport.
 * - updateWhenIdle: em mobile o default do Leaflet é true (só carrega ao parar); false atualiza durante o movimento.
 * - updateInterval: grid atualiza com mais frequência durante pan (default 200ms).
 */
export const POSITRON_TILE_LAYER_OPTIONS = {
  attribution: POSITRON_ATTRIBUTION,
  subdomains: 'abcd',
  maxZoom: 20,
  keepBuffer: 16,
  updateWhenIdle: false,
  updateInterval: 100,
} as const
