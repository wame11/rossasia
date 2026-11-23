// A tiny dependency-free PDF writer, enough to draw a clean one-page A4 invoice.
// Uses the built-in Helvetica fonts (no font files) with WinAnsi encoding, so £ works.

const W = 595.28; // A4 in points
const H = 841.89;

// Helvetica glyph widths for characters 32..126 (units per 1000 em).
const WIDTHS = {
  regular: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
  bold: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584],
};

// Characters outside Latin-1 that Windows-1252 can still show.
const CP1252 = { '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '…': 0x85, '€': 0x80, '™': 0x99 };

/** Converts text to a string where every character is one WinAnsi byte. */
function encode(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0);
    if (CP1252[ch]) out += String.fromCharCode(CP1252[ch]);
    else if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) out += ch;
    else if (ch === '\n' || ch === '\t') out += ' ';
    else out += '?';
  }
  return out;
}

function textWidth(text, size, bold) {
  const table = bold ? WIDTHS.bold : WIDTHS.regular;
  let total = 0;
  for (const ch of encode(text)) {
    const code = ch.charCodeAt(0);
    total += code >= 32 && code <= 126 ? table[code - 32] : 556;
  }
  return (total * size) / 1000;
}

function wrap(text, size, bold, maxWidth) {
  const lines = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && textWidth(candidate, size, bold) > maxWidth) { lines.push(line); line = word; } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

class Page {
  constructor() { this.ops = []; }

  // y is measured from the top of the page, like a browser.
  text(str, x, y, { size = 10, bold = false, colour = [0.04, 0.05, 0.07], align = 'left' } = {}) {
    const encoded = encode(str);
    if (!encoded) return;
    const width = textWidth(str, size, bold);
    const tx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    const escaped = encoded.replace(/[\\()]/g, '\\$&');
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${colour.join(' ')} rg ${tx.toFixed(2)} ${(H - y).toFixed(2)} Td (${escaped}) Tj ET`);
  }

  // Draws wrapped text and returns the y position below the last line.
  paragraph(str, x, y, maxWidth, opts = {}) {
    const size = opts.size || 10;
    const leading = opts.leading || size * 1.45;
    for (const line of wrap(str, size, opts.bold, maxWidth)) { this.text(line, x, y, opts); y += leading; }
    return y;
  }

  rect(x, y, w, h, colour) {
    this.ops.push(`${colour.join(' ')} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  line(x1, y1, x2, y2, { colour = [0.8, 0.8, 0.78], width = 1, dash = null } = {}) {
    this.ops.push(`q ${colour.join(' ')} RG ${width} w ${dash ? `[${dash.join(' ')}] 0 d` : ''} ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S Q`);
  }

  toBytes(title) {
    const content = this.ops.join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      `<< /Title (${encode(title).replace(/[\\()]/g, '\\$&')}) /Producer (Webstitch) >>`,
    ];
    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objects.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    // Every character is a single byte by construction, so this mapping is exact.
    return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
  }
}

