import type { jsPDF } from 'jspdf'
import { marked, type Tokens, type TokensList } from 'marked'

/**
 * Geração do PDF do contrato 100 % com jsPDF (texto vetorial).
 * - Sem html2canvas / html2pdf → não há snapshot raster, logo sem `oklch` a partir.
 * - Ficheiro leve (KBs) e texto selecionável.
 * - Fontes built-in (Helvetica) cobrem Latin-1 (PT-BR) via WinAnsi por defeito.
 */

marked.setOptions({ gfm: true, breaks: true })

const PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 18,
}

const FONT = {
  body: 10,
  small: 8.5,
  h1: 14,
  h2: 12,
  h3: 11,
  meta: 8,
}

const COLOR_TEXT: [number, number, number] = [17, 24, 39]
const COLOR_MUTED: [number, number, number] = [107, 114, 128]
const COLOR_RULE: [number, number, number] = [228, 228, 231]
const COLOR_ACCENT: [number, number, number] = [231, 187, 14]

type Weight = 'normal' | 'bold' | 'italic' | 'bolditalic'

type InlineSeg = { text: string; bold?: boolean; italic?: boolean }

interface Ctx {
  doc: jsPDF
  marginMm: number
  contentMm: number
  bottomMm: number
  y: number
}

function ptToMm(pt: number): number {
  return (pt * 25.4) / 72
}

function lineHeightMm(sizePt: number, factor = 1.35): number {
  return ptToMm(sizePt) * factor
}

function weightFor(seg: InlineSeg): Weight {
  if (seg.bold && seg.italic) return 'bolditalic'
  if (seg.bold) return 'bold'
  if (seg.italic) return 'italic'
  return 'normal'
}

function ensureSpace(ctx: Ctx, neededMm: number): void {
  if (ctx.y + neededMm > ctx.bottomMm) {
    ctx.doc.addPage()
    ctx.y = ctx.marginMm
  }
}

function setText(ctx: Ctx, color: [number, number, number]) {
  ctx.doc.setTextColor(color[0], color[1], color[2])
}

/* ---------- inline (negrito/itálico) ---------- */

type AnyInline = Tokens.Text | Tokens.Strong | Tokens.Em | Tokens.Codespan | Tokens.Br | Tokens.Link | Tokens.Del | Tokens.Escape | Tokens.HTML

const BR_TAG_RE = /<\s*br\s*\/?\s*>/gi
const HTML_TAG_RE = /<[^>]+>/g
const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/** Remove tags inline ( <br> vira \n; outras tags são despidas) e decodifica entities básicas. */
function stripInlineHtml(raw: string): string {
  if (!raw) return ''
  let out = raw.replace(BR_TAG_RE, '\n').replace(HTML_TAG_RE, '')
  for (const [entity, char] of Object.entries(HTML_ENTITY_REPLACEMENTS)) {
    out = out.split(entity).join(char)
  }
  return out
}

function flattenInline(tokens: AnyInline[] | undefined, parent: { bold: boolean; italic: boolean } = { bold: false, italic: false }): InlineSeg[] {
  if (!tokens) return []
  const out: InlineSeg[] = []
  for (const t of tokens) {
    switch (t.type) {
      case 'text': {
        const inner = (t as Tokens.Text).tokens as AnyInline[] | undefined
        if (inner && inner.length) out.push(...flattenInline(inner, parent))
        else {
          const cleaned = stripInlineHtml((t as Tokens.Text).text ?? '')
          if (cleaned) out.push({ text: cleaned, ...parent })
        }
        break
      }
      case 'strong':
        out.push(...flattenInline((t as Tokens.Strong).tokens as AnyInline[], { ...parent, bold: true }))
        break
      case 'em':
        out.push(...flattenInline((t as Tokens.Em).tokens as AnyInline[], { ...parent, italic: true }))
        break
      case 'codespan': {
        const cleaned = stripInlineHtml((t as Tokens.Codespan).text ?? '')
        if (cleaned) out.push({ text: cleaned, ...parent })
        break
      }
      case 'br':
        out.push({ text: '\n', ...parent })
        break
      case 'link':
        out.push(...flattenInline((t as Tokens.Link).tokens as AnyInline[], parent))
        break
      case 'del':
        out.push(...flattenInline((t as Tokens.Del).tokens as AnyInline[], parent))
        break
      case 'escape': {
        const cleaned = stripInlineHtml((t as Tokens.Escape).text ?? '')
        if (cleaned) out.push({ text: cleaned, ...parent })
        break
      }
      case 'html': {
        const raw = (t as Tokens.HTML).text ?? ''
        const cleaned = stripInlineHtml(raw)
        if (cleaned) out.push({ text: cleaned, ...parent })
        break
      }
      default:
        if ('text' in t && typeof (t as { text?: unknown }).text === 'string') {
          const cleaned = stripInlineHtml((t as { text: string }).text)
          if (cleaned) out.push({ text: cleaned, ...parent })
        }
    }
  }
  return out
}

