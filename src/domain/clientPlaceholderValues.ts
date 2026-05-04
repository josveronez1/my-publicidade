/**
 * Variáveis `{{nome}}` no corpo dos modelos e origem nos campos de `clients`.
 */

export type ClientRowLike = {
  legal_name?: string | null
  trade_name?: string | null
  document_type?: string | null
  document_number?: string | null
  email_commercial?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  payment_terms_days?: number | null
}

export const MW_COMPANY_DISPLAY_NAME = 'MW Publicidade'

/** Legenda para o editor de modelos (não usar como fonte única de verdade). */
export const PLACEHOLDER_CHEATSHEET: readonly { key: string; label: string; source: string }[] = [
  { key: 'empresa_mw', label: 'Nome MW (fixo)', source: '(produto)' },
  { key: 'razao_social', label: 'Razão social', source: 'clients.legal_name' },
  { key: 'nome_fantasia', label: 'Nome fantasia', source: 'clients.trade_name' },
  { key: 'cnpj', label: 'Nº documento', source: 'clients.document_number' },
  { key: 'tipo_documento', label: 'Tipo (cnpj, etc.)', source: 'clients.document_type' },
  { key: 'email_comercial', label: 'E-mail comercial', source: 'clients.email_commercial' },
  { key: 'telefone', label: 'Telefone', source: 'clients.phone' },
  { key: 'cidade', label: 'Cidade', source: 'clients.city' },
  { key: 'uf', label: 'UF', source: 'clients.state' },
  { key: 'cep', label: 'CEP', source: 'clients.postal_code' },
  { key: 'prazo_pagamento_dias', label: 'Prazo pagamento (dias)', source: 'clients.payment_terms_days' },
]

function nz(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** Valores substituíveis a partir da linha do cliente (uso em pré-visualização / PDF futuro). */
export function placeholderValuesFromClient(client: ClientRowLike): Record<string, string> {
  const pt = client.payment_terms_days

  return {
    empresa_mw: MW_COMPANY_DISPLAY_NAME,
    razao_social: nz(client.legal_name),
    nome_fantasia: nz(client.trade_name),
    cnpj: nz(client.document_number),
    tipo_documento: nz(client.document_type),
    email_comercial: nz(client.email_commercial),
    telefone: nz(client.phone),
    cidade: nz(client.city),
    uf: nz(client.state),
    cep: nz(client.postal_code),
    prazo_pagamento_dias: pt !== null && pt !== undefined ? String(pt) : '',
  }
}
