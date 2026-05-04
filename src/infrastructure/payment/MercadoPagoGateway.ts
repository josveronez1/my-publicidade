import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CancelSubscriptionResult,
  CreateSubscriptionResult,
  PaymentGatewayPort,
} from '@/infrastructure/payment/PaymentGatewayPort'

type CreatePreferenceResponse =
  | { ok: true; checkout_url: string; preference_id: string }
  | {
      ok: false
      error?: { code?: string; message?: string; detail?: string }
    }

/**
 * Checkout Pro: preferência criada na Edge `mercadopago-create-preference`
 * (Access Token só no servidor). O cliente envia JWT Supabase na invocação.
 */
export class MercadoPagoGateway implements PaymentGatewayPort {
  constructor(private readonly sb: SupabaseClient) {}

  async createSubscriptionForContract(
    input: Parameters<PaymentGatewayPort['createSubscriptionForContract']>[0],
  ): Promise<CreateSubscriptionResult> {
    const { data, error } = await this.sb.functions.invoke('mercadopago-create-preference', {
      body: { contract_id: input.contractId },
    })

    if (error) {
      return { ok: false, error: error.message ?? 'Erro ao chamar Mercado Pago.' }
    }

    const body = data as CreatePreferenceResponse | null
    if (!body || typeof body !== 'object') {
      return { ok: false, error: 'Resposta inválida do servidor.' }
    }
    if (!body.ok) {
      const msg =
        'error' in body && body.error && typeof body.error.message === 'string'
          ? body.error.message
          : 'Não foi possível criar a preferência de pagamento.'
      return { ok: false, error: msg }
    }

    return {
      ok: true,
      subscriptionId: body.preference_id,
      checkoutUrl: body.checkout_url ?? null,
    }
  }

  async cancelSubscription(_subscriptionId: string): Promise<CancelSubscriptionResult> {
    // Preferências Checkout Pro não são “canceladas” aqui; fluxo futuro pode usar API MP.
    return { ok: true }
  }

  async syncContractStatus(_contractId: string): Promise<{ status: string }> {
    return { status: 'unknown' }
  }
}
