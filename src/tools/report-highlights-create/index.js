import { create } from './transform';

export default {
  id: 'report-highlights-create',
  name: 'Create',
  category: 'Report Highlights',
  description: 'Generates report-highlights HTML from a plain text brief. The first line should be "Report Highlights:" followed by optional intro text. Each subsequent line becomes a bullet point. Bullet prefixes like \u25CF, \u2022, *, or - are stripped automatically.',
  inputLabel: 'Plain Text Brief',
  inputPlaceholder: 'Report Highlights: Your intro text here.\n\n\u25CF First bullet point\n\u25CF Second bullet point\n\u25CF Third bullet point',
  outputLabel: 'Generated HTML',
  outputPlaceholder: 'Generated HTML will appear here...',
  transform: create,
};
