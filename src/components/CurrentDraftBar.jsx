import { useState, useId, useRef, useEffect } from 'react';
import { useCurrentDraft } from '../context/useCurrentDraft';
import { useToast } from '../context/useToast';
import { ChevronIcon } from './icons';
import './CurrentDraftBar.css';

// Cross-tool article-HTML buffer. Sits above every tool. When no draft is
// set, renders as a slim "Set draft" toggle. When a draft is set, renders a
// one-line summary with title + word count + age + clear button.
//
// Tools that consume article HTML (link-cleaner, og-checker HTML mode,
// upcoming heading-auditor / image-audit / publish-checklist) read from
// here via useCurrentDraft() so the user pastes once and runs many audits.
export default function CurrentDraftBar() {
  const { draft, setDraft, clearDraft } = useCurrentDraft();
  const showToast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const textareaRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [expanded]);

  const handleSave = () => {
    const trimmed = pasteValue.trim();
    if (!trimmed) {
      showToast('Paste some HTML first', true);
      return;
    }
    setDraft(trimmed);
    setPasteValue('');
    setExpanded(false);
    showToast('Saved as current draft');
  };

  const handleClear = () => {
    clearDraft();
    showToast('Draft cleared');
  };

  return (
    <div className={`draft-bar ${draft ? 'draft-bar--set' : 'draft-bar--empty'}`}>
      <div className="draft-bar__row">
        <div className="draft-bar__summary">
          {draft ? (
            <>
              <span className="draft-bar__chip" title="Cross-tool article buffer">DRAFT</span>
              <span className="draft-bar__title" title={draft.title}>
                {draft.title || 'Untitled draft'}
              </span>
              <span className="draft-bar__meta">
                {draft.wordCount.toLocaleString()} words · {formatAge(draft.setAt)}
              </span>
            </>
          ) : (
            <>
              <span className="draft-bar__chip draft-bar__chip--muted">DRAFT</span>
              <span className="draft-bar__meta">No draft set — paste an article to share it across tools.</span>
            </>
          )}
        </div>
        <div className="draft-bar__actions">
          <button
            type="button"
            className="draft-bar__btn"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            {draft ? 'Replace' : 'Set draft'}
            <ChevronIcon direction={expanded ? 'up' : 'down'} size={12} />
          </button>
          {draft && (
            <button
              type="button"
              className="draft-bar__btn draft-bar__btn--ghost"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="draft-bar__panel" id={panelId}>
          <textarea
            ref={textareaRef}
            className="draft-bar__textarea"
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder="Paste your article HTML here. Tools that work on article-shaped HTML can load it from this buffer."
            spellCheck={false}
          />
          <div className="draft-bar__panel-actions">
            <button type="button" className="draft-bar__btn draft-bar__btn--primary" onClick={handleSave}>
              Save as current draft
            </button>
            <button
              type="button"
              className="draft-bar__btn draft-bar__btn--ghost"
              onClick={() => { setPasteValue(''); setExpanded(false); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatAge(setAt) {
  if (!setAt) return 'just now';
  const seconds = Math.max(0, Math.floor((Date.now() - setAt) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
