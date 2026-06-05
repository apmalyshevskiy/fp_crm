// src/lib/print.js
// Печать готового HTML договора в чистом окне A4. Cambria, основной текст 10pt,
// поля: лево 2,4 / право 1,4 / верх-низ 1,5 см (как в DOCX).

const PRINT_CSS = `
  @page { size: A4; margin: 1.5cm 1.4cm 1.5cm 2.4cm; }
  body { font-family: Cambria, Georgia, serif; font-size: 10pt; line-height: 1.35; color: #000; }
  .doc-title { font-size: 12pt; text-align: center; font-weight: bold; }
  .doc-date { display: flex; justify-content: space-between; margin: 10px 0 16px; }
  .doc-date .spacer { flex: 1; }
  h3 { font-size: 10pt; margin: 12px 0 5px; }
  p { margin: 4px 0; text-align: justify; }
  table.req { width: 100%; border-collapse: collapse; margin-top: 16px; page-break-inside: avoid; }
  table.req th, table.req td { border: 1px solid #000; padding: 4px 8px; vertical-align: top; width: 50%; font-size: 9pt; }
  table.req .sign td { padding-top: 28px; border-top: none; }
`

export function printHtml(bodyHtml, title = 'Договор') {
  if (!bodyHtml) return
  const w = window.open('', '_blank')
  if (!w) { alert('Разрешите всплывающие окна, чтобы напечатать договор.'); return }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title><style>${PRINT_CSS}</style></head>
    <body><div class="doc">${bodyHtml}</div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 200)
}
