import { getSupabase } from '@/infrastructure/supabaseClient'

export const CONTRACT_TEMPLATES_BUCKET = 'contract-templates'

function safeFileName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 120)
  return base || 'logo.webp'
}

export function buildContractTemplateLogoPath(templateId: string, fileName: string): string {
  return `templates/${templateId}/${Date.now()}-${safeFileName(fileName)}`
}

export async function uploadContractTemplateLogo(
  templateId: string,
  file: File,
): Promise<{ path: string | null; message: string | null }> {
  const sb = getSupabase()
  const path = buildContractTemplateLogoPath(templateId, file.name)
  const { error } = await sb.storage.from(CONTRACT_TEMPLATES_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) return { path: null, message: error.message }
  return { path, message: null }
}

export async function deleteContractTemplateLogo(path: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.storage.from(CONTRACT_TEMPLATES_BUCKET).remove([path])
  return !error
}

export async function contractTemplateLogoSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const sb = getSupabase()
  const { data, error } = await sb.storage
    .from(CONTRACT_TEMPLATES_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error) return null
  return data?.signedUrl ?? null
}
