import reportHighlightsConvert from './report-highlights-convert';
import reportHighlightsCreate from './report-highlights-create';
import tableBeautifier from './table-beautifier';
import linkCleaner from './link-cleaner';
import ogChecker from './og-checker';

const tools = [
  reportHighlightsConvert,
  reportHighlightsCreate,
  tableBeautifier,
  linkCleaner,
  ogChecker,
];

export default tools;

export function getToolById(id) {
  return tools.find((t) => t.id === id);
}

export function getToolsByCategory() {
  const categories = new Map();
  for (const tool of tools) {
    const key = tool.category || '_standalone';
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key).push(tool);
  }
  return categories;
}
