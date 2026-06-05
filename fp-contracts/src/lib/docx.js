// src/lib/docx.js
// Сборка .docx из блоков. Шрифт Cambria, основной текст 10pt, поля по ТЗ,
// колонтитул: парафы сторон по всей ширине + номер страницы.
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  Footer, PageNumber, TabStopType,
} from 'docx'

const FONT = 'Cambria'
const BODY = 20          // half-points: 10pt — основной текст
const TITLE = 24         // 12pt
const TABLE = 18         // 9pt — реквизиты
const FOOT = 18          // 9pt — колонтитул

// поля (twips, 1 см ≈ 567): лево 2,4 / право 1,4 / верх-низ 1,5 см
const MARGIN = { top: 850, bottom: 850, left: 1361, right: 794 }
// A4
const PAGE = { width: 11906, height: 16838 }
// правый край текста = ширина − левое − правое поле
const RIGHT_TAB = PAGE.width - MARGIN.left - MARGIN.right   // 9751

const border = { style: BorderStyle.SINGLE, size: 2, color: '000000' }
const cellBorders = { top: border, bottom: border, left: border, right: border }

function run(text, opts = {}) {
  return new TextRun({ text, bold: opts.bold, size: opts.size || BODY, font: FONT })
}
function cell(text, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 60, bottom: opts.tall ? 240 : 60, left: 80, right: 80 },
    children: [new Paragraph({ children: [run(text, { ...opts, size: TABLE })] })],
  })
}

function blocksToChildren(blocks) {
  const children = []
  for (const b of blocks) {
    if (b.t === 'title') {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 160 },
        children: [run(b.text, { bold: true, size: TITLE })],
      }))
    } else if (b.t === 'date') {
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        spacing: { after: 200 },
        children: [run(b.city), run(`\t${b.date}`)],
      }))
    } else if (b.t === 'h') {
      children.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [run(b.text, { bold: true })] }))
    } else if (b.t === 'p') {
      children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 }, children: [run(b.text)] }))
    } else if (b.t === 'requisites') {
      const n = Math.max(b.dev.length, b.par.length)
      const rows = []
      rows.push(new TableRow({ children: [cell('Разработчик', { bold: true }), cell('Партнер', { bold: true })] }))
      for (let i = 0; i < n; i++) rows.push(new TableRow({ children: [cell(b.dev[i] || ''), cell(b.par[i] || '')] }))
      rows.push(new TableRow({ children: [cell(b.devRole), cell(b.parRole)] }))
      rows.push(new TableRow({ children: [cell(`____________________ /${b.devSign}/`, { tall: true }), cell(`____________________ /${b.parSign}/`, { tall: true })] }))
      children.push(new Paragraph({ spacing: { before: 200 }, children: [] }))
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
    }
  }
  return children
}

function buildDoc(blocks) {
  const req = blocks.find(b => b.t === 'requisites') || {}
  const footer = new Footer({
    children: [
      // парафы по всей ширине: Разработчик слева, Партнер справа
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        spacing: { before: 120, after: 40 },
        children: [
          run(`Разработчик: ______________ /${req.devSign || ''}/`, { size: FOOT }),
          run(`\tПартнер: ______________ /${req.parSign || ''}/`, { size: FOOT }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run('Стр. ', { size: FOOT }),
          new TextRun({ children: [PageNumber.CURRENT], size: FOOT, font: FONT }),
          run(' из ', { size: FOOT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: FOOT, font: FONT })],
      }),
    ],
  })

  return new Document({
    sections: [{
      properties: { page: { size: PAGE, margin: MARGIN } },
      footers: { default: footer },
      children: blocksToChildren(blocks),
    }],
  })
}

export async function downloadDocx(blocks, filename = 'Договор.docx') {
  const doc = buildDoc(blocks)
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
