import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '../../context/useToast';
import { useCurrentDraft } from '../../context/useCurrentDraft';
import { SeverityIcon } from '../../components/icons';
import {
  fetchPageHtml,
  parseMetaTags,
  detectIssues,
  generateMetaTagsCode,
  getDomain,
  lengthStatus,
  TITLE_LENGTH,
  DESC_LENGTH,
} from './engine';
import './OgChecker.css';

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitter', label: 'X (Twitter)' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'discord', label: 'Discord' },
];

export default function OgChecker() {
  const showToast = useToast();
  const { draft, setDraft } = useCurrentDraft();
  const [inputMode, setInputMode] = useState('url'); // 'url' | 'html'
  const [url, setUrl] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [pastedBaseUrl, setPastedBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [issues, setIssues] = useState([]);
  const [code, setCode] = useState('');
  const [activePlatform, setActivePlatform] = useState('facebook');
  const [imgError, setImgError] = useState(false);
  const [checkedUrl, setCheckedUrl] = useState('');
  const [fetchError, setFetchError] = useState('');

  // Ref-based handle so the document-level keyboard shortcut effect only binds
  // once and still calls the latest handler when state changes.
  const submitRef = useRef(() => {});

  const resetResults = () => {
    setMeta(null);
    setIssues([]);
    setCode('');
    setImgError(false);
    setFetchError('');
  };

  const presentParsed = (html, finalUrl) => {
    const parsed = parseMetaTags(html, finalUrl || 'about:blank');
    const foundIssues = detectIssues(parsed);
    const tagCode = generateMetaTagsCode(parsed);
    setMeta(parsed);
    setIssues(foundIssues);
    setCode(tagCode);
    // Prefer canonical / og:url over the user-supplied base, since the page
    // itself is the most authoritative source of what URL it represents.
    setCheckedUrl(parsed.canonical || parsed.og.url || finalUrl || '');
  };

  const handleCheck = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { showToast('Enter a URL first', true); return; }

    setLoading(true);
    resetResults();

    try {
      const { html, finalUrl } = await fetchPageHtml(trimmed);
      presentParsed(html, finalUrl);
      showToast('Tags loaded');
    } catch (err) {
      const msg = err.message || 'Could not fetch URL';
      setFetchError(msg);
      setCheckedUrl(trimmed);
      showToast('Fetch failed — see details below', true);
    } finally {
      setLoading(false);
    }
  }, [url, showToast]);

  const handleInspectHtml = useCallback(() => {
    const html = pastedHtml.trim();
    if (!html) { showToast('Paste HTML first', true); return; }

    resetResults();
    try {
      presentParsed(html, pastedBaseUrl.trim());
      // Mirror the pasted article into the cross-tool draft buffer so the
      // next tool can pick up where the user left off.
      setDraft(html);
      showToast('Tags parsed');
    } catch (err) {
      showToast(err.message || 'Could not parse HTML', true);
    }
  }, [pastedHtml, pastedBaseUrl, showToast, setDraft]);

  const handleLoadFromDraft = useCallback(() => {
    if (!draft?.html) { showToast('No current draft set', true); return; }
    setPastedHtml(draft.html);
    showToast('Loaded from current draft');
  }, [draft, showToast]);

  // Keep the ref in sync with whichever handler is active for the current
  // input mode. Effect runs after every render so the keyboard listener
  // (bound once below) always sees fresh state.
  useEffect(() => {
    submitRef.current = inputMode === 'html' ? handleInspectHtml : handleCheck;
  });

  // Ctrl/Cmd+Enter to submit the current mode's primary action.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitRef.current();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleCopyCode = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => showToast('Copied!'));
  }, [code, showToast]);

  // Derived values
  const displayTitle = meta?.og.title || meta?.title || '';
  const displayDesc = meta?.og.description || meta?.description || '';
  const previewImage = meta?.og.image || meta?.twitter.image || '';
  const previewDomain = checkedUrl ? getDomain(checkedUrl) : '';
  const previewSiteName = meta?.og.siteName || previewDomain;

  const titleLen = displayTitle.length;
  const descLen = displayDesc.length;
  const titleStatusClass = `og__char-count og__char-count--${lengthStatus(titleLen, TITLE_LENGTH)}`;
  const descStatusClass = `og__char-count og__char-count--${lengthStatus(descLen, DESC_LENGTH)}`;

  return (
    <div className="og">
      <div className="og__header">
        <h2 className="og__title">OG Tag Checker</h2>
        <p className="og__description">
          Inspect a page's Open Graph and meta tags. Fetch by URL when the site is open,
          or paste the raw HTML for pages behind bot protection, auth, or staging.
        </p>
      </div>

      {/* Input mode toggle */}
      <div className="og__mode-tabs" role="tablist" aria-label="Input mode">
        <button
          role="tab"
          aria-selected={inputMode === 'url'}
          className={`og__mode-tab ${inputMode === 'url' ? 'og__mode-tab--active' : ''}`}
          onClick={() => setInputMode('url')}
        >
          From URL
        </button>
        <button
          role="tab"
          aria-selected={inputMode === 'html'}
          className={`og__mode-tab ${inputMode === 'html' ? 'og__mode-tab--active' : ''}`}
          onClick={() => setInputMode('html')}
        >
          Paste HTML
        </button>
      </div>

      {inputMode === 'url' ? (
        <div className="og__input-bar">
          <input
            type="url"
            className="og__url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="Enter full URL"
            disabled={loading}
            aria-label="URL to inspect"
          />
          <button
            className="og__btn og__btn--primary"
            onClick={handleCheck}
            disabled={loading}
          >
            {loading ? 'Checking…' : 'Check Website'}
          </button>
        </div>
      ) : (
        <div className="og__paste-mode">
          <p className="og__paste-hint">
            In your browser, open the page → <kbd>Cmd</kbd>+<kbd>U</kbd> (or right-click →
            View Source) → <kbd>Cmd</kbd>+<kbd>A</kbd> → <kbd>Cmd</kbd>+<kbd>C</kbd> →
            paste below. Works on any page you can see, including Cloudflare-protected,
            authenticated, and staging URLs.
          </p>
          <input
            type="url"
            className="og__url-input"
            value={pastedBaseUrl}
            onChange={(e) => setPastedBaseUrl(e.target.value)}
            placeholder="Source URL (optional — used to resolve relative image paths)"
            aria-label="Source URL for the pasted HTML"
          />
          <textarea
            className="og__paste-textarea"
            value={pastedHtml}
            onChange={(e) => setPastedHtml(e.target.value)}
            placeholder="Paste the page's HTML here…"
            spellCheck={false}
            aria-label="HTML to inspect"
          />
          <div className="og__paste-actions">
            <button className="og__btn og__btn--primary" onClick={handleInspectHtml}>
              Inspect Pasted HTML
            </button>
            {draft && (
              <button
                type="button"
                className="og__btn og__btn--ghost"
                onClick={handleLoadFromDraft}
                title={draft.title || 'Current draft'}
              >
                Load from current draft
              </button>
            )}
            <span className="og__shortcut">Ctrl/Cmd + Enter</span>
          </div>
        </div>
      )}

      {/* Loading Bar */}
      {loading && (
        <div className="og__loading-bar" role="progressbar" aria-label="Fetching page">
          <div className="og__loading-bar-inner" />
        </div>
      )}

      {/* Fetch error (persistent) */}
      {fetchError && (
        <div className="og__fetch-error" role="alert">
          <div className="og__fetch-error-title">Couldn’t inspect this URL</div>
          <div className="og__fetch-error-message">{fetchError}</div>
          {/^Site is protected/i.test(fetchError) && (
            <div className="og__fetch-error-actions">
              <span className="og__fetch-error-hint">Try the platform’s official tool — they fetch from the inside:</span>
              <a
                className="og__fetch-error-link"
                href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(checkedUrl)}`}
                target="_blank"
                rel="noreferrer"
              >Facebook Debugger ↗</a>
              <a
                className="og__fetch-error-link"
                href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(checkedUrl)}`}
                target="_blank"
                rel="noreferrer"
              >LinkedIn Post Inspector ↗</a>
              <a
                className="og__fetch-error-link"
                href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(checkedUrl)}`}
                target="_blank"
                rel="noreferrer"
              >Google Rich Results ↗</a>
            </div>
          )}
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="og__issues">
          <div className="og__issues-title">Issues found with metadata</div>
          {issues.map((issue) => (
            <div
              key={`${issue.severity}:${issue.message}`}
              className={`og__issue og__issue--${issue.severity}`}
            >
              <SeverityIcon severity={issue.severity} size={14} className="og__issue-icon" />
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {meta && (
        <>
          {/* Social Preview */}
          <div className="og__section">
            <h3 className="og__section-title">Social Preview</h3>
            <p className="og__section-desc">How your page looks when shared</p>

            <div className="og__platform-tabs" role="tablist">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={activePlatform === p.id}
                  className={`og__platform-tab ${activePlatform === p.id ? 'og__platform-tab--active' : ''}`}
                  onClick={() => setActivePlatform(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className={`og__preview-area og__preview-area--${activePlatform}`}>
              {activePlatform === 'facebook' && (
                <div className="og__card og__card--facebook">
                  {previewImage && !imgError && (
                    <img src={previewImage} alt="" className="og__card-image" onError={() => setImgError(true)} />
                  )}
                  {(!previewImage || imgError) && <div className="og__card-image-placeholder">No image</div>}
                  <div className="og__card-body">
                    <div className="og__card-domain">{previewDomain.toUpperCase()}</div>
                    <div className="og__card-title">{displayTitle || 'No title'}</div>
                    <div className="og__card-desc">{displayDesc || 'No description'}</div>
                  </div>
                </div>
              )}

              {activePlatform === 'twitter' && (
                <div className={`og__card og__card--twitter ${meta.twitter.card === 'summary' ? 'og__card--twitter-small' : ''}`}>
                  {meta.twitter.card === 'summary' ? (
                    <>
                      {previewImage && !imgError ? (
                        <img src={previewImage} alt="" className="og__card-thumb" onError={() => setImgError(true)} />
                      ) : (
                        <div className="og__card-thumb-placeholder">No img</div>
                      )}
                      <div className="og__card-body">
                        <div className="og__card-domain">{previewDomain}</div>
                        <div className="og__card-title">{displayTitle || 'No title'}</div>
                        <div className="og__card-desc">{displayDesc || 'No description'}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      {previewImage && !imgError && (
                        <img src={previewImage} alt="" className="og__card-image" onError={() => setImgError(true)} />
                      )}
                      {(!previewImage || imgError) && <div className="og__card-image-placeholder">No image</div>}
                      <div className="og__card-body">
                        <div className="og__card-domain">{previewDomain}</div>
                        <div className="og__card-title">{displayTitle || 'No title'}</div>
                        <div className="og__card-desc">{displayDesc || 'No description'}</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activePlatform === 'linkedin' && (
                <div className="og__card og__card--linkedin">
                  {previewImage && !imgError && (
                    <img src={previewImage} alt="" className="og__card-image" onError={() => setImgError(true)} />
                  )}
                  {(!previewImage || imgError) && <div className="og__card-image-placeholder">No image</div>}
                  <div className="og__card-body">
                    <div className="og__card-title">{displayTitle || 'No title'}</div>
                    <div className="og__card-domain">{previewDomain}</div>
                  </div>
                </div>
              )}

              {activePlatform === 'whatsapp' && (
                <div className="og__card og__card--whatsapp">
                  {previewImage && !imgError ? (
                    <img src={previewImage} alt="" className="og__card-thumb" onError={() => setImgError(true)} />
                  ) : (
                    <div className="og__card-thumb-placeholder">No img</div>
                  )}
                  <div className="og__card-body">
                    <div className="og__card-title">{displayTitle || 'No title'}</div>
                    <div className="og__card-desc">{displayDesc || 'No description'}</div>
                    <div className="og__card-domain">{previewDomain}</div>
                  </div>
                </div>
              )}

              {activePlatform === 'discord' && (
                <div className="og__card og__card--discord">
                  <div className="og__card-body">
                    <div className="og__card-site-name">{previewSiteName}</div>
                    <div className="og__card-title">{displayTitle || 'No title'}</div>
                    <div className="og__card-desc">{displayDesc || 'No description'}</div>
                  </div>
                  {previewImage && !imgError && (
                    <img src={previewImage} alt="" className="og__card-image" onError={() => setImgError(true)} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Technical Inspector — read-only, styled as a static report (no input affordances) */}
          <div className="og__section">
            <h3 className="og__section-title">Technical OG Tag Inspector</h3>
            <p className="og__section-desc">
              Inspect your OG title, description, and image before publishing.
            </p>

            <dl className="og__inspector">
              <div className="og__field">
                <dt className="og__field-label">Title</dt>
                <dd className="og__field-value">{displayTitle || <span className="og__field-empty">No og:title found</span>}</dd>
                <div className="og__field-meta">
                  <span className={titleStatusClass}>{titleLen} characters</span>
                  <span className="og__char-rec">Ideal: {TITLE_LENGTH.idealMin}-{TITLE_LENGTH.idealMax} characters</span>
                </div>
              </div>

              <div className="og__field">
                <dt className="og__field-label">Description</dt>
                <dd className="og__field-value og__field-value--long">
                  {displayDesc || <span className="og__field-empty">No og:description found</span>}
                </dd>
                <div className="og__field-meta">
                  <span className={descStatusClass}>{descLen} characters</span>
                  <span className="og__char-rec">Ideal: {DESC_LENGTH.idealMin}-{DESC_LENGTH.idealMax} characters</span>
                </div>
              </div>

              <div className="og__field">
                <dt className="og__field-label">Image</dt>
                <dd className="og__image-row">
                  {previewImage && !imgError ? (
                    <img src={previewImage} alt="" className="og__image-thumb" onError={() => setImgError(true)} />
                  ) : (
                    <div className="og__image-placeholder">No image</div>
                  )}
                  <span className="og__image-url">{previewImage || 'No og:image found'}</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Meta Tags Code */}
          <div className="og__section">
            <div className="og__code-block">
              <div className="og__code-header">
                <span className="og__code-label">Meta Tags Code</span>
                <button className="og__btn og__btn--copy" onClick={handleCopyCode}>Copy</button>
              </div>
              <div className="og__code-body">
                {code.split('\n').map((line, i) => (
                  <div key={i} className="og__code-line">
                    <span className="og__code-num">{i + 1}</span>
                    <span className="og__code-text">{line || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
