import { beautifyTable } from './transform';

export default {
  id: 'table-beautifier',
  name: 'Table Beautifier',
  category: null,
  inputLabel: 'Any HTML Table',
  inputPlaceholder: 'Paste any HTML <table> here...',
  outputLabel: 'Beautified Table',
  outputPlaceholder: 'Styled table will appear here...',
  transform: beautifyTable,
};
