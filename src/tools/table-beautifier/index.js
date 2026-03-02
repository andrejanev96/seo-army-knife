import { beautifyTable } from './transform';

export default {
  id: 'table-beautifier',
  name: 'Table Beautifier',
  category: null,
  description: 'Transforms any HTML table into the standard styled template. Strips existing inline styles and applies the dark theme with a gold left border, red header text, alternating row backgrounds, and consistent cell padding. Works with tables that have <thead>, <th>, or plain <td> headers.',
  inputLabel: 'Any HTML Table',
  inputPlaceholder: 'Paste any HTML <table> here...',
  outputLabel: 'Beautified Table',
  outputPlaceholder: 'Styled table will appear here...',
  transform: beautifyTable,
};
