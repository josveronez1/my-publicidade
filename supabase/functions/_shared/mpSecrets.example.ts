/**
 * Nomes sugeridos para variáveis em Supabase Edge Functions (Deno.env).
 * Definir valores reais em: Dashboard → Edge Functions → Secrets.
 * Não versionar tokens; este ficheiro serve só como contrato de nomes.
 *
 * Ver também: docs/mercado-pago-setup.md
 */
export const MP_SECRET_ENV_NAMES = {
  /** Access Token do Mercado Pago (ambiente teste ou produção conforme a app no painel MP). */
  ACCESS_TOKEN: 'MERCADOPAGO_ACCESS_TOKEN',
} as const