/** Render word-by-word respeitando estilo de cada segmento e fazendo word-wrap manual. */
function drawInline(
  ctx: Ctx,
  segs: InlineSeg[],
  opts: { sizePt: number; lineMm: number; indentMm?: number; align?: 'left' | 'center' },
): void {
  const { sizePt, lineMm } = opts
  const indent = opts.indentMm ?? 0
  const align = opts.align ?? 'left'

  ctx.doc.setFontSize(sizePt)

  const startX = ctx.marginMm + indent
  const maxX = ctx.marginMm + ctx.contentMm
  const lineWidthMm = ctx.contentMm - indent

  type Tok = { text: string; weight: Weight; isWS: boolean; isLF: boolean }
  const toks: Tok[] = []
  for (const seg of segs) {
    const w = weightFor(seg)
    const parts = seg.text.split(/(\n|\s+)/g)
    for (const p of parts) {
      if (!p) continue
      const isLF = p === '\n'
      const isWS = !isLF && /^\s+$/.test(p)
      toks.push({ text: p, weight: w, isWS, isLF })
    }
  }

  type Line = { items: { text: string; weight: Weight; widthMm: number }[]; widthMm: number }
  const lines: Line[] = []
  let cur: Line = { items: [], widthMm: 0 }

  const widthOf = (text: string, weight: Weight) => {
    ctx.doc.setFont('helvetica', weight)
    return ctx.doc.getTextWidth(text)
  }

  for (const tk of toks) {
    if (tk.isLF) {
      lines.push(cur)
      cur = { items: [], widthMm: 0 }
      continue
    }
    if (cur.items.length === 0 && tk.isWS) continue

    const w = widthOf(tk.text, tk.weight)
    if (cur.widthMm + w > lineWidthMm) {
      if (tk.isWS) continue
      lines.push(cur)
      cur = { items: [{ text: tk.text, weight: tk.weight, widthMm: w }], widthMm: w }
      continue
    }
    cur.items.push({ text: tk.text, weight: tk.weight, widthMm: w })
    cur.widthMm += w
  }
  if (cur.items.length) lines.push(cur)

  for (const ln of lines) {
    ensureSpace(ctx, lineMm)
    let x = startX
    if (align === 'center') {
      x = startX + Math.max(0, (lineWidthMm - ln.widthMm) / 2)
    }
    let cx = x
    while (ln.items.length && /^\s+$/.test(ln.items[ln.items.length - 1].text)) {
      const dropped = ln.items.pop()
      if (dropped) ln.widthMm -= dropped.widthMm
    }
    for (const it of ln.items) {
      ctx.doc.setFont('helvetica', it.weight)
      ctx.doc.text(it.text, cx, ctx.y + ptToMm(sizePt) * 0.8)
      cx += it.widthMm
    }
    ctx.y += lineMm
    if (cx > maxX) {
      // não deve acontecer — mas força wrap defensivo
    }
  }
}

/* ---------- blocos ----------
 * Convenção: cada bloco desenha SÓ o seu conteúdo + um pequeno before quando faz sentido.
 * O `marked` emite tokens `space` entre blocos consecutivos — esse é o único “after” padrão.
 */

