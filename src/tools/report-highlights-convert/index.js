import { convert } from './transform';

export default {
  id: 'report-highlights-convert',
  name: 'Convert',
  category: 'Report Highlights',
  inputLabel: 'Old HTML',
  inputPlaceholder: 'Paste the old content-box HTML here...',
  outputLabel: 'New HTML',
  outputPlaceholder: 'Converted HTML will appear here...',
  transform: convert,
};
