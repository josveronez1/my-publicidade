# Contrato: PDF no navegador vs função Edge

## Situação actual

- **Descarregar PDF**: gera um ficheiro **PDF vetorial** no browser com `jspdf` puro (texto selecionável, leve — KBs). O markdown é tokenizado com `marked.lexer` e cada bloco é desenhado com `doc.text` / `setFont`. Sem snapshot DOM (logo, sem problemas de `oklch`, fontes ou cabeçalhos do diálogo de impressão). O `jspdf` é importado dinâmico (`import('jspdf')`) — só baixa o chunk quando o utilizador clica.
- Nada vai para Storage; não passa pelo diálogo **Imprimir**, por isso **não** aparecem os cabeçalhos e rodapés por defeito do Chrome (data, URL, nome da página, etc.).
- Código: `src/infrastructure/contractDocument/contractPrintDocument.ts` + `ContractPdfPanel.vue`.

## Função Edge `generate-contract-pdf`

- Stub com resposta JSON — não faz renderização.
