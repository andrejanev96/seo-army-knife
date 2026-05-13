import { useState, useCallback, useMemo } from 'react';
import { CurrentDraftContext, STORAGE_KEY } from './current-draft-context';

// Lazy-read the buffer from localStorage on first render. Survives reloads
// and tab switches; cleared by explicit user action only.
function readInitial() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.html === 'string' && parsed.html.length > 0) {
      return parsed;
    }
  } catch {
    /* corrupted entry — ignore */
  }
  return null;
}

function deriveTitle(doc) {
  const h1 = doc.querySelector('h1');
  if (h1 && h1.textContent.trim()) return h1.textContent.trim().slice(0, 200);
  const title = doc.querySelector('title');
  if (title && title.textContent.trim()) return title.textContent.trim().slice(0, 200);
  const firstHeading = doc.querySelector('h2, h3');
  if (firstHeading && firstHeading.textContent.trim()) {
    return firstHeading.textContent.trim().slice(0, 200);
  }
  const text = (doc.body?.textContent || '').trim();
  return text ? text.slice(0, 80).replace(/\s+/g, ' ') + (text.length > 80 ? '…' : '') : '';
}

function countWords(doc) {
  const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').filter((t) => t.length > 0).length;
}

function buildDraft(html) {
  const safeHtml = String(html || '').trim();
  if (!safeHtml) return null;
  const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, 'text/html');
  return {
    html: safeHtml,
    title: deriveTitle(doc),
    wordCount: countWords(doc),
    setAt: Date.now(),
  };
}

export function CurrentDraftProvider({ children }) {
  const [draft, setDraftState] = useState(readInitial);

  const setDraft = useCallback((html) => {
    const next = buildDraft(html);
    setDraftState(next);
    try {
      if (next) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* quota or disabled — in-memory state is still correct */
    }
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft, clearDraft }),
    [draft, setDraft, clearDraft]
  );

  return (
    <CurrentDraftContext.Provider value={value}>
      {children}
    </CurrentDraftContext.Provider>
  );
}
