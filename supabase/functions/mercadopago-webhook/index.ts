/**
 * Webhook Mercado Pago (sem JWT no pedido). Valida com GET /v1/payments/:id + Access Token.
 * Actualiza `gateway_charges`, `contracts.payment_external_id`, `last_gateway_sync_at`.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

/** Alinhado a `src/domain/mercadoPagoPayment.ts` (Edge não importa o pacote Vue). */
function mercadoPagoPaymentStatusToInternal(apiStatus: string): string {
  const s = (apiStatus ?? '').toLowerCase()
  switch (s) {
    case 'approved':
    case 'authorized':
      return 'paid'
    case 'pending':
    case 'in_process':
      return 'pending'
    case 'in_mediation':
      return 'in_mediation'
    case 'refunded':
      return 'refunded'
    case 'charged_back':
      return 'charged_back'
    case 'rejected':
    case 'cancelled':
    default:
      return 'failed'
  }
}

function extractPaymentId(req: Request, url: URL): string | null {
  if (url.searchParams.get('topic') === 'payment') {
    const id = url.searchParams.get('id')
    if (id) return id
  }
  const qId = url.searchParams.get('data.id')
  if (qId) return qId

  return null
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  let paymentId = extractPaymentId(req, url)

  if (!paymentId && req.method === 'POST') {
    try {
      const ct = req.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        const raw = await req.json()
        const body = raw as Record<string, unknown>
        const data = body?.data as Record<string, unknown> | undefined
        const rid =
          data?.id ??
          body?.id ??
          (typeof body?.resource === 'string'
            ? (body.resource as string).split('/').pop()
            : undefined)
        if (rid != null) paymentId = String(rid)
      }
    } catch {
      // corpo vazio
    }
  }

  if (!paymentId) {
    return jsonResponse({ ok: true, skipped: true, reason: 'no_payment_id' })
  }

  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) {
    console.error('mercadopago-webhook: MERCADOPAGO_ACCESS_TOKEN ausente')
    return jsonResponse({ ok: false, error: 'missing_token' }, 500)
  }

  const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!payRes.ok) {
    const t = await payRes.text()
    console.error('MP GET payment failed', payRes.status, t)
    return jsonResponse({ ok: false, error: 'mp_fetch_failed' }, 502)
  }

  const payment = (await payRes.json()) as Record<string, unknown>
  const contractId =
    typeof payment.external_reference === 'string' ? payment.external_reference : null

  if (!contractId) {
    return jsonResponse({ ok: true, skipped: true, reason: 'no_external_reference' })
  }

  const paymentNumericId =
    typeof payment.id === 'number' ? payment.id : Number.parseInt(String(payment.id), 10)
  const idempotencyKey = Number.isFinite(paymentNumericId) ? String(paymentNumericId) : String(payment.id)

  const internalStatus = mercadoPagoPaymentStatusToInternal(String(payment.status ?? ''))

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return jsonResponse({ ok: false, error: 'supabase_config' }, 500)
  }

  const adminSb = createClient(supabaseUrl, serviceKey)

  const { data: dup } = await adminSb
    .from('gateway_charges')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (dup) {
    return jsonResponse({ ok: true, duplicate: true })
  }

  const { data: candidates } = await adminSb
    .from('gateway_charges')
    .select('id, status, created_at')
    .eq('contract_id', contractId)
    .eq('gateway', 'mercadopago')
    .order('created_at', { ascending: false })
    .limit(10)

  const pendingRow =
    candidates?.find((r) => r.status === 'pending' || r.status === 'in_process') ??
    candidates?.[0]

  const txAmount = payment.transaction_amount
  const amountCents =
    typeof txAmount === 'number' && Number.isFinite(txAmount)
      ? Math.round(txAmount * 100)
      : null

  if (pendingRow) {
    const { error: updErr } = await adminSb
      .from('gateway_charges')
      .update({
        status: internalStatus,
        external_id: idempotencyKey,
        raw_payload: payment,
        idempotency_key: idempotencyKey,
        ...(amountCents != null ? { amount_cents: amountCents } : {}),
      })
      .eq('id', pendingRow.id)

    if (updErr) {
      if ((updErr as { code?: string }).code === '23505') {
        return jsonResponse({ ok: true, duplicate: true })
      }
      console.error(updErr)
      return jsonResponse({ ok: false, error: updErr.message }, 500)
    }
  } else {
    const { error: insErr } = await adminSb.from('gateway_charges').insert({
      contract_id: contractId,
      gateway: 'mercadopago',
      external_id: idempotencyKey,
      status: internalStatus,
      amount_cents: amountCents,
      raw_payload: payment,
      idempotency_key: idempotencyKey,
    })

    if (insErr) {
      if ((insErr as { code?: string }).code === '23505') {
        return jsonResponse({ ok: true, duplicate: true })
      }
      console.error(insErr)
      return jsonResponse({ ok: false, error: insErr.message }, 500)
    }
  }

  const { error: cErr } = await adminSb
    .from('contracts')
    .update({
      payment_external_id: idempotencyKey,
      last_gateway_sync_at: new Date().toISOString(),
    })
    .eq('id', contractId)

  if (cErr) console.error('contracts update', cErr)

  return jsonResponse({ ok: true })
})
