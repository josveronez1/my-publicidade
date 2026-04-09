import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import type { PublicPanelRow } from './usePublicPanels'

const token = String(import.meta.env.VITE_MAPBOX_TOKEN ?? '').trim()

export function useMapboxPublicMap(
  container: Ref<HTMLElement | null>,
  panels: Ref<PublicPanelRow[]>,
) {
  const map = shallowRef<mapboxgl.Map | null>(null)
  const ready = ref(false)
  const markers = shallowRef<mapboxgl.Marker[]>([])
  let resizeObserver: ResizeObserver | null = null
  let onWinResize: (() => void) | null = null

  function markerColor(status: string): string {
    if (status === 'maintenance') return '#94a3b8'
    if (status === 'inactive' || status === 'planning') return '#cbd5e1'
    return '#e7bb0e'
  }

  function resizeMap() {
    const m = map.value
    if (!m) return
    m.resize()
  }

  function init() {
    if (!container.value || !token) return
    mapboxgl.accessToken = token
    const m = new mapboxgl.Map({
      container: container.value,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-47.0, -22.5],
      zoom: 6,
    })
    m.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.value = m
    m.on('load', () => {
      ready.value = true
      resizeMap()
      requestAnimationFrame(() => resizeMap())
    })
    m.on('error', (e) => {
      console.error('[Mapbox]', e.error?.message ?? e)
    })
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(resizeMap)
    })
    resizeObserver.observe(container.value)
    onWinResize = () => requestAnimationFrame(resizeMap)
    window.addEventListener('resize', onWinResize, { passive: true })
  }

  function clearMarkers() {
    for (const mk of markers.value) mk.remove()
    markers.value = []
  }

  function syncMarkers() {
    const m = map.value
    if (!m || !ready.value) return
    clearMarkers()
    const next: mapboxgl.Marker[] = []
    for (const p of panels.value) {
      const el = document.createElement('div')
      el.className = 'h-4 w-4 rounded-full border-2 border-white shadow'
      el.style.backgroundColor = markerColor(p.status)
      const mk = new mapboxgl.Marker({ element: el })
        .setLngLat([p.longitude, p.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<strong>${p.name}</strong><br/><span style="color:#64748b;font-size:12px">${p.city ?? ''} ${p.state ?? ''}</span>`,
          ),
        )
        .addTo(m)
      next.push(mk)
    }
    markers.value = next
    if (panels.value.length) {
      const b = new mapboxgl.LngLatBounds()
      for (const p of panels.value) b.extend([p.longitude, p.latitude])
      m.fitBounds(b, { padding: 48, maxZoom: 14 })
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
    clearMarkers()
    map.value?.remove()
    map.value = null
    ready.value = false
  })

  return { map, ready, init, syncMarkers }
}
