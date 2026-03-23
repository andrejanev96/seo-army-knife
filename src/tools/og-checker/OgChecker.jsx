import { useState, useCallback, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchPageHtml, parseMetaTags, detectIssues, generateMetaTagsCode, getDomain } from './engine';
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
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [issues, setIssues] = useState([]);
  const [code, setCode] = useState('');
  const [activePlatform, setActivePlatform] = useState('facebook');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [imgError, setImgError] = useState(false);
  const [checkedUrl, setCheckedUrl] = useState('');

  const handleCheck = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { showToast('Enter a URL first', true); return; }

    setLoading(true);
    setMeta(null);
    setIssues([]);
    setCode('');
    setImgError(false);

    try {
      const { html, finalUrl } = await fetchPageHtml(trimmed);
      const parsed = parseMetaTags(html, finalUrl);
      const foundIssues = detectIssues(parsed);
      const tagCode = generateMetaTagsCode(parsed);

      setMeta(parsed);
      setIssues(foundIssues);
      setCode(tagCode);
      setEditTitle(parsed.og.title || parsed.title);
      setEditDesc(parsed.og.description || parsed.description);
      setCheckedUrl(finalUrl);
      showToast('Tags loaded');
    } catch (err) {
      showToast(err.message || 'Could not fetch URL', true);
    } finally {
      setLoading(false);
    }
  }, [url, showToast]);

  // Enter key to submit
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCheck();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleCheck]);

  const handleCopyCode = useCallback(() => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => showToast('Copied!'));
  }, [code, showToast]);

  // Derived values for previews
  const previewTitle = editTitle || '';
  const previewDesc = editDesc || '';
  const previewImage = meta?.og.image || meta?.twitter.image || '';
  const previewDomain = checkedUrl ? getDomain(checkedUrl) : '';
  const previewSiteName = meta?.og.siteName || previewDomain;

  const titleLen = editTitle.length;
  const descLen = editDesc.length;

  const titleColor = !titleLen ? '#94a3b8' : titleLen >= 15 && titleLen <= 90 ? '#059669' : '#dc2626';
  const descColor = !descLen ? '#94a3b8' : descLen >= 70 && descLen <= 200 ? '#059669' : '#dc2626';

  return (
    <div className="og">
      <div className="og__header">
        <h2 className="og__title">OG Tag Checker</h2>
        <p className="og__description">
          Enter a URL to inspect its Open Graph and meta tags. See how links appear when shared
          on social platforms and verify metadata on your articles.
        </p>
      </div>

      {/* URL Input */}
      <div className="og__input-bar">
        <input
          type="url"
          className="og__url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
          placeholder="Enter full URL"
          disabled={loading}
        />
        <button className="og__btn og__btn--primary" onClick={handleCheck} disabled={loading}>
          {loading ? 'Checking\u2026' : 'Check Website'}
        </button>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="og__issues">
          <div className="og__issues-title">Issues found with metadata</div>
          {issues.map((issue, i) => (
            <div key={i} className={`og__issue og__issue--${issue.severity}`}>
              <span className="og__issue-icon">
                {issue.severity === 'error' ? '\u2716' : issue.severity === 'warning' ? '\u26A0' : '\u24D8'}
              </span>
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

            <div className="og__platform-tabs">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  className={`og__platform-tab ${activePlatform === p.id ? 'og__platform-tab--active' : ''}`}
                  onClick={() => setActivePlatform(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="og__preview-area">
              {activePlatform === 'facebook' && (
                <div className="og__card og__card--facebook">
                  {previewImage && !imgError && (
                    <img src={previewImage} alt="" className="og__card-image" onError={() => setImgError(true)} />
                  )}
                  {(!previewImage || imgError) && <div className="og__card-image-placeholder">No image</div>}
                  <div className="og__card-body">
                    <div className="og__card-domain">{previewDomain.toUpperCase()}</div>
                    <div className="og__card-title">{previewTitle || 'No title'}</div>
                    <div className="og__card-desc">{previewDesc || 'No description'}</div>
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
                        <div className="og__card-title">{previewTitle || 'No title'}</div>
                        <div className="og__card-desc">{previewDesc || 'No description'}</div>
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
                        <div className="og__card-title">{previewTitle || 'No title'}</div>
                        <div className="og__card-desc">{previewDesc || 'No description'}</div>
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
                    <div className="og__card-title">{previewTitle || 'No title'}</div>
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
                    <div className="og__card-title">{previewTitle || 'No title'}</div>
                    <div className="og__card-desc">{previewDesc || 'No description'}</div>
                    <div className="og__card-domain">{checkedUrl}</div>
                  </div>
                </div>
              )}

              {activePlatform === 'discord' && (
                <div className="og__card og__card--discord">
                  <div className="og__card-body">
                    <div className="og__card-site-name">{previewSiteName}</div>
                    <div className="og__card-title">{previewTitle || 'No title'}</div>
                    <div className="og__card-desc">{previewDesc || 'No description'}</div>
                  </div>
                  {previewImage && !imgError && (
                    <img src={previewImage} alt="" className="og__card-image" onError={() => setImgError(true)} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Technical Inspector */}
          <div className="og__section">
            <h3 className="og__section-title">Technical OG Tag Inspector</h3>
            <p className="og__section-desc">
              Inspect and refine your OG title, description, and image. Changes update the previews above in real time.
            </p>

            <div className="og__inspector">
              <div className="og__field">
                <label className="og__field-label">Title</label>
                <input
                  type="text"
                  className="og__field-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <div className="og__field-meta">
                  <span className="og__char-count" style={{ color: titleColor }}>
                    {titleLen} characters
                  </span>
                  <span className="og__char-rec">Recommended: 50-60 characters</span>
                </div>
              </div>

              <div className="og__field">
                <label className="og__field-label">Description</label>
                <textarea
                  className="og__field-textarea"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
                <div className="og__field-meta">
                  <span className="og__char-count" style={{ color: descColor }}>
                    {descLen} characters
                  </span>
                  <span className="og__char-rec">Recommended: 110-160 characters</span>
                </div>
              </div>

              <div className="og__field">
                <label className="og__field-label">Image</label>
                <div className="og__image-row">
                  {previewImage && !imgError ? (
                    <img src={previewImage} alt="OG" className="og__image-thumb" onError={() => setImgError(true)} />
                  ) : (
                    <div className="og__image-placeholder">No image</div>
                  )}
                  <span className="og__image-url">{previewImage || 'No og:image found'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Meta Tags Code */}
          <div className="og__section">
            <div className="og__code-block">
              <div className="og__code-header">
                <span className="og__code-label">Meta Tags Code</span>
                <button className="og__btn og__btn--copy" onClick={handleCopyCode}>Copy</button>
              </div>
              <pre className="og__code-pre">{code.split('\n').map((line, i) => (
                <div key={i} className="og__code-line">
                  <span className="og__code-num">{i + 1}</span>
                  <span className="og__code-text">{line}</span>
                </div>
              ))}</pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
