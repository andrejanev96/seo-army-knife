export function create(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('Input is empty.');
  }

  const firstLine = lines[0];
  let intro = '';

  const headerMatch = firstLine.match(/^Report Highlights\s*:\s*(.*)/i);
  if (headerMatch) {
    intro = headerMatch[1].trim();
  } else {
    intro = firstLine.replace(/^[●•*\-]\s*/, '').trim();
  }

  const items = lines.slice(headerMatch ? 1 : 0);
  const bulletItems = items
    .map((l) => l.replace(/^[●•*\-]\s*/, '').trim())
    .filter((l) => l.length > 0);

  if (bulletItems.length === 0) {
    throw new Error('No list items found.');
  }

  let headerContent = '\n    <strong><u>Report Highlights</u>:</strong>';
  if (intro) {
    headerContent += ' ' + intro;
  }

  let liBlocks = '';
  bulletItems.forEach((item) => {
    liBlocks +=
      '    <li>\n' +
      '      <i class="icon-info"></i>\n' +
      '      <p>' + item + '</p>\n' +
      '    </li>\n';
  });

  return (
    '<div class="report-highlights">\n' +
    '  <p class="report-highlights__header">' + headerContent + '\n' +
    '  </p>\n' +
    '  <ul class="report-highlights__list">\n' +
    liBlocks +
    '  </ul>\n' +
    '</div>'
  );
}
