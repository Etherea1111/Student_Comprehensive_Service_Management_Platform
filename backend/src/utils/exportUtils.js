function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return ''
  }
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function rowsToCsv(headers, rows) {
  const headerLine = headers.map((header) => escapeCsvValue(header.label)).join(',')
  const lines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(resolveField(row, header.key))).join(',')
  )
  return `\ufeff${[headerLine, ...lines].join('\n')}`
}

function resolveField(row, key) {
  if (typeof key === 'function') {
    return key(row)
  }
  return row[key]
}

function sendCsv(res, filename, csvText) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csvText)
}

function sendTextAsPdf(res, filename, title, body) {
  const content = buildSimplePdf(title, body)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(Buffer.from(content, 'binary'))
}

function buildSimplePdf(title, body) {
  const text = String(`${title}\n\n${body}` || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = wrapPdfLines(text, 86)
  const streamLines = [
    'BT',
    '/F1 12 Tf',
    '50 790 Td'
  ]
  lines.forEach((line, index) => {
    if (index > 0) {
      streamLines.push('0 -18 Td')
    }
    streamLines.push(`<${toUtf16BeHex(line)}> Tj`)
  })
  streamLines.push('ET')
  const stream = streamLines.join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 5 >> >>\nendobj\n',
    `6 0 obj\n<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream\nendobj\n`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'))
    pdf += object
  })
  const xrefOffset = Buffer.byteLength(pdf, 'binary')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return pdf
}

function wrapPdfLines(text, width) {
  const lines = []
  text.split('\n').forEach((line) => {
    if (!line) {
      lines.push('')
      return
    }
    for (let i = 0; i < line.length; i += width) {
      lines.push(line.slice(i, i + width))
    }
  })
  return lines.slice(0, 38)
}

function toUtf16BeHex(value) {
  return Buffer.from(String(value || ''), 'utf16le').swap16().toString('hex').toUpperCase()
}

module.exports = {
  rowsToCsv,
  sendCsv,
  sendTextAsPdf
}
