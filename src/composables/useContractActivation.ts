import { getSupabase } from '@/infrastructure/supabaseClient'
import { createPaymentGateway } from '@/infrastructure/payment/createPaymentGateway'

/**
 * Ativa contrato com cobrança: stub local (`VITE_PAYMENT_GATEWAY=stub`) ou
 * Checkout Pro via Edge `mercadopago-create-preference` (actualiza contrato e `gateway_charges` no servidor).
 */
export async function activateContractWithGateway(
  contractId: string,
): Promise<{ ok: boolean; message: string | null; checkoutUrl: string | null }> {
  const useStub = import.meta.env.VITE_PAYMENT_GATEWAY === 'stub'
  const gw = createPaymentGateway()

  const res = await gw.createSubscriptionForContract({
    contractId,
    billingMode: 'full',
  })

  if (!res.ok) {
    return { ok: false, message: res.error, checkoutUrl: null }
  }

  if (!useStub) {
    // Edge já activou o contrato e gravou `gateway_charges`.
    return {
      ok: true,
      message: null,
      checkoutUrl: res.checkoutUrl ?? null,
    }
  }

  const sb = getSupabase()
  const subId = res.subscriptionId
  const { error } = await sb
    .from('contracts')
    .update({
      status: 'active',
      gateway_subscription_id: subId,
    })
    .eq('id', contractId)

  if (error) return { ok: false, message: error.message, checkoutUrl: null }

  await sb.from('gateway_charges').insert({
    contract_id: contractId,
    gateway: 'stub',
    external_id: subId,
    status: res.checkoutUrl ? 'pending' : 'ok',
    checkout_url: res.checkoutUrl,
  })

  return { ok: true, message: null, checkoutUrl: res.checkoutUrl ?? null }
}

/** @deprecated Use `activateContractWithGateway`; mantido para imports antigos. */
export async function activateContractWithGatewayStub(contractId: string) {
  const r = await activateContractWithGateway(contractId)
  return { ok: r.ok, message: r.message }
}
