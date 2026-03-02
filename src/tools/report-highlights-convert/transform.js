export function convert(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const container =
    doc.querySelector('.content-box__data') ||
    doc.querySelector('.content-box') ||
    doc.body;

  const allPs = container.querySelectorAll('p');
  let headerP = null;
  for (const p of allPs) {
    if (p.textContent.includes('Report Highlights')) {
      headerP = p;
      break;
    }
  }

  if (!headerP) {
    throw new Error('Could not find a paragraph containing "Report Highlights".');
  }

  const anchor = headerP.querySelector('a[name="report-highlights"]');
  if (anchor) anchor.remove();

  let headerHTML = headerP.innerHTML.trim();

  // Format 1: <strong>Report Highlights</strong>: intro text...
  headerHTML = headerHTML.replace(
    /\s*<strong>\s*Report Highlights\s*<\/strong>\s*:\s*/i,
    '\n    <strong><u>Report Highlights</u>:</strong> '
  );

  // Format 2: <u>Report Highlights</u>:
  headerHTML = headerHTML.replace(
    /\s*<u>\s*Report Highlights\s*<\/u>\s*:\s*/i,
    '\n    <strong><u>Report Highlights</u>:</strong> '
  );

  headerHTML = headerHTML.trimEnd();

  const ul = container.querySelector('ul');
  if (!ul) {
    throw new Error('Could not find the <ul> list.');
  }

  const listItems = ul.querySelectorAll('li');
  let liBlocks = '';

  listItems.forEach((li) => {
    const p = li.querySelector('p');
    const pHTML = p ? p.innerHTML.trim() : li.innerHTML.trim();

    liBlocks +=
      '    <li>\n' +
      '      <i class="icon-info"></i>\n' +
      '      <p>' + pHTML + '</p>\n' +
      '    </li>\n';
  });

  return (
    '<div class="report-highlights">\n' +
    '  <p class="report-highlights__header">' + headerHTML + '\n' +
    '  </p>\n' +
    '  <ul class="report-highlights__list">\n' +
    liBlocks +
    '  </ul>\n' +
    '</div>'
  );
}
