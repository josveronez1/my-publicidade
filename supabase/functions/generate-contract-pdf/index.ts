/**
 * Esqueleto. O PDF de contrato é gerado no **browser** (html2pdf) e enviado ao bucket
 * `contract-pdfs` — ver `useContractPdfPrint` e `ContractPdfPanel`.
 * Mantido para futuro (ex. PDF server-side, assinaturas, webhooks).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Geração no cliente: ver admin detalhe de contrato → Gerar e guardar PDF.',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
