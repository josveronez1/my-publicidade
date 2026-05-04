import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

/**
 * Converte o corpo Markdown do contrato (já com placeholders substituídos) para HTML
 * que pode ser inserido em v-html (sanitizado).
 */
export function contractMarkdownToSafeHtml(markdown: string): string {
  const raw = marked.parse(markdown.trim() || '—', { async: false }) as string
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel'],
  })
}