const SPACE_BETWEEN_BLOCKS_MM = 2.4
const HEADING_BEFORE_MM: Record<number, number> = { 1: 2, 2: 3.2, 3: 1.6 }

function drawHeading(ctx: Ctx, depth: number, segs: InlineSeg[]): void {
  const sizePt = depth === 1 ? FONT.h1 : depth === 2 ? FONT.h2 : FONT.h3
  ctx.y += HEADING_BEFORE_MM[depth] ?? 1.5
  setText(ctx, COLOR_TEXT)
  drawInline(
    ctx,
    segs.map((s) => ({ ...s, bold: true })),
    { sizePt, lineMm: lineHeightMm(sizePt, 1.2), align: depth === 1 ? 'center' : 'left' },
  )
  if (depth === 1) {
    ensureSpace(ctx, 1)
    ctx.doc.setDrawColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
    ctx.doc.setLineWidth(0.5)
    ctx.doc.line(ctx.marginMm, ctx.y, ctx.marginMm + ctx.contentMm, ctx.y)
    ctx.y += 1
  }
}

function drawParagraph(ctx: Ctx, segs: InlineSeg[]): void {
  if (segs.length === 0) return
  setText(ctx, COLOR_TEXT)
  drawInline(ctx, segs, { sizePt: FONT.body, lineMm: lineHeightMm(FONT.body) })
}

function drawList(ctx: Ctx, list: Tokens.List): void {
  const ordered = list.ordered
  const indentMm = 6.5
  setText(ctx, COLOR_TEXT)
  list.items.forEach((item, idx) => {
    const startNum = typeof list.start === 'number' ? list.start : 1
    const marker = ordered ? `${startNum + idx}.` : '•'
    ctx.doc.setFontSize(FONT.body)
    ctx.doc.setFont('helvetica', 'normal')
    ensureSpace(ctx, lineHeightMm(FONT.body))
    ctx.doc.text(marker, ctx.marginMm + 1.5, ctx.y + ptToMm(FONT.body) * 0.8)

    const segs: InlineSeg[] = []
    for (const tk of item.tokens) {
      if (tk.type === 'text') {
        const inner = (tk as Tokens.Text).tokens as AnyInline[] | undefined
        if (inner && inner.length) segs.push(...flattenInline(inner))
        else {
          const cleaned = stripInlineHtml((tk as Tokens.Text).text ?? '')
          if (cleaned) segs.push({ text: cleaned })
        }
      } else if (tk.type === 'paragraph') {
        segs.push(...flattenInline((tk as Tokens.Paragraph).tokens as AnyInline[]))
      }
    }
    drawInline(ctx, segs, { sizePt: FONT.body, lineMm: lineHeightMm(FONT.body), indentMm })
  })
}

function drawBlockquote(ctx: Ctx, segs: InlineSeg[]): void {
  const indentMm = 5
  const yStart = ctx.y
  setText(ctx, COLOR_MUTED)
  drawInline(ctx, segs, { sizePt: FONT.small, lineMm: lineHeightMm(FONT.small), indentMm })
  ctx.doc.setDrawColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2])
  ctx.doc.setLineWidth(0.8)
  ctx.doc.line(ctx.marginMm + 2, yStart, ctx.marginMm + 2, ctx.y - 0.5)
  setText(ctx, COLOR_TEXT)
}

function drawHr(ctx: Ctx): void {
  ctx.y += 1
  ensureSpace(ctx, 1.5)
  ctx.doc.setDrawColor(COLOR_RULE[0], COLOR_RULE[1], COLOR_RULE[2])
  ctx.doc.setLineWidth(0.3)
  ctx.doc.line(ctx.marginMm, ctx.y, ctx.marginMm + ctx.contentMm, ctx.y)
  ctx.y += 1
}

function drawTable(ctx: Ctx, table: Tokens.Table): void {
  const rows: string[] = []
  rows.push(table.header.map((h) => stripInlineHtml(h.text)).join('   ·   '))
  for (const row of table.rows) rows.push(row.map((c) => stripInlineHtml(c.text)).join('   ·   '))
  for (const r of rows) drawParagraph(ctx, [{ text: r }])
}

