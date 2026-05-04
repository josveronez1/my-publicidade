import { describe, expect, it } from 'vitest'
import { PaymentGatewayStub } from '@/infrastructure/payment/PaymentGatewayPort'

describe('PaymentGatewayStub', () => {
  it('createSubscriptionForContract devolve ok sem checkout URL', async () => {
    const gw = new PaymentGatewayStub()
    const r = await gw.createSubscriptionForContract({
      contractId: '00000000-0000-4000-8000-000000000001',
      billingMode: 'full',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.subscriptionId).toMatch(/^stub_/)
      expect(r.checkoutUrl).toBeNull()
    }
  })

  it('cancelSubscription e syncContractStatus são no-op seguros', async () => {
    const gw = new PaymentGatewayStub()
    await expect(gw.cancelSubscription('any')).resolves.toEqual({ ok: true })
    await expect(gw.syncContractStatus('any')).resolves.toEqual({ status: 'unknown' })
  })
})
