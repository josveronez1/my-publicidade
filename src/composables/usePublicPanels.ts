import { ref } from 'vue'
import { getSupabase } from '@/infrastructure/supabaseClient'

export type PublicPanelRow = {
  id: string
  code: string
  name: string
  slug: string
  latitude: number
  longitude: number
  status: string
  target_audience: string | null
  target_audience_tags?: string[] | null
  description: string | null
  city: string | null
  state: string | null
  address_line1: string | null
  total_ad_slots: number
  thumbnail_path: string | null
  gallery_paths?: string[] | null
  width_m?: number | null
  height_m?: number | null
}

export function usePublicPanels() {
  const panels = ref<PublicPanelRow[]>([])
  const slotsByPanel = ref<Record<string, number>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    const sb = getSupabase()
    const { data, error: e } = await sb
      .from('panels')
      .select(
        'id, code, name, slug, latitude, longitude, status, target_audience, target_audience_tags, description, city, state, address_line1, total_ad_slots, thumbnail_path, gallery_paths, width_m, height_m',
      )
      .eq('is_published', true)
      .order('name')
    if (e) {
      error.value = e.message
      panels.value = []
    } else {
      panels.value = (data ?? []) as PublicPanelRow[]
      const map: Record<string, number> = {}
      for (const p of panels.value) {
        const { data: n } = await sb.rpc('panel_slots_used_public', {
          p_panel_id: p.id,
        })
        map[p.id] = typeof n === 'number' ? n : 0
      }
      slotsByPanel.value = map
    }
    loading.value = false
  }

  return { panels, slotsByPanel, loading, error, load }
}
