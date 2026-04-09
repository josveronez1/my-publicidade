import { getSupabase } from '@/infrastructure/supabaseClient'

const BUCKET = 'panel-media'

function safeFileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 120)
}

export function buildPanelMediaPath(panelId: string, fileName: string): string {
  const safe = safeFileName(fileName || 'photo.jpg')
  return `panels/${panelId}/${Date.now()}-${safe}`
}

export async function createPanelMediaSignedUrl(
  path: string,
  expiresInSeconds = 60 * 10,
): Promise<string | null> {
  const sb = getSupabase()
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error) return null
  return data?.signedUrl ?? null
}

