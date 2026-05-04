/**
 * O `html2canvas` não suporta a função CSS `oklch()` (Tailwind v4 / tema).
 * No documento clonado, injetamos regras só com `rgb()` para a captura do PDF.
 */
function injectPdfSafeColorsInClone(
  clonedDocument: Document,
  clonedElement: HTMLElement,
) {
  const s = clonedDocument.createElement('style')
  s.textContent = `
    .contract-pdf-a4 { background: rgb(255, 255, 255) !important; box-shadow: none !important; }
    .contract-pdf-a4, .contract-pdf-a4 * { color: rgb(15, 23, 42) !important; }
    .contract-pdf-a4 a { color: rgb(176, 138, 11) !important; }
    .contract-pdf-a4 blockquote { color: rgb(71, 85, 105) !important; border-left-color: rgb(203, 213, 225) !important; }
    .contract-pdf-a4 pre { background: rgb(248, 250, 252) !important; }
    .contract-pdf-a4 code { background: rgb(241, 245, 249) !important; color: rgb(51, 65, 85) !important; }
    .contract-pdf-a4 th, .contract-pdf-a4 td { border-color: rgb(226, 232, 240) !important; }
    .contract-pdf-a4 th { background: rgb(241, 245, 249) !important; }
  `
  const styleParent = clonedDocument.head ?? clonedDocument.body
  if (styleParent) styleParent.appendChild(s)
  if (clonedElement.classList?.contains('contract-pdf-a4')) {
    clonedElement.style.setProperty('box-shadow', 'none', 'important')
  }
}

/** Opções A4 alinhadas ao `html2pdf.js` (navegador). */
export function getDefaultHtml2PdfOptions(filename: string) {
  return {
    margin: [8, 8, 8, 8] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.92 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (clonedDocument: Document, clonedElement: HTMLElement) => {
        injectPdfSafeColorsInClone(clonedDocument, clonedElement)
      },
    },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    pagebreak: { mode: ['css', 'legacy'] as const },
  }
}
