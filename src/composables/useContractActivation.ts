import { getSupabase } from '@/infrastructure/supabaseClient'
import { PaymentGatewayStub } from '@/infrastructure/payment/PaymentGatewayPort'

/**
 * Ativa contrato (`active`) + stub de cobrança (Fase 5: gateway real).
 * Reutilizada pela lista global e pela ficha/detalhe do contrato.
 */
export async function activateContractWithGatewayStub(contractId: string): Promise<{ ok: boolean; message: string | null }> {
  const sb = getSupabase()
  const gw = new PaymentGatewayStub()
  const res = await gw.createSubscriptionForContract({
    contractId,
    billingMode: 'full',
  })
  if (!res.ok) {
    return { ok: false, message: res.error }
  }
  const subId = res.subscriptionId
  const { error } = await sb
    .from('contracts')
    .update({
      status: 'active',
      gateway_subscription_id: subId,
    })
    .eq('id', contractId)
  if (error) return { ok: false, message: error.message }

  await sb.from('gateway_charges').insert({
    contract_id: contractId,
    gateway: 'stub',
    external_id: subId,
    status: res.checkoutUrl ? 'pending' : 'ok',
    checkout_url: res.checkoutUrl,
  })
  return { ok: true, message: null }
}
