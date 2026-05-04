import { getSupabase } from '@/infrastructure/supabaseClient'
import { MercadoPagoGateway } from '@/infrastructure/payment/MercadoPagoGateway'
import { PaymentGatewayStub, type PaymentGatewayPort } from '@/infrastructure/payment/PaymentGatewayPort'

/** `VITE_PAYMENT_GATEWAY=stub` força o fluxo local sem Edge; caso contrário Mercado Pago (Checkout Pro). */
export function createPaymentGateway(): PaymentGatewayPort {
  if (import.meta.env.VITE_PAYMENT_GATEWAY === 'stub') {
    return new PaymentGatewayStub()
  }
  return new MercadoPagoGateway(getSupabase())
}
