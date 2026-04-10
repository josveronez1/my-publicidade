import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import {
  POSITRON_TILE_LAYER_OPTIONS,
  POSITRON_TILE_URL,
} from '@/infrastructure/leafletBasemap'
import type { PublicPanelRow } from './usePublicPanels'

/** Duração compartilhada flyTo / flyToBounds (segundos). */
const MAP_FLY_DURATION_SEC = 0.85

/** Zoom in ao selecionar painel: incremento e teto mais modestos (antes +3 até 18–20). */
const PANEL_FOCUS_ZOOM_DELTA = 2
const PANEL_FOCUS_ZOOM_FLOOR = 15
const PANEL_FOCUS_ZOOM_CAP = 18

/**
 * Ao voltar à visão geral: fração do caminho até o zoom que encaixaria todos os pontos.
 * Menor que 1 = menos zoom out de uma vez (pode ficar um ponto fora da tela se estiverem muito espalhados).
 */
const OVERVIEW_ZOOM_BLEND = 0.58

/** Teto igual ao fitBounds anterior: não “cola” mais que isso nos pontos. */
const OVERVIEW_MAX_ZOOM = 14

function markerColor(status: string): string {
  if (status === 'maintenance') return '#94a3b8'
  if (status === 'inactive' || status === 'planning') return '#cbd5e1'
  return '#e7bb0e'
}

function popupElement(p: PublicPanelRow, onSelect?: (id: string) => void): HTMLElement {
  const root = document.createElement('div')
  root.style.cssText = 'min-width:180px'

  const title = document.createElement('div')
  title.style.cssText = 'font-weight:700;color:#0f172a;margin-bottom:2px'
  title.textContent = p.name

  const sub = document.createElement('div')
  sub.style.cssText = 'color:#64748b;font-size:12px'
  sub.textContent = `${[p.city, p.state].filter(Boolean).join(' / ')}`.trim()

  root.appendChild(title)
  root.appendChild(sub)

  if (onSelect) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.style.cssText =
      'margin-top:8px;background:#e7bb0e;color:#0f172a;border:none;border-radius:10px;padding:6px 10px;font-weight:700;font-size:12px;cursor:pointer'
    btn.textContent = 'Ver detalhes'
    btn.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      onSelect(p.id)
    })
    root.appendChild(btn)
  }

  return root
}

export function useLeafletPublicMap(
  container: Ref<HTMLElement | null>,
  panels: Ref<PublicPanelRow[]>,
  opts: {
    selectedPanelId: Ref<string | null>
    onSelectPanel?: (panelId: string) => void
    onMapBackgroundClick?: () => void
  },
) {
  const map = shallowRef<L.Map | null>(null)
  const ready = ref(false)
  const markersLayer = shallowRef<L.LayerGroup | null>(null)
  let resizeObserver: ResizeObserver | null = null
  let onWinResize: (() => void) | null = null

  function invalidate() {
    const m = map.value
    if (!m) return
    m.invalidateSize()
  }

  function fitAllPanels() {
    const m = map.value
    if (!m || !ready.value || panels.value.length === 0) return
    const b = L.latLngBounds(panels.value.map((p) => [p.latitude, p.longitude]))
    // Mesmo padding [36,36] → getBoundsZoom usa TL+BR somados (72 em cada eixo).
    const pad = L.point(72, 72)
    const zFit = m.getBoundsZoom(b, false, pad)
    const z0 = m.getZoom()
    let z = Math.round(z0 + (zFit - z0) * OVERVIEW_ZOOM_BLEND)
    z = Math.max(m.getMinZoom(), Math.min(m.getMaxZoom(), z))
    z = Math.min(OVERVIEW_MAX_ZOOM, z)
    m.flyTo(b.getCenter(), z, { duration: MAP_FLY_DURATION_SEC })
  }

  function flyToPanel(panelId: string) {
    const m = map.value
    if (!m || !ready.value) return
    const p = panels.value.find((x) => x.id === panelId)
    if (!p) return
    const z = m.getZoom()
    const targetZoom = Math.min(
      PANEL_FOCUS_ZOOM_CAP,
      Math.max(z + PANEL_FOCUS_ZOOM_DELTA, PANEL_FOCUS_ZOOM_FLOOR),
    )
    m.flyTo([p.latitude, p.longitude], targetZoom, { duration: MAP_FLY_DURATION_SEC })
  }

  function init() {
    const el = container.value
    if (!el || map.value) return

    const m = L.map(el, {
      zoomControl: false,
      attributionControl: true,
    })

    L.tileLayer(POSITRON_TILE_URL, { ...POSITRON_TILE_LAYER_OPTIONS }).addTo(m)

    L.control.zoom({ position: 'topright' }).addTo(m)

    m.setView([-22.5, -47.0], 6)

    const group = L.layerGroup().addTo(m)
    markersLayer.value = group
    map.value = m

    m.on('click', (e: L.LeafletMouseEvent) => {
      const t = e.originalEvent.target as HTMLElement | null
      if (t?.closest?.('.leaflet-popup')) return
      opts.onMapBackgroundClick?.()
    })

    m.whenReady(() => {
      ready.value = true
      invalidate()
      requestAnimationFrame(() => invalidate())
    })

    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(invalidate)
    })
    resizeObserver.observe(el)
    onWinResize = () => requestAnimationFrame(invalidate)
    window.addEventListener('resize', onWinResize, { passive: true })
  }

  function clearMarkers() {
    markersLayer.value?.clearLayers()
  }

  function syncMarkers() {
    const m = map.value
    const group = markersLayer.value
    if (!m || !group || !ready.value) return

    clearMarkers()
    for (const p of panels.value) {
      const dot = document.createElement('div')
      dot.style.cssText = `width:16px;height:16px;border-radius:9999px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2);background:${markerColor(p.status)}`
      const icon = L.divIcon({
        html: dot,
        className: 'mw-leaflet-div-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      const marker = L.marker([p.latitude, p.longitude], { icon }).addTo(group)
      marker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e.originalEvent)
        opts.onSelectPanel?.(p.id)
      })
      marker.bindPopup(popupElement(p, opts.onSelectPanel))
    }

    if (panels.value.length > 0 && opts.selectedPanelId.value == null) {
      const b = L.latLngBounds(panels.value.map((p) => [p.latitude, p.longitude]))
      m.fitBounds(b, { padding: [48, 48], maxZoom: 14 })
    }
  }

  watch([map, ready, panels], syncMarkers, { deep: true })

  onUnmounted(() => {
    if (onWinResize) {
      window.removeEventListener('resize', onWinResize)
      onWinResize = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    markersLayer.value = null
    map.value?.remove()
    map.value = null
    ready.value = false
  })

  return { map, ready, init, syncMarkers, flyToPanel, fitAllPanels }
}
