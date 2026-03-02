export function beautifyTable(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');

  if (!table) {
    throw new Error('Could not find a <table> element.');
  }

  // Extract header cells
  const headers = [];
  const thEls = table.querySelectorAll('thead th, thead td, tr:first-child th');
  thEls.forEach((th) => headers.push(th.textContent.trim()));

  // If no thead, check if first row has <th> or looks like a header
  let bodyRows;
  if (headers.length > 0) {
    bodyRows = table.querySelectorAll('tbody tr');
    if (bodyRows.length === 0) {
      const allRows = table.querySelectorAll('tr');
      bodyRows = Array.from(allRows).slice(1);
    }
  } else {
    const allRows = table.querySelectorAll('tr');
    if (allRows.length === 0) throw new Error('Table has no rows.');
    const firstRow = allRows[0];
    firstRow.querySelectorAll('td, th').forEach((c) => headers.push(c.textContent.trim()));
    bodyRows = Array.from(allRows).slice(1);
  }

  if (headers.length === 0) throw new Error('Could not determine table headers.');

  // Extract body data (preserve innerHTML for links, bold, etc.)
  const rows = [];
  bodyRows.forEach((tr) => {
    const cells = [];
    tr.querySelectorAll('td, th').forEach((c) => cells.push(c.innerHTML.trim()));
    if (cells.length > 0) rows.push(cells);
  });

  // Style constants
  const TABLE = 'border-collapse: collapse; width: 100%; margin: 0 auto 20px auto; border-left: 4px solid #C59925;';
  const TR_HEAD = 'background: #2a2a2a;';
  const TH = 'padding: 12px 15px; text-align: center; color: #D44B3E; font-weight: 600; border-bottom: 1px solid #444;';
  const BG_ODD = '#252525';
  const BG_EVEN = '#1e1e1e';
  const BORDER_BOTTOM = ' border-bottom: 1px solid #333;';

  // Build output
  let out = '<table style="' + TABLE + '">\n';

  // thead
  out += '  <thead>\n    <tr style="' + TR_HEAD + '">\n';
  headers.forEach((h) => {
    out += '      <th style="' + TH + '">' + h + '</th>\n';
  });
  out += '    </tr>\n  </thead>\n';

  // tbody
  out += '  <tbody>\n';
  rows.forEach((cells, i) => {
    const bg = i % 2 === 0 ? BG_ODD : BG_EVEN;
    const isLast = i === rows.length - 1;
    const border = isLast ? '' : BORDER_BOTTOM;

    out += '    <tr>\n';
    cells.forEach((cell) => {
      out += '      <td style="padding: 12px 15px; text-align: center; background: ' + bg + ';' + border + '">' + cell + '</td>\n';
    });
    out += '    </tr>\n';
  });
  out += '  </tbody>\n</table>';

  return out;
}