const BLUE = [0.165, 0.235, 1];
const INK = [0.04, 0.05, 0.07];
const GREY = [0.36, 0.38, 0.43];
const money = (pence) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return `${d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
};

/**
 * @param invoice  row from the invoices table (items already parsed to an array)
 * @param client   { business_name, contact_name, email, address }
 * @param business settings: { tradingName, legalName, address, email, phone, website, invoiceNote }
 * @param bank     { accountName, sortCode, accountNumber } from Worker secrets
 */
export function invoicePdf(invoice, client, business, bank) {
  const p = new Page();
  const left = 50;
  const right = W - 50;

  // Header: wordmark with the stitched underline, and the invoice title
  p.text((business.tradingName || 'Webstitch').toLowerCase(), left, 68, { size: 26, bold: true });
  const markWidth = textWidth((business.tradingName || 'Webstitch').toLowerCase(), 26, true);
  p.line(left, 78, left + markWidth, 78, { colour: BLUE, width: 2.2, dash: [6, 4] });
  p.text('INVOICE', right, 68, { size: 26, bold: true, align: 'right' });
  p.text(invoice.number, right, 86, { size: 11, colour: GREY, align: 'right' });

  // From / bill to / dates
  let y = 130;
  p.text('FROM', left, y, { size: 8, bold: true, colour: BLUE });
  p.text('BILL TO', 215, y, { size: 8, bold: true, colour: BLUE });
  p.text('DETAILS', 375, y, { size: 8, bold: true, colour: BLUE });
  y += 16;
  const fromLines = [business.tradingName || 'Webstitch', business.legalName ? `Trading name of ${business.legalName}` : '',
    ...String(business.address || '').split(/\n|,\s*/), business.email, business.phone, business.website].filter(Boolean);
  const toLines = [client.business_name, client.contact_name, ...String(client.address || '').split(/\n|,\s*/), client.email].filter(Boolean);
  fromLines.forEach((l, i) => p.text(l, left, y + i * 14, { size: 10, bold: i === 0, colour: i === 0 ? INK : GREY }));
  let toY = y;
  toLines.forEach((l, i) => { toY = p.paragraph(l, 215, toY, 145, { size: 10, bold: i === 0, colour: i === 0 ? INK : GREY, leading: 14 }); });
  [['Invoice date', ukDate(invoice.issue_date)], ['Payment due', ukDate(invoice.due_date)], ['Invoice no.', invoice.number]]
    .forEach(([label, value], i) => {
      p.text(label, 375, y + i * 14, { size: 10, colour: GREY });
      p.text(value, right, y + i * 14, { size: 10, align: 'right' });
    });

  // Line items
  y = Math.max(y + fromLines.length * 14, toY) + 34;
  p.rect(left, y - 14, right - left, 24, INK);
  p.text('DESCRIPTION', left + 12, y + 2, { size: 8, bold: true, colour: [1, 1, 1] });
  p.text('AMOUNT', right - 12, y + 2, { size: 8, bold: true, colour: [1, 1, 1], align: 'right' });
  y += 32;
  for (const item of invoice.items) {
    p.text(money(item.amount_pence), right - 12, y, { size: 10.5, align: 'right' });
    y = p.paragraph(item.description, left + 12, y, 360, { size: 10.5 });
    p.line(left, y - 2, right, y - 2, { dash: [3, 3] });
    y += 16;
  }
  y += 4;
  p.text('Total due', right - 140, y + 4, { size: 11, bold: true });
  p.text(money(invoice.total_pence), right - 12, y + 5, { size: 16, bold: true, align: 'right' });
  y += 34;

  if (invoice.monthly_pence > 0) {
    p.text('MONTHLY FEE (NOT INCLUDED IN THE TOTAL ABOVE)', left, y, { size: 8, bold: true, colour: BLUE });
    y = p.paragraph(`Your domain name and hosting: ${money(invoice.monthly_pence)} per month by standing order, `
      + 'starting on the day your website goes live. No minimum term. Cancel any time and take your domain with you.',
    left, y + 16, right - left, { size: 10, colour: GREY });
    y += 18;
  }

  // Payment box
  const boxHeight = 132;
  p.rect(left, y, right - left, boxHeight, [0.955, 0.958, 0.985]);
  p.rect(left, y, 4, boxHeight, BLUE);
  p.text('HOW TO PAY: UK BANK TRANSFER', left + 20, y + 24, { size: 8, bold: true, colour: BLUE });
  const rows = [['Account name', bank.accountName], ['Sort code', bank.sortCode], ['Account number', bank.accountNumber],
    ['Payment reference', invoice.reference], ['Amount', money(invoice.total_pence)]];
  rows.forEach(([label, value], i) => {
    p.text(label, left + 20, y + 46 + i * 17, { size: 10.5, colour: GREY });
    p.text(value || 'Not set', left + 150, y + 46 + i * 17, { size: 10.5, bold: true });
  });
  y += boxHeight + 26;

  if (invoice.status === 'Paid') {
    p.text(`PAID${invoice.paid_date ? ` ${ukDate(invoice.paid_date)}` : ''}. Thank you.`, left, y, { size: 13, bold: true, colour: [0.05, 0.5, 0.25] });
    y += 24;
  }
  const note = [invoice.notes, business.invoiceNote].filter(Boolean).join('\n');
  if (note) y = p.paragraph(note, left, y, right - left, { size: 9.5, colour: GREY });

  // Footer
  p.line(left, H - 62, right, H - 62, { colour: BLUE, width: 1.5, dash: [6, 4] });
  p.text('Please use the payment reference so that we can match your payment. Our bank details will only ever be sent on an invoice like this one.',
    W / 2, H - 46, { size: 7.5, colour: GREY, align: 'center' });
  p.text([business.tradingName || 'Webstitch', business.legalName ? `a trading name of ${business.legalName}` : '', business.website, business.email].filter(Boolean).join('  ·  '),
    W / 2, H - 34, { size: 7.5, colour: GREY, align: 'center' });

  return p.toBytes(`Invoice ${invoice.number}`);
}
