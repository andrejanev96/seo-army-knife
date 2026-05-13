import { createContext } from 'react';

// Shape of the value provided:
// {
//   draft: { html, title, wordCount, setAt } | null,
//   setDraft: (html: string) => void,
//   clearDraft: () => void,
// }
export const CurrentDraftContext = createContext(null);

export const STORAGE_KEY = 'sak:currentDraft';
