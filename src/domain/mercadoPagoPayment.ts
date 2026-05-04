/**
 * Mapeamento status Mercado Pago (API pagamentos) → estado interno em `gateway_charges`
 * e derivados para o semáforo (pagamento OK / pendente).
 */

/** Status devolvido por GET /v1/payments/:id (campo `status`). */
export type MercadoPagoApiPaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'

export type InternalChargeStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'charged_back'
  | 'in_mediation'

/**
 * Normaliza o status MP para gravação coerente na app.
 */
export function mercadoPagoPaymentStatusToInternal(
  apiStatus: string,
): InternalChargeStatus {
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

/** Estados de cobrança que contam como “pago” no semáforo (além de `manual_paid_at`). */
export function internalChargeStatusIsPaid(status: string | null | undefined): boolean {
  if (!status) return false
  const u = status.toLowerCase()
  return u === 'paid' || u === 'ok'
}

export function internalChargeStatusIsPending(
  status: string | null | undefined,
): boolean {
  if (!status) return false
  const u = status.toLowerCase()
  return (
    u === 'pending' ||
    u === 'in_process' ||
    u === 'in_mediation' ||
    u === 'processing'
  )
}
