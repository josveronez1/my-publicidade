import { getSupabase } from '@/infrastructure/supabaseClient'

export const CONTRACT_PDFS_BUCKET = 'contract-pdfs'

export function buildContractPdfPath(contractId: string): string {
  return `contracts/${contractId}/contract.pdf`
}

/** Remove PDF legado do bucket (contratos antigos); o fluxo actual usa impressão local. */
export async function removeContractPdfFromStorage(storagePath: string): Promise<void> {
  const sb = getSupabase()
  await sb.storage.from(CONTRACT_PDFS_BUCKET).remove([storagePath])
}
