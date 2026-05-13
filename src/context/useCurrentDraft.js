import { useContext } from 'react';
import { CurrentDraftContext } from './current-draft-context';

export function useCurrentDraft() {
  const ctx = useContext(CurrentDraftContext);
  if (!ctx) {
    throw new Error('useCurrentDraft must be used inside <CurrentDraftProvider>');
  }
  return ctx;
}
