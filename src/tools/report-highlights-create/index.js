import { create } from './transform';

export default {
  id: 'report-highlights-create',
  name: 'Create',
  category: 'Report Highlights',
  inputLabel: 'Plain Text Brief',
  inputPlaceholder: 'Report Highlights: Your intro text here.\n\n● First bullet point\n● Second bullet point\n● Third bullet point',
  outputLabel: 'Generated HTML',
  outputPlaceholder: 'Generated HTML will appear here...',
  transform: create,
};
