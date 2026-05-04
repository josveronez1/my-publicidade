import { describe, expect, it } from 'vitest'
import {
  internalChargeStatusIsPaid,
  internalChargeStatusIsPending,
  mercadoPagoPaymentStatusToInternal,
} from '@/domain/mercadoPagoPayment'

describe('mercadoPagoPaymentStatusToInternal', () => {
  it('mapeia approved e authorized para paid', () => {
    expect(mercadoPagoPaymentStatusToInternal('approved')).toBe('paid')
    expect(mercadoPagoPaymentStatusToInternal('authorized')).toBe('paid')
  })

  it('mapeia pending e in_process para pending', () => {
    expect(mercadoPagoPaymentStatusToInternal('pending')).toBe('pending')
    expect(mercadoPagoPaymentStatusToInternal('in_process')).toBe('pending')
  })

  it('mapeia rejected e cancelled para failed', () => {
    expect(mercadoPagoPaymentStatusToInternal('rejected')).toBe('failed')
    expect(mercadoPagoPaymentStatusToInternal('cancelled')).toBe('failed')
  })

  it('mapeia refunded e charged_back', () => {
    expect(mercadoPagoPaymentStatusToInternal('refunded')).toBe('refunded')
    expect(mercadoPagoPaymentStatusToInternal('charged_back')).toBe('charged_back')
  })
})

describe('internalChargeStatusIsPaid', () => {
  it('aceita paid e ok legado', () => {
    expect(internalChargeStatusIsPaid('paid')).toBe(true)
    expect(internalChargeStatusIsPaid('ok')).toBe(true)
    expect(internalChargeStatusIsPaid('pending')).toBe(false)
  })
})

describe('internalChargeStatusIsPending', () => {
  it('identifica pendentes', () => {
    expect(internalChargeStatusIsPending('pending')).toBe(true)
    expect(internalChargeStatusIsPending('in_mediation')).toBe(true)
    expect(internalChargeStatusIsPending('paid')).toBe(false)
  })
})
