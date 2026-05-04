import { getDefaultHtml2PdfOptions } from '@/infrastructure/contractDocument/pdfOptions'

/**
 * Gera um PDF (Blob) a partir do nó de pré-visualização alimentado com HTML + logo.
 * `html2pdf.js` carrega-se em dinâmico para não inflar o chunk da rota.
 */
export async function renderContractElementToPdfBlob(
  element: HTMLElement,
  fileBaseName: string,
): Promise<Blob> {
  const { default: html2pdf } = await import('html2pdf.js')
  const name = fileBaseName.toLowerCase().endsWith('.pdf') ? fileBaseName : `${fileBaseName}.pdf`
  const opt = getDefaultHtml2PdfOptions(name)
  return html2pdf().set(opt).from(element).outputPdf('blob') as Promise<Blob>
}
