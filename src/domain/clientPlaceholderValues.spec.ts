import { describe, it, expect } from 'vitest'
import {
  MW_COMPANY_DISPLAY_NAME,
  placeholderValuesFromClient,
} from './clientPlaceholderValues'

describe('placeholderValuesFromClient', () => {
  it('usa razão social e empresa fixa MW', () => {
    const v = placeholderValuesFromClient({
      legal_name: 'Cliente SA',
      document_number: '12.345.678/0001-99',
      document_type: 'cnpj',
    })
    expect(v.razao_social).toBe('Cliente SA')
    expect(v.cnpj).toBe('12.345.678/0001-99')
    expect(v.empresa_mw).toBe(MW_COMPANY_DISPLAY_NAME)
  })
})
