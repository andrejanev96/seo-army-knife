import LinkCleaner from './LinkCleaner';

export default {
  id: 'link-cleaner',
  name: 'Redundant Link Cleaner',
  category: null,
  description: 'Analyzes HTML articles, identifies redundant and duplicate links, and lets you interactively toggle which links to keep or remove. Image links, CTA buttons, and the first occurrence of each URL are preserved by default.',
  component: LinkCleaner,
};