function renderTokens(ctx: Ctx, tokens: TokensList): void {
  for (const tk of tokens) {
    switch (tk.type) {
      case 'heading': {
        const h = tk as Tokens.Heading
        drawHeading(ctx, h.depth, flattenInline(h.tokens as AnyInline[]))
        break
      }
      case 'paragraph': {
        drawParagraph(ctx, flattenInline((tk as Tokens.Paragraph).tokens as AnyInline[]))
        break
      }
      case 'list':
        drawList(ctx, tk as Tokens.List)
        break
      case 'blockquote': {
        const segs = flattenInline(((tk as Tokens.Blockquote).tokens as Tokens.Generic[]).flatMap((t) => (t as { tokens?: AnyInline[] }).tokens ?? []))
        drawBlockquote(ctx, segs)
        break
      }
      case 'hr':
        drawHr(ctx)
        break
      case 'table':
        drawTable(ctx, tk as Tokens.Table)
        break
      case 'space':
        ctx.y += SPACE_BETWEEN_BLOCKS_MM
        break
      case 'code':
        drawParagraph(ctx, [{ text: (tk as Tokens.Code).text ?? '' }])
        break
      case 'html': {
        const cleaned = stripInlineHtml((tk as Tokens.HTML).text ?? '')
        if (cleaned.trim()) drawParagraph(ctx, [{ text: cleaned }])
        break
      }
      default:
        if ('text' in tk && typeof (tk as { text?: unknown }).text === 'string') {
          const cleaned = stripInlineHtml((tk as { text: string }).text)
          if (cleaned.trim()) drawParagraph(ctx, [{ text: cleaned }])
        }
    }
  }
}

/* ---------- logo ---------- */

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/* ---------- API ---------- */

export function safeContractPdfFileBase(contractNumber: string): string {
  return `MW-${contractNumber.replace(/[^a-zA-Z0-9._-]+/g, '_')}`
}

export async function renderContractPdfBlob(
  markdown: string,
  contractNumber: string,
  logoUrl: string | null,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const ctx: Ctx = {
    doc,
    marginMm: PAGE.marginMm,
    contentMm: PAGE.widthMm - PAGE.marginMm * 2,
    bottomMm: PAGE.heightMm - PAGE.marginMm,
    y: PAGE.marginMm,
  }

  if (logoUrl?.trim()) {
    const dataUrl = await fetchImageDataUrl(logoUrl)
    if (dataUrl) {
      try {
        const props = doc.getImageProperties(dataUrl)
        const targetH = 14
        const targetW = (props.width / props.height) * targetH
        const maxW = ctx.contentMm * 0.5
        const w = Math.min(targetW, maxW)
        const h = (props.height / props.width) * w
        const x = (PAGE.widthMm - w) / 2
        doc.addImage(dataUrl, props.fileType ?? 'PNG', x, ctx.y, w, h)
        ctx.y += h + 4
      } catch {
        /* ignora logo se falhar — PDF sai sem ele */
      }
    }
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FONT.meta)
  setText(ctx, COLOR_MUTED)
  ensureSpace(ctx, lineHeightMm(FONT.meta))
  doc.text(`${contractNumber} · MW Publicidade`, PAGE.widthMm / 2, ctx.y + ptToMm(FONT.meta) * 0.8, {
    align: 'center',
  })
  ctx.y += lineHeightMm(FONT.meta) + 2
  doc.setDrawColor(COLOR_RULE[0], COLOR_RULE[1], COLOR_RULE[2])
  doc.setLineWidth(0.3)
  doc.line(ctx.marginMm, ctx.y, ctx.marginMm + ctx.contentMm, ctx.y)
  ctx.y += 5

  setText(ctx, COLOR_TEXT)
  const tokens = marked.lexer(markdown.trim() || '—')
  renderTokens(ctx, tokens)

  return doc.output('blob')
}

export async function downloadContractPdf(
  markdown: string,
  contractNumber: string,
  logoUrl: string | null,
): Promise<void> {
  const blob = await renderContractPdfBlob(markdown, contractNumber, logoUrl)
  const name = `${safeContractPdfFileBase(contractNumber)}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
