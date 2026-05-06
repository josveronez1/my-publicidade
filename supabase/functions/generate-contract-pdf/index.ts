/**
 * Stub intencional — **não** gera PDF aqui.
 *
 * Fluxo no admin: PDF **no próprio PC** via `jspdf` puro (texto vetorial, sem snapshot DOM); ver:
 * - `contractPrintDocument.ts` → `downloadContractPdf`, `renderContractPdfBlob`
 * - `ContractPdfPanel.vue`
 *
 * Esta função existe como placeholder para futuras necessidades (PDF server-side, webhooks, etc.)
 * sem alterar RPCs ou regras de vagas.
 *
 * Resposta JSON: envelope `{ ok: boolean, ... }`; erros com `error.code` / `error.message`.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function errorPayload(code: string, message: string, detail?: string) {
  const err: Record<string, string> = { code, message }
  if (detail) err.detail = detail
  return { ok: false as const, error: err }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(
      errorPayload(
        'METHOD_NOT_ALLOWED',
        'Only POST is supported.',
        'Contract PDF generation runs in the browser; this endpoint is a documented stub.',
      ),
      405,
    )
  }

  // Opcional: validar corpo JSON para mensagens de erro consistentes em futuras extensões.
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      await req.json()
    } catch {
      return jsonResponse(
        errorPayload('INVALID_JSON', 'Request body must be valid JSON when Content-Type is application/json.'),
        400,
      )
    }
  }

  return jsonResponse({
    ok: true,
    mode: 'stub',
    implementation: 'browser',
    message:
      'PDF: admin generates file client-side (contract detail → Descarregar/Abrir). This Edge stub does not render PDFs.',
    pointers: {
      pdf: 'src/infrastructure/contractDocument/contractPrintDocument.ts',
      panel: 'src/presentation/components/ContractPdfPanel.vue',
    },
  })
})
