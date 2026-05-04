/**
 * Checkout Pro: cria preferência MP, activa contrato e regista `gateway_charges` (pending).
 * Segredo: MERCADOPAGO_ACCESS_TOKEN (Edge Secrets). Nunca expor no cliente.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const ACTIVATABLE = new Set(['draft', 'under_review', 'pending_signature'])

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function errorPayload(message: string, code = 'BAD_REQUEST', detail?: string) {
  const err: Record<string, string> = { code, message }
  if (detail) err.detail = detail
  return { ok: false as const, error: err }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(errorPayload('Só POST.', 'METHOD_NOT_ALLOWED'), 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(errorPayload('Autorização em falta.', 'UNAUTHORIZED'), 401)
  }

  let body: { contract_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(errorPayload('Corpo JSON inválido.', 'INVALID_JSON'), 400)
  }

  const contract_id = body.contract_id
  if (!contract_id || typeof contract_id !== 'string') {
    return jsonResponse(errorPayload('contract_id é obrigatório.', 'VALIDATION'), 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(errorPayload('Supabase não configurado.', 'CONFIG'), 500)
  }

  const userSb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await userSb.auth.getUser()
  if (userErr || !user) {
    return jsonResponse(errorPayload('Sessão inválida.', 'UNAUTHORIZED'), 401)
  }

  const { data: profile, error: profileErr } = await userSb
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    return jsonResponse(errorPayload(profileErr.message, 'DATABASE'), 500)
  }
  if (!profile?.is_active) {
    return jsonResponse(errorPayload('Conta inactiva.', 'FORBIDDEN'), 403)
  }
  const role = profile.role as string
  if (role !== 'admin' && role !== 'super_admin') {
    return jsonResponse(errorPayload('Apenas administradores.', 'FORBIDDEN'), 403)
  }

  const { data: contract, error: contractErr } = await userSb
    .from('contracts')
    .select(
      'id, status, total_value, currency, contract_number, title, client_id',
    )
    .eq('id', contract_id)
    .maybeSingle()

  if (contractErr) {
    return jsonResponse(errorPayload(contractErr.message, 'DATABASE'), 500)
  }
  if (!contract) {
    return jsonResponse(errorPayload('Contrato não encontrado.', 'NOT_FOUND'), 404)
  }

  const st = contract.status as string
  if (!ACTIVATABLE.has(st)) {
    return jsonResponse(
      errorPayload(
        'Contrato não está em estado activável (draft, under_review ou pending_signature).',
        'INVALID_STATUS',
      ),
      400,
    )
  }

  if (contract.total_value == null) {
    return jsonResponse(
      errorPayload(
        'total_value é obrigatório para gerar a cobrança. Preencha o valor do contrato antes de ativar.',
        'MISSING_TOTAL_VALUE',
      ),
      400,
    )
  }

  const unitPrice = Number(contract.total_value)
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return jsonResponse(errorPayload('total_value inválido para o gateway.', 'INVALID_AMOUNT'), 400)
  }

  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) {
    return jsonResponse(
      errorPayload(
        'Servidor sem MERCADOPAGO_ACCESS_TOKEN. Configure o secret na Edge Function.',
        'MISSING_MP_TOKEN',
      ),
      500,
    )
  }

  const itemTitle =
    (typeof contract.title === 'string' && contract.title.trim()) ||
    contract.contract_number ||
    'Contrato'

  const currencyId = (contract.currency as string) || 'BRL'
  const notificationUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mercadopago-webhook`

  const mpPayload = {
    items: [
      {
        title: itemTitle.slice(0, 256),
        quantity: 1,
        currency_id: currencyId,
        unit_price: unitPrice,
      },
    ],
    external_reference: contract_id,
    notification_url: notificationUrl,
  }

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mpPayload),
  })

  const mpText = await mpRes.text()
  if (!mpRes.ok) {
    console.error('Mercado Pago preferences error', mpRes.status, mpText)
    return jsonResponse(
      errorPayload(
        'Mercado Pago recusou criar a preferência.',
        'MP_ERROR',
        mpText.slice(0, 400),
      ),
      502,
    )
  }

  let preference: { id?: string; init_point?: string; sandbox_init_point?: string }
  try {
    preference = JSON.parse(mpText) as typeof preference
  } catch {
    return jsonResponse(errorPayload('Resposta inválida do Mercado Pago.', 'MP_PARSE'), 502)
  }

  const preferenceId = preference.id
  const initPoint = preference.init_point || preference.sandbox_init_point
  if (!preferenceId || !initPoint) {
    return jsonResponse(errorPayload('Resposta incompleta do Mercado Pago.', 'MP_INCOMPLETE'), 502)
  }

  const amountCents = Math.round(unitPrice * 100)

  const { error: updContractErr } = await userSb
    .from('contracts')
    .update({
      status: 'active',
      gateway_subscription_id: preferenceId,
      gateway_last_error: null,
      last_gateway_sync_at: new Date().toISOString(),
    })
    .eq('id', contract_id)

  if (updContractErr) {
    return jsonResponse(errorPayload(updContractErr.message, 'DATABASE'), 500)
  }

  const { error: insChargeErr } = await userSb.from('gateway_charges').insert({
    contract_id,
    gateway: 'mercadopago',
    external_id: preferenceId,
    status: 'pending',
    checkout_url: initPoint,
    amount_cents: amountCents,
    idempotency_key: `preference_${preferenceId}`,
  })

  if (insChargeErr) {
    return jsonResponse(errorPayload(insChargeErr.message, 'DATABASE'), 500)
  }

  return jsonResponse({
    ok: true as const,
    checkout_url: initPoint,
    preference_id: preferenceId,
  })
})
