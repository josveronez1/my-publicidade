import { getSupabase } from '@/infrastructure/supabaseClient'

export const CONTRACT_PDFS_BUCKET = 'contract-pdfs'

export function buildContractPdfPath(contractId: string): string {
  return `contracts/${contractId}/contract.pdf`
}

export async function uploadContractPdfFile(
  contractId: string,
  blob: Blob,
): Promise<{ path: string | null; error: string | null }> {
  const path = buildContractPdfPath(contractId)
  const sb = getSupabase()
  const { error } = await sb.storage
    .from(CONTRACT_PDFS_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: 'application/pdf',
    })
  if (error) return { path: null, error: error.message }
  return { path, error: null }
}

export async function getContractPdfSignedUrl(
  path: string,
  expiresInSeconds = 60 * 60 * 2,
): Promise<string | null> {
  const sb = getSupabase()
  const { data, error } = await sb.storage
    .from(CONTRACT_PDFS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error) return null
  return data?.signedUrl ?? null
}
