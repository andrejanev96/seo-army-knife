import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '../../context/useToast';
import {
  AlertTriangleIcon,
  ImageIcon,
  InfoIcon,
  DotIcon,
  CheckIcon,
  ClipboardIcon,
} from '../../components/icons';
import {
  analyzeHtml,
  computeAutoStrip,
  computeKeepAll,
  generateCleanHtml,
  generateCleanHtmlFromPreview,
  generatePreviewHtml,
} from './engine';
import './LinkCleaner.css';

const WARNING_ICONS = {
  broken: AlertTriangleIcon,
  'image-only': ImageIcon,
  heading: InfoIcon,
  density: DotIcon,
};

export default function LinkCleaner() {
  const showToast = useToast();
  const iframeRef = useRef(null);
  const previewReadyRef = useRef(false);
  const placeholdersRef = useRef([]);
  const pendingPreviewRef = useRef(null);
  const stampedHtmlRef = useRef('');

  // Input state
  const [domain, setDomain] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [inputCollapsed, setInputCollapsed] = useState(false);

  // Analysis state
  const [analyzed, setAnalyzed] = useState(false);
  const [links, setLinks] = useState([]);
  const [groups, setGroups] = useState({});
  const [keepMap, setKeepMap] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [stats, setStats] = useState({});
  const [articleTitle, setArticleTitle] = useState('');
  const [cleanHtml, setCleanHtml] = useState('');
  const [targetSelfCount, setTargetSelfCount] = useState(0);
  const [isClean, setIsClean] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('preview');

  // Undo history: a stack of prior keepMap snapshots, each with a label so
  // the toast / button can announce what got undone.
  const [history, setHistory] = useState([]);

  // Refs for stable callbacks — populated via effect so we don't write to a
  // ref during render (which the react-hooks lint rule disallows).
  const linksRef = useRef(links);
  const keepMapRef = useRef(keepMap);
  const analyzeRef = useRef(() => {});
  const undoRef = useRef(() => {});

  useEffect(() => { linksRef.current = links; });
  useEffect(() => { keepMapRef.current = keepMap; });

  // Record the current keepMap onto the history stack before a mutation.
  const recordHistory = useCallback((label) => {
    setHistory((h) => [...h, { label, keepMap: keepMapRef.current }].slice(-25));
  }, []);

  const broadcastKeepMap = useCallback((newKeep) => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;
    const updates = linksRef.current
      .filter((l) => !l.isImageLink && !l.isCtaLink)
      .map((l) => ({ id: l.id, keep: newKeep[l.id] !== false }));
    frame.contentWindow.postMessage({ type: 'srlc-update-all', updates }, '*');
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setKeepMap(last.keepMap);
      broadcastKeepMap(last.keepMap);
      showToast(`Undid: ${last.label}`);
      return h.slice(0, -1);
    });
  }, [broadcastKeepMap, showToast]);

  useEffect(() => { undoRef.current = handleUndo; });

  // Toggle a single link keep/remove
  const toggleLink = useCallback((id) => {
    const link = linksRef.current.find((l) => l.id === id);
    if (!link || link.isImageLink || link.isCtaLink) return;

    recordHistory(link.anchorText ? `toggle "${link.anchorText.slice(0, 30)}"` : 'toggle link');
    const newKeep = !keepMapRef.current[id];
    setKeepMap((prev) => ({ ...prev, [id]: newKeep }));

    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage({ type: 'srlc-update', id, keep: newKeep }, '*');
    }
  }, [recordHistory]);

  // Listen for iframe toggle messages — only from our own iframe.
  useEffect(() => {
    const handler = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'srlc-toggle' && typeof e.data.id === 'number') {
        toggleLink(e.data.id);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [toggleLink]);

  // Apply pending preview to iframe after it appears in the DOM
  useEffect(() => {
    const preview = pendingPreviewRef.current;
    if (!analyzed || !preview) return;
    pendingPreviewRef.current = null;

    const frame = iframeRef.current;
    if (!frame) return;

    frame.srcdoc = preview.html;
    frame.onload = () => {
      previewReadyRef.current = true;
      if (frame.contentDocument?.body) {
        const cleanResult = generateCleanHtmlFromPreview(
          frame.contentDocument.body, keepMapRef.current, preview.placeholders
        );
        setCleanHtml(cleanResult.html);
        setTargetSelfCount(cleanResult.targetSelfCount);
      }
    };
  }, [analyzed, links]);

  // Recalculate clean HTML whenever keepMap changes
  useEffect(() => {
    if (!analyzed || links.length === 0) return;

    const frame = iframeRef.current;
    if (previewReadyRef.current && frame?.contentDocument?.body) {
      const result = generateCleanHtmlFromPreview(
        frame.contentDocument.body, keepMap, placeholdersRef.current
      );
      setCleanHtml(result.html);
      setTargetSelfCount(result.targetSelfCount);
    } else if (stampedHtmlRef.current) {
      const result = generateCleanHtml(stampedHtmlRef.current, keepMap, placeholdersRef.current);
      setCleanHtml(result.html);
      setTargetSelfCount(result.targetSelfCount);
    }
  }, [keepMap, analyzed, links]);

  // Analyze handler
  const handleAnalyze = useCallback(() => {
    const html = htmlInput.trim();
    if (!html) { showToast('Paste some HTML first', true); return; }

    const result = analyzeHtml(html, domain);
    const autoKeep = computeAutoStrip(result.links, result.groups);
    const removed = result.links.filter((l) => !autoKeep[l.id]).length;

    stampedHtmlRef.current = result.stampedHtml;
    placeholdersRef.current = result.placeholders;

    setLinks(result.links);
    setGroups(result.groups);
    setKeepMap(autoKeep);
    setWarnings(result.warnings);
    setStats(result.stats);
    setArticleTitle(result.title);
    setAnalyzed(true);
    setInputCollapsed(true);
    setActiveTab('preview');
    setIsClean(removed === 0);

    // Generate preview (deferred to useEffect so iframe is in the DOM)
    previewReadyRef.current = false;
    const preview = generatePreviewHtml(result.stampedHtml, result.links, autoKeep, result.placeholders);
    pendingPreviewRef.current = preview;

    // Initial clean HTML (before preview loads)
    const cleanResult = generateCleanHtml(result.stampedHtml, autoKeep, result.placeholders);
    setCleanHtml(cleanResult.html);
    setTargetSelfCount(cleanResult.targetSelfCount);

    if (removed === 0) {
      showToast('✅ Article is clean — no redundant links!');
    } else {
      showToast(`${result.stats.totalLinks} links, ${result.stats.uniqueUrls} unique URLs — ${removed} marked for removal`);
    }
  }, [htmlInput, domain, showToast]);

  useEffect(() => { analyzeRef.current = handleAnalyze; });

  const handleAutoStrip = useCallback(() => {
    recordHistory('Auto-strip');
    const newKeep = computeAutoStrip(links, groups);
    setKeepMap(newKeep);
    broadcastKeepMap(newKeep);
    showToast('Auto-strip applied');
  }, [links, groups, broadcastKeepMap, recordHistory, showToast]);

  const handleKeepAll = useCallback(() => {
    recordHistory('Keep All');
    const newKeep = computeKeepAll(links);
    setKeepMap(newKeep);
    broadcastKeepMap(newKeep);
    showToast('All links set to keep');
  }, [links, broadcastKeepMap, recordHistory, showToast]);

  const handleReset = useCallback(() => {
    setHtmlInput('');
    setAnalyzed(false);
    setLinks([]);
    setGroups({});
    setKeepMap({});
    setWarnings([]);
    setStats({});
    setArticleTitle('');
    setCleanHtml('');
    setTargetSelfCount(0);
    setInputCollapsed(false);
    setIsClean(false);
    setActiveTab('preview');
    previewReadyRef.current = false;
    placeholdersRef.current = [];
    pendingPreviewRef.current = null;
    stampedHtmlRef.current = '';
    setHistory([]);
  }, []);

  const handleNextArticle = useCallback((e) => {
    if (e) e.stopPropagation();
    handleReset();
    showToast('Ready for next article');
  }, [handleReset, showToast]);

  // Refresh clean HTML from preview (captures text edits)
  const refreshCleanHtml = useCallback(() => {
    const frame = iframeRef.current;
    if (previewReadyRef.current && frame?.contentDocument?.body) {
      const result = generateCleanHtmlFromPreview(
        frame.contentDocument.body, keepMap, placeholdersRef.current
      );
      setCleanHtml(result.html);
      setTargetSelfCount(result.targetSelfCount);
      return result.html;
    }
    return cleanHtml;
  }, [keepMap, cleanHtml]);

  const handleCopy = useCallback(() => {
    const text = refreshCleanHtml();
    if (!text) { showToast('Nothing to copy', true); return; }
    navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
  }, [refreshCleanHtml, showToast]);

  const handleDownload = useCallback(() => {
    const html = refreshCleanHtml();
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cleaned-article.html';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Downloaded!');
  }, [refreshCleanHtml, showToast]);

  const handleTabSwitch = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'clean') refreshCleanHtml();
  }, [refreshCleanHtml]);

  // Keyboard shortcuts. Bound once; latest handlers called via refs.
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        analyzeRef.current();
      } else if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        // Don't hijack undo inside the paste textarea — the OS undo there is
        // what users expect. Only intercept when focus is outside form fields.
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag === 'textarea' || tag === 'input') return;
        e.preventDefault();
        undoRef.current();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Derived state
  const kept = links.filter((l) => keepMap[l.id] !== false).length;
  const removed = links.filter((l) => keepMap[l.id] === false).length;
  const removedLinks = links.filter((l) => keepMap[l.id] === false);
  const totalChanges = removedLinks.length + targetSelfCount;

  const removedByUrl = {};
  removedLinks.forEach((l) => {
    if (!removedByUrl[l.normalizedHref]) removedByUrl[l.normalizedHref] = [];
    removedByUrl[l.normalizedHref].push(l);
  });

  return (
    <div className="lc">
      <div className="lc__header">
        <h2 className="lc__title">Redundant Link Cleaner</h2>
        <p className="lc__description">
          Analyzes HTML articles, identifies redundant and duplicate links, and lets you interactively
          toggle which links to keep or remove. Image links, CTA buttons, and the first occurrence of
          each URL are preserved by default. Text around links is editable in the preview.
        </p>
      </div>

      {/* Domain Input */}
      <div className="lc__domain">
        <label htmlFor="lc-domain">Site domain</label>
        <input
          type="text"
          id="lc-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. ammo.com (optional)"
        />
      </div>

      {/* Input Section */}
      <div className="lc__input-section">
        {inputCollapsed && (
          <div className="lc__collapse-bar" onClick={() => setInputCollapsed(false)}>
            <span className="lc__collapse-label">HTML Input</span>
            <span className="lc__collapse-summary">
              {articleTitle ? `${articleTitle}  ·  ` : ''}
              {htmlInput.length.toLocaleString()} chars, {stats.totalLinks} links found
            </span>
            <span className="lc__collapse-toggle">Show</span>
          </div>
        )}
        <div className={`lc__input-body ${inputCollapsed ? 'lc__input-body--collapsed' : ''}`}>
          <textarea
            className="lc__textarea"
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            placeholder="Paste your article HTML here..."
            spellCheck={false}
            aria-label="HTML to analyze"
          />
          <div className="lc__input-actions">
            <button className="lc__btn lc__btn--primary" onClick={handleAnalyze}>
              Analyze &amp; Auto-Strip
            </button>
            <button className="lc__btn lc__btn--secondary" onClick={handleReset}>
              Reset
            </button>
            <span className="lc__shortcut">Ctrl/Cmd + Enter</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {analyzed && (
        <div className="lc__stats">
          <div className="lc__stat">
            <span className="lc__stat-label">Total:</span>
            <span className="lc__stat-value">{stats.totalLinks}</span>
          </div>
          <span className="lc__stat-dot" />
          <div className="lc__stat">
            <span className="lc__stat-label">Unique URLs:</span>
            <span className="lc__stat-value">{stats.uniqueUrls}</span>
          </div>
          <span className="lc__stat-dot" />
          <div className="lc__stat">
            <span className="lc__stat-label">Text:</span>
            <span className="lc__stat-value">{stats.textLinks}</span>
          </div>
          <span className="lc__stat-dot" />
          <div className="lc__stat">
            <span className="lc__stat-label">Image:</span>
            <span className="lc__stat-value">{stats.imageLinks}</span>
          </div>
          {stats.ctaLinks > 0 && (
            <>
              <span className="lc__stat-dot" />
              <div className="lc__stat">
                <span className="lc__stat-label">CTA:</span>
                <span className="lc__stat-value">{stats.ctaLinks}</span>
              </div>
            </>
          )}
          {stats.externalLinks > 0 && (
            <>
              <span className="lc__stat-dot" />
              <div className="lc__stat">
                <span className="lc__stat-label">External:</span>
                <span className="lc__stat-value">{stats.externalLinks}</span>
              </div>
            </>
          )}
          <div className="lc__stat lc__stat--right">
            <span className="lc__stat--keeping">{kept} keeping</span>
          </div>
          <span className="lc__stat-dot" />
          <div className="lc__stat">
            <span className="lc__stat--removing">{removed} removing</span>
          </div>
        </div>
      )}

      {/* Clean Article Banner */}
      {analyzed && isClean && (
        <div className="lc__clean-banner">
          <CheckIcon size={18} />
          This article is clean &mdash; no redundant links found!
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <details className="lc__warnings" open>
          <summary className="lc__warnings-summary">
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </summary>
          <div className="lc__warnings-list">
            {warnings.map((w, i) => {
              const Icon = WARNING_ICONS[w.type] || AlertTriangleIcon;
              return (
                <div key={`${w.type}:${i}`} className="lc__warning">
                  <Icon size={14} className="lc__warning-icon" />
                  <span>{w.message}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Main Output */}
      {analyzed && (
        <div className="lc__output">
          <div className="lc__tabs">
            <div
              className={`lc__tab ${activeTab === 'preview' ? 'lc__tab--active' : ''}`}
              onClick={() => handleTabSwitch('preview')}
            >
              Preview
            </div>
            <div
              className={`lc__tab ${activeTab === 'clean' ? 'lc__tab--active' : ''}`}
              onClick={() => handleTabSwitch('clean')}
            >
              Clean HTML
            </div>
            <div
              className={`lc__tab ${activeTab === 'changes' ? 'lc__tab--active' : ''}`}
              onClick={() => handleTabSwitch('changes')}
            >
              Changes{' '}
              {totalChanges > 0 && <span className="lc__tab-badge">{totalChanges}</span>}
            </div>
            <div className="lc__tab-actions">
              <button className="lc__btn lc__btn--success" onClick={handleCopy}>
                Copy
              </button>
              <button
                className="lc__btn lc__btn--secondary"
                onClick={handleUndo}
                disabled={history.length === 0}
                title={history.length ? `Undo: ${history[history.length - 1].label}` : 'Nothing to undo'}
              >
                Undo{history.length > 1 ? ` (${history.length})` : ''}
              </button>
              <button className="lc__btn lc__btn--secondary" onClick={handleAutoStrip}>
                Auto-Strip
              </button>
              <button className="lc__btn lc__btn--secondary" onClick={handleKeepAll}>
                Keep All
              </button>
              <button className="lc__btn lc__btn--primary" onClick={handleNextArticle}>
                Next Article
              </button>
            </div>
          </div>

          {/* Preview Tab */}
          <div className={`lc__tab-content ${activeTab === 'preview' ? 'lc__tab-content--active' : ''}`}>
            <iframe
              ref={iframeRef}
              className="lc__preview-frame"
              sandbox="allow-scripts allow-same-origin"
              title="Link preview"
            />
          </div>

          {/* Clean HTML Tab */}
          <div className={`lc__tab-content ${activeTab === 'clean' ? 'lc__tab-content--active' : ''}`}>
            <div className="lc__clean-panel">
              <textarea
                className="lc__clean-textarea"
                readOnly
                spellCheck={false}
                value={cleanHtml}
              />
              <div className="lc__clean-actions">
                <button className="lc__btn lc__btn--success" onClick={handleCopy}>
                  Copy Clean HTML
                </button>
                <button className="lc__btn lc__btn--secondary" onClick={handleDownload}>
                  Download
                </button>
              </div>
            </div>
          </div>

          {/* Changes Tab */}
          <div className={`lc__tab-content ${activeTab === 'changes' ? 'lc__tab-content--active' : ''}`}>
            <div className="lc__changes">
              {totalChanges === 0 ? (
                <div className="lc__no-changes">No changes &mdash; all links are being kept.</div>
              ) : (
                <>
                  <div className="lc__changes-summary">
                    <ClipboardIcon size={16} />
                    {totalChanges} change{totalChanges !== 1 ? 's' : ''}:{' '}
                    {removedLinks.length} link{removedLinks.length !== 1 ? 's' : ''} unwrapped
                    {targetSelfCount > 0 ? `, ${targetSelfCount} target="_self" removed` : ''}
                  </div>

                  {targetSelfCount > 0 && (
                    <div className="lc__changes-section">
                      <div className="lc__changes-url-header">
                        target=&quot;_self&quot; cleanup
                        <span className="lc__changes-url-count">{targetSelfCount} stripped</span>
                      </div>
                      <div className="lc__change-item lc__change-item--attr">
                        <code>target=&quot;_self&quot;</code> removed from {targetSelfCount} internal
                        link{targetSelfCount !== 1 ? 's' : ''} (it&apos;s the browser default)
                      </div>
                    </div>
                  )}

                  {Object.entries(removedByUrl).map(([url, urlLinks]) => (
                    <div key={url} className="lc__changes-section">
                      <div className="lc__changes-url-header">
                        {url}
                        <span className="lc__changes-url-count">
                          {urlLinks.length} removal{urlLinks.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {urlLinks.map((l) => (
                        <div key={l.id} className="lc__change-item">
                          <code>&lt;a href=&quot;...&quot;&gt;</code> {l.anchorText}{' '}
                          <code>&lt;/a&gt;</code> &rarr; <strong>{l.anchorText}</strong>
                          <div className="lc__change-context">{l.context}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
