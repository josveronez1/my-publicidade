import { ref } from 'vue'
import { getSupabase } from '@/infrastructure/supabaseClient'

const DEFAULT_ORG_DISPLAY_NAME = 'MW Publicidade'
/** Valor antigo em `site_settings` antes do rename de marca — normaliza na leitura até migrar o banco. */
const LEGACY_ORG_DISPLAY_NAME = 'MW Mídia Indoor'

function normalizeOrgDisplayName(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return DEFAULT_ORG_DISPLAY_NAME
  if (t === LEGACY_ORG_DISPLAY_NAME) return DEFAULT_ORG_DISPLAY_NAME
  return t
}

export function useSiteSettings() {
  const orgName = ref<string>(DEFAULT_ORG_DISPLAY_NAME)
  const loading = ref(false)

  async function load() {
    loading.value = true
    const sb = getSupabase()
    const { data } = await sb
      .from('site_settings')
      .select('org_display_name')
      .limit(1)
      .maybeSingle()
    orgName.value = normalizeOrgDisplayName(data?.org_display_name)
    loading.value = false
  }

  async function save(name: string) {
    const sb = getSupabase()
    const { data: row } = await sb.from('site_settings').select('id').limit(1).maybeSingle()
    if (!row?.id) return { error: 'Sem configuração' }
    const { error } = await sb
      .from('site_settings')
      .update({ org_display_name: name })
      .eq('id', row.id)
    if (!error) orgName.value = name
    return { error: error?.message }
  }

  return { orgName, loading, load, save }
}
