import { computed, ref } from 'vue'
import { getSupabase } from '@/infrastructure/supabaseClient'

export function useTargetAudienceTags() {
  const tags = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const sorted = computed(() => [...tags.value].sort((a, b) => a.localeCompare(b)))

  async function load() {
    loading.value = true
    error.value = null
    try {
      const sb = getSupabase()
      const { data, error: e } = await sb
        .from('target_audience_tags')
        .select('label')
        .order('label', { ascending: true })
      if (e) throw e
      tags.value = (data ?? []).map((r) => String((r as any).label)).filter(Boolean)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Falha ao carregar tags.'
    } finally {
      loading.value = false
    }
  }

  async function ensureTagsExist(labels: string[]) {
    const cleaned = Array.from(
      new Set(
        labels
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
          .map((s) => s.slice(0, 60)),
      ),
    )
    if (cleaned.length === 0) return
    const sb = getSupabase()
    const { error: e } = await sb
      .from('target_audience_tags')
      .upsert(cleaned.map((label) => ({ label })), { onConflict: 'label' })
    if (e) throw e
  }

  return { tags: sorted, loading, error, load, ensureTagsExist }
}

