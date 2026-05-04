# Contrato: PDF no navegador vs função Edge

## Situação atual (entregue)

- **Geração do PDF** acontece no **browser** com `html2pdf.js`, a partir do DOM de pré-visualização (Markdown renderizado + logo do modelo).
- Código: `src/composables/useContractPdfPrint.ts` → `renderContractElementToPdfBlob`, opções em `src/infrastructure/contractDocument/pdfOptions.ts` (A4, `html2canvas` com cores compatíveis para captura).
- **Upload e persistência**: `src/infrastructure/storage/contractPdfStorage.ts`; UI em `src/presentation/components/ContractPdfPanel.vue` (botão “Gerar e guardar PDF”, atualização de `contracts.pdf_storage_path`, iframe com URL assinada).

## Função Edge `generate-contract-pdf`

- **Não** está na rota crítica do produto: mantém-se como **stub** com resposta JSON documentada (sucesso = confirmação de que a geração real é no cliente).
- Reservada para evoluções futuras (PDF server-side, integrações que exijam backend, etc.) sem mudar regras de negócio no Postgres.

Quando precisar de detalhes da API do stub, ver `supabase/functions/generate-contract-pdf/index.ts`.
