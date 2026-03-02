import { convert } from './transform';

export default {
  id: 'report-highlights-convert',
  name: 'Convert',
  category: 'Report Highlights',
  description: 'Converts old content-box HTML markup into the new report-highlights format. Paste the old HTML with .content-box wrappers and it will strip the wrapper divs, reformat the header with <strong><u> tags, add the .report-highlights classes, and inject icon elements into each list item.',
  inputLabel: 'Old HTML',
  inputPlaceholder: 'Paste the old content-box HTML here...',
  outputLabel: 'New HTML',
  outputPlaceholder: 'Converted HTML will appear here...',
  transform: convert,
};
