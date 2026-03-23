import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  analyzeHtml,
  computeAutoStrip,
  computeKeepAll,
  generateCleanHtml,
  generateCleanHtmlFromPreview,
  generatePreviewHtml,
} from './engine';
import './LinkCleaner.css';

export default function LinkCleaner() {
  const showToast = useToast();
  const iframeRef = useRef(null);
  const previewReadyRef = useRef(false);
  const placeholdersRef = useRef([]);
  const pendingPreviewRef = useRef(null);

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

  // Refs for stable callbacks
  const linksRef = useRef(links);
  linksRef.current = links;
  const keepMapRef = useRef(keepMap);
  keepMapRef.current = keepMap;

  // Toggle a single link keep/remove
  const toggleLink = useCallback((id) => {
    const link = linksRef.current.find(l => l.id === id);
    if (!link || link.isImageLink || link.isCtaLink) return;

    const newKeep = !keepMapRef.current[id];
    setKeepMap(prev => ({ ...prev, [id]: newKeep }));

    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage({ type: 'srlc-update', id, keep: newKeep }, '*');
    }
  }, []);

  // Listen for iframe toggle messages
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === 'srlc-toggle') {
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
          frame.contentDocument.body, linksRef.current, keepMapRef.current, preview.placeholders
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
        frame.contentDocument.body, links, keepMap, placeholdersRef.current
      );
      setCleanHtml(result.html);
      setTargetSelfCount(result.targetSelfCount);
    } else {
      const result = generateCleanHtml(htmlInput, links, keepMap);
      setCleanHtml(result.html);
      setTargetSelfCount(result.targetSelfCount);
    }
  }, [keepMap, analyzed, links, htmlInput]);

  // Analyze handler
  const handleAnalyze = useCallback(() => {
    const html = htmlInput.trim();
    if (!html) { showToast('Paste some HTML first', true); return; }

    const result = analyzeHtml(html, domain);
    const autoKeep = computeAutoStrip(result.links, result.groups);
    const removed = result.links.filter(l => !autoKeep[l.id]).length;

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
    const preview = generatePreviewHtml(html, result.links, autoKeep);
    placeholdersRef.current = preview.placeholders;
    pendingPreviewRef.current = preview;

    // Initial clean HTML (before preview loads)
    const cleanResult = generateCleanHtml(html, result.links, autoKeep);
    setCleanHtml(cleanResult.html);
    setTargetSelfCount(cleanResult.targetSelfCount);

    if (removed === 0) {
      showToast('\u2705 Article is clean \u2014 no redundant links!');
    } else {
      showToast(`${result.stats.totalLinks} links, ${result.stats.uniqueUrls} unique URLs \u2014 ${removed} marked for removal`);
    }
  }, [htmlInput, domain, showToast]);

  const handleAutoStrip = useCallback(() => {
    const newKeep = computeAutoStrip(links, groups);
    setKeepMap(newKeep);

    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      const updates = links
        .filter(l => !l.isImageLink && !l.isCtaLink)
        .map(l => ({ id: l.id, keep: newKeep[l.id] }));
      frame.contentWindow.postMessage({ type: 'srlc-update-all', updates }, '*');
    }
    showToast('Auto-strip applied');
  }, [links, groups, showToast]);

  const handleKeepAll = useCallback(() => {
    const newKeep = computeKeepAll(links);
    setKeepMap(newKeep);

    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      const updates = links
        .filter(l => !l.isImageLink && !l.isCtaLink)
        .map(l => ({ id: l.id, keep: true }));
      frame.contentWindow.postMessage({ type: 'srlc-update-all', updates }, '*');
    }
    showToast('All links set to keep');
  }, [links, showToast]);

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
        frame.contentDocument.body, links, keepMap, placeholdersRef.current
      );
      setCleanHtml(result.html);
      setTargetSelfCount(result.targetSelfCount);
      return result.html;
    }
    return cleanHtml;
  }, [links, keepMap, cleanHtml]);

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

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAnalyze();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleAnalyze]);

  // Derived state
  const kept = links.filter(l => keepMap[l.id]).length;
  const removed = links.filter(l => !keepMap[l.id]).length;
  const removedLinks = links.filter(l => !keepMap[l.id]);
  const totalChanges = removedLinks.length + targetSelfCount;

  const removedByUrl = {};
  removedLinks.forEach(l => {
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
          <div className="lc__collapse-bar">
            <span className="lc__collapse-label" onClick={() => setInputCollapsed(false)}>
              HTML Input
            </span>
            <span className="lc__collapse-summary" onClick={() => setInputCollapsed(false)}>
              {articleTitle ? `${articleTitle}  \u00B7  ` : ''}
              {htmlInput.length.toLocaleString()} chars, {stats.totalLinks} links found
            </span>
            <span className="lc__collapse-toggle" onClick={() => setInputCollapsed(false)}>
              Show
            </span>
          </div>
        )}
        <div className={`lc__input-body ${inputCollapsed ? 'lc__input-body--collapsed' : ''}`}>
          <textarea
            className="lc__textarea"
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            placeholder="Paste your article HTML here..."
            spellCheck={false}
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          This article is clean &mdash; no redundant links found!
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="lc__warnings">
          {warnings.map((w, i) => {
            const icons = { broken: '\u26A0', 'image-only': '\uD83D\uDDBC', heading: '\u24D8', density: '\u25CF' };
            return (
              <div key={i} className="lc__warning">
                {icons[w.type] || '\u26A0'} {w.message}
              </div>
            );
          })}
        </div>
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
              <button className="lc__btn lc__btn--secondary" onClick={handleAutoStrip}>
                Auto-Strip
              </button>
              <button className="lc__btn lc__btn--secondary" onClick={handleKeepAll}>
                Keep All
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
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6" />
                    </svg>
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
                      {urlLinks.map(l => (
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

          <div className="lc__bottom-actions">
            <button className="lc__btn lc__btn--primary" onClick={handleNextArticle}>
              Next Article
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
