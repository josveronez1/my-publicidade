import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MercadoPagoGateway } from '@/infrastructure/payment/MercadoPagoGateway'

describe('MercadoPagoGateway', () => {
  it('propaga preference_id e checkout_url em sucesso', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        preference_id: 'pref-123',
        checkout_url: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123',
      },
      error: null,
    })
    const sb = { functions: { invoke } } as unknown as SupabaseClient
    const gw = new MercadoPagoGateway(sb)

    const r = await gw.createSubscriptionForContract({
      contractId: 'c1',
      billingMode: 'full',
    })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.subscriptionId).toBe('pref-123')
      expect(r.checkoutUrl).toContain('mercadopago')
    }
    expect(invoke).toHaveBeenCalledWith('mercadopago-create-preference', {
      body: { contract_id: 'c1' },
    })
  })

  it('retorna erro quando a função devolve ok: false', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: false, error: { message: 'Valor obrigatório.' } },
      error: null,
    })
    const sb = { functions: { invoke } } as unknown as SupabaseClient
    const gw = new MercadoPagoGateway(sb)

    const r = await gw.createSubscriptionForContract({
      contractId: 'c1',
      billingMode: 'full',
    })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Valor obrigatório.')
  })
})
