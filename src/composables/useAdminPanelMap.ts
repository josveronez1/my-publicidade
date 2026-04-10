import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { POSITRON_TILE_LAYER_OPTIONS, POSITRON_TILE_URL } from '@/infrastructure/leafletBasemap'

const DEFAULT_CENTER: L.LatLngTuple = [-22.5, -47.0]
const DEFAULT_ZOOM = 6
const PIN_ZOOM = 16

/**
 * Mapa admin: um pin arrastável; clique no mapa move o pin.
 * Sincroniza com refs de latitude/longitude (graus decimais ou null).
 */
export function useAdminPanelMap(
  container: Ref<HTMLElement | null>,
  latitude: Ref<number | null>,
  longitude: Ref<number | null>,
) {
  const map = shallowRef<L.Map | null>(null)
  const ready = ref(false)
  const marker = shallowRef<L.Marker | null>(null)
  let resizeObserver: ResizeObserver | null = null
  let onWinResize: (() => void) | null = null

  function invalidate() {
    map.value?.invalidateSize()
  }

  function panelMarkerIcon(): L.DivIcon {
    const dot = document.createElement('div')
    dot.style.cssText =
      'width:20px;height:20px;border-radius:9999px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);background:#e7bb0e'
    return L.divIcon({
      html: dot,
      className: 'mw-leaflet-div-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
  }

  function placeMarker(lat: number, lng: number, opts: { fitView: boolean }) {
    const m = map.value
    if (!m || !ready.value) return
    const mk = marker.value
    if (mk) {
      const c = mk.getLatLng()
      if (Math.abs(c.lat - lat) < 1e-5 && Math.abs(c.lng - lng) < 1e-5) return
      mk.setLatLng([lat, lng])
      if (opts.fitView) m.setView([lat, lng], PIN_ZOOM, { animate: true })
      else m.panTo([lat, lng], { animate: true })
      return
    }
    const next = L.marker([lat, lng], { icon: panelMarkerIcon(), draggable: true })
    next.on('dragend', () => {
      const ll = next.getLatLng()
      latitude.value = ll.lat
      longitude.value = ll.lng
    })
    next.addTo(m)
    marker.value = next
    m.setView([lat, lng], PIN_ZOOM, { animate: true })
  }

  function removeMarker() {
    if (marker.value) {
      marker.value.remove()
      marker.value = null
    }
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

    m.on('click', (e) => {
      const { lat, lng } = e.latlng
      latitude.value = lat
      longitude.value = lng
      placeMarker(lat, lng, { fitView: false })
    })

    const lat = latitude.value
    const lng = longitude.value
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      m.setView([lat, lng], PIN_ZOOM)
    } else {
      m.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    }

    map.value = m

    m.whenReady(() => {
      ready.value = true
      invalidate()
      requestAnimationFrame(() => invalidate())
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        placeMarker(lat, lng, { fitView: false })
      }
    })

    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(invalidate)
    })
    resizeObserver.observe(el)
    onWinResize = () => requestAnimationFrame(invalidate)
    window.addEventListener('resize', onWinResize, { passive: true })
  }

  watch(
    [latitude, longitude, map, ready],
    () => {
      const m = map.value
      if (!m || !ready.value) return
      const lat = latitude.value
      const lng = longitude.value
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        placeMarker(lat, lng, { fitView: true })
      } else {
        removeMarker()
        m.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      }
    },
    { flush: 'post' },
  )

  onUnmounted(() => {
    if (onWinResize) {
      window.removeEventListener('resize', onWinResize)
      onWinResize = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    removeMarker()
    map.value?.remove()
    map.value = null
    ready.value = false
  })

  return { map, ready, init }
}
