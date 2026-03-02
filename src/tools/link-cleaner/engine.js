// ===== Template Syntax Protection =====
export function protectTemplateSyntax(html) {
  const placeholders = [];
  const protectedHtml = html.replace(/\{\{(?:[^}]|\}(?!\}))*\}\}/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `__SRLC_TPL_${idx}__`;
  });
  return { html: protectedHtml, placeholders };
}

export function restoreTemplateSyntax(html, placeholders) {
  if (!placeholders || placeholders.length === 0) return html;
  return html.replace(/__SRLC_TPL_(\d+)__/g, (_, idx) => placeholders[parseInt(idx)]);
}

// ===== Utilities =====
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeUrl(href) {
  if (!href) return null;
  href = href.trim();
  if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;

  try {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      const url = new URL(href, 'https://placeholder.com');
      let path = url.pathname.toLowerCase();
      if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
      return path + url.search.toLowerCase() + url.hash.toLowerCase();
    } else {
      let normalized = href.toLowerCase();
      const firstSpecial = Math.min(
        normalized.indexOf('?') === -1 ? Infinity : normalized.indexOf('?'),
        normalized.indexOf('#') === -1 ? Infinity : normalized.indexOf('#')
      );
      let path = firstSpecial === Infinity ? normalized : normalized.slice(0, firstSpecial);
      const rest = firstSpecial === Infinity ? '' : normalized.slice(firstSpecial);
      if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
      return (path + rest) || normalized;
    }
  } catch {
    return href.toLowerCase();
  }
}

// ===== Link Classification =====
function isImageLink(a) {
  const imgs = a.querySelectorAll('img');
  if (imgs.length === 0) return false;
  const textContent = Array.from(a.childNodes).reduce((txt, node) => {
    if (node.nodeType === Node.TEXT_NODE) return txt + node.textContent.trim();
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'IMG' && !node.querySelector('img')) {
      return txt + node.textContent.trim();
    }
    return txt;
  }, '');
  return textContent.length === 0;
}

function isCtaLink(a) {
  const cls = (a.className || '').toLowerCase();
  const txt = (a.textContent || '').toLowerCase().trim();

  if (/\b(btn|button|cta|shop-now|buy-now|add-to-cart)\b/.test(cls)) return true;
  if (/^(shop|buy|order|add to cart|get it|check price|see price|view deal|view product|learn more)\b/i.test(txt)) return true;

  const parentCls = (a.parentElement?.className || '').toLowerCase();
  if (/\b(btn|button|cta|shop|call-to-action)\b/.test(parentCls)) return true;

  return false;
}

function isInHeading(el) {
  let cur = el;
  while (cur) {
    if (/^H[1-6]$/.test(cur.tagName)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function isExternalLink(href, domain) {
  if (!domain) return false;
  if (!href || href.startsWith('/') || href.startsWith('#')) return false;
  try {
    const url = new URL(href, 'https://placeholder.com');
    return !url.hostname.includes(domain.toLowerCase());
  } catch { return false; }
}

function getParentTag(el) {
  let cur = el.parentElement;
  while (cur) {
    const t = cur.tagName.toLowerCase();
    if (['p','li','td','th','h1','h2','h3','h4','h5','h6','blockquote','figcaption','dd','dt'].includes(t)) return t;
    cur = cur.parentElement;
  }
  return 'div';
}

function getContext(linkEl) {
  const parent = linkEl.parentElement;
  if (!parent) return '';
  const text = parent.textContent || '';
  const linkText = linkEl.textContent || '';
  const idx = text.indexOf(linkText);
  if (idx === -1) return text.slice(0, 80);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + linkText.length + 30);
  let ctx = text.slice(start, end).trim();
  if (start > 0) ctx = '...' + ctx;
  if (end < text.length) ctx += '...';
  return ctx;
}

// ===== Analysis Engine =====
export function analyzeHtml(html, domain) {
  const { html: protectedHtml } = protectTemplateSyntax(html);
  const container = document.createElement('div');
  container.innerHTML = protectedHtml;

  const h1 = container.querySelector('h1');
  const title = h1 ? h1.textContent.trim() : '';

  const allAnchors = container.querySelectorAll('a[href]');
  const links = [];
  const groups = {};
  const warnings = [];

  allAnchors.forEach((a, rawIndex) => {
    const href = a.getAttribute('href');
    const normalized = normalizeUrl(href);

    if (!normalized) {
      if (href && href !== '#') {
        warnings.push({ type: 'broken', message: `Broken/invalid link: href="${href}" \u2014 "${(a.textContent||'').trim().slice(0,40)}"` });
      }
      return;
    }

    const img = isImageLink(a);
    const cta = !img && isCtaLink(a);
    const heading = isInHeading(a);
    const external = isExternalLink(href, domain);
    const parentTag = getParentTag(a);
    const context = getContext(a);
    const anchorText = img ? '[image]' : ((a.textContent || '').trim() || '[empty]');

    const link = {
      id: links.length,
      rawIndex,
      href,
      normalizedHref: normalized,
      anchorText,
      isImageLink: img,
      isCtaLink: cta,
      isInHeading: heading,
      isExternal: external,
      parentTag,
      context,
      rel: a.getAttribute('rel') || ''
    };

    links.push(link);

    if (!groups[normalized]) {
      groups[normalized] = {
        normalizedHref: normalized,
        originalHref: href,
        links: [],
        imageCount: 0,
        textCount: 0,
        ctaCount: 0,
        inHeadingCount: 0
      };
    }
    const g = groups[normalized];
    g.links.push(link);
    if (img) g.imageCount++;
    else if (cta) g.ctaCount++;
    else g.textCount++;
    if (heading) g.inHeadingCount++;
  });

  // Edge case warnings
  for (const [url, group] of Object.entries(groups)) {
    if (group.textCount === 0 && group.ctaCount === 0 && group.imageCount > 0) {
      warnings.push({ type: 'image-only', message: `"${url}" only appears as image links (${group.imageCount}). Consider adding a text link for SEO.` });
    }
    if (group.inHeadingCount > 0) {
      warnings.push({ type: 'heading', message: `"${url}" has ${group.inHeadingCount} link(s) inside heading tags \u2014 consider removing.` });
    }
  }

  // Paragraph density
  container.querySelectorAll('p').forEach(p => {
    const count = p.querySelectorAll('a[href]').length;
    if (count >= 5) {
      warnings.push({ type: 'density', message: `High link density (${count} links) in paragraph: "${(p.textContent||'').slice(0,60).trim()}..."` });
    }
  });

  const totalLinks = links.length;
  const uniqueUrls = Object.keys(groups).length;
  const imageLinks = links.filter(l => l.isImageLink).length;
  const ctaLinks = links.filter(l => l.isCtaLink).length;
  const textLinks = totalLinks - imageLinks - ctaLinks;
  const externalLinks = links.filter(l => l.isExternal).length;

  return {
    links, groups, warnings, title,
    stats: { totalLinks, uniqueUrls, imageLinks, ctaLinks, textLinks, externalLinks }
  };
}

// ===== Auto-Strip Logic =====
function hasDifferentAnchors(textLinks) {
  if (textLinks.length < 2) return false;
  const normalized = textLinks.map(l => l.anchorText.toLowerCase().trim());
  return new Set(normalized).size > 1;
}

export function computeAutoStrip(links, groups) {
  const keepMap = {};
  links.forEach(l => { keepMap[l.id] = true; });

  for (const group of Object.values(groups)) {
    const textLinks = group.links.filter(l => !l.isImageLink && !l.isCtaLink);

    if (textLinks.length === 2 && hasDifferentAnchors(textLinks)) {
      group.links.forEach(l => { keepMap[l.id] = true; });
    } else {
      let firstTextKept = false;
      for (const link of group.links) {
        if (link.isImageLink || link.isCtaLink) {
          keepMap[link.id] = true;
          continue;
        }
        if (!firstTextKept) {
          keepMap[link.id] = true;
          firstTextKept = true;
        } else {
          keepMap[link.id] = false;
        }
      }
    }
  }

  return keepMap;
}

export function computeKeepAll(links) {
  const keepMap = {};
  links.forEach(l => { keepMap[l.id] = true; });
  return keepMap;
}

// ===== HTML Generation Helpers =====
function processContainer(html, links, keepMap, callback) {
  const { html: protectedHtml, placeholders } = protectTemplateSyntax(html);
  const container = document.createElement('div');
  container.innerHTML = protectedHtml;
  const anchors = Array.from(container.querySelectorAll('a[href]'));
  let linkIdx = 0;

  anchors.forEach(a => {
    const href = a.getAttribute('href');
    const normalized = normalizeUrl(href);
    if (!normalized) return;
    if (linkIdx < links.length) {
      callback(a, links[linkIdx], keepMap[links[linkIdx].id]);
      linkIdx++;
    }
  });

  return { container, placeholders };
}

export function generateCleanHtml(originalHtml, links, keepMap) {
  const { container, placeholders } = processContainer(originalHtml, links, keepMap, (a, link, keep) => {
    if (!keep) {
      a.setAttribute('data-srlc-remove', 'true');
    }
  });

  container.querySelectorAll('[data-srlc-remove]').forEach(a => {
    const parent = a.parentNode;
    while (a.firstChild) parent.insertBefore(a.firstChild, a);
    parent.removeChild(a);
  });

  let targetSelfCount = 0;
  container.querySelectorAll('a[target="_self"]').forEach(a => {
    a.removeAttribute('target');
    targetSelfCount++;
  });

  return {
    html: restoreTemplateSyntax(container.innerHTML, placeholders),
    targetSelfCount
  };
}

export function generateCleanHtmlFromPreview(iframeBody, links, keepMap, placeholders) {
  const clone = iframeBody.cloneNode(true);

  const hint = clone.querySelector('.srlc-hint');
  if (hint) hint.remove();
  clone.querySelectorAll('script').forEach(s => s.remove());

  clone.querySelectorAll('a[data-link-id]').forEach(a => {
    const linkId = parseInt(a.getAttribute('data-link-id'));
    const keep = keepMap[linkId];

    if (!keep) {
      const parent = a.parentNode;
      while (a.firstChild) parent.insertBefore(a.firstChild, a);
      parent.removeChild(a);
    } else {
      const origStyle = a.getAttribute('data-orig-style');
      const origTitle = a.getAttribute('data-orig-title');
      if (origStyle) a.setAttribute('style', origStyle); else a.removeAttribute('style');
      if (origTitle) a.setAttribute('title', origTitle); else a.removeAttribute('title');
      a.removeAttribute('data-link-id');
      a.removeAttribute('data-orig-style');
      a.removeAttribute('data-orig-title');
      a.removeAttribute('contenteditable');
    }
  });

  clone.querySelectorAll('a[data-srlc-protected]').forEach(a => {
    const origStyle = a.getAttribute('data-orig-style');
    const origTitle = a.getAttribute('data-orig-title');
    if (origStyle) a.setAttribute('style', origStyle); else a.removeAttribute('style');
    if (origTitle) a.setAttribute('title', origTitle); else a.removeAttribute('title');
    a.removeAttribute('data-srlc-protected');
    a.removeAttribute('data-orig-style');
    a.removeAttribute('data-orig-title');
    a.removeAttribute('contenteditable');
  });

  let targetSelfCount = 0;
  clone.querySelectorAll('a[target="_self"]').forEach(a => {
    a.removeAttribute('target');
    targetSelfCount++;
  });

  return {
    html: restoreTemplateSyntax(clone.innerHTML, placeholders),
    targetSelfCount
  };
}

export function generatePreviewHtml(originalHtml, links, keepMap) {
  const { container, placeholders } = processContainer(originalHtml, links, keepMap, (a, link, keep) => {
    const toggleable = !link.isImageLink && !link.isCtaLink;

    a.setAttribute('data-orig-style', a.getAttribute('style') || '');
    a.setAttribute('data-orig-title', a.getAttribute('title') || '');

    if (keep) {
      a.style.cssText = 'background:#bbf7d0;padding:1px 3px;border-radius:3px;outline:1px solid #86efac;'
        + (toggleable ? 'cursor:pointer;' : '');
      a.setAttribute('title', toggleable ? 'Click to remove this link' : 'Image/CTA link (always kept)');
    } else {
      a.style.cssText = 'background:#fecaca;padding:1px 3px;border-radius:3px;text-decoration:line-through;color:#991b1b;cursor:pointer;';
      a.setAttribute('title', 'Click to keep this link');
    }

    a.setAttribute('contenteditable', 'false');

    if (toggleable) {
      a.setAttribute('data-link-id', link.id);
    } else {
      a.setAttribute('data-srlc-protected', '1');
    }
  });

  const bodyHtml = container.innerHTML;

  return {
    html: `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,system-ui,sans-serif;padding:24px;line-height:1.7;font-size:14px;color:#333;max-width:800px;}
    body:focus{outline:none;}
    img{max-width:100%;height:auto;}
    table{border-collapse:collapse;width:100%;margin:1em 0;}
    td,th{border:1px solid #ddd;padding:8px;text-align:left;}
    a[data-link-id]:hover{opacity:0.7;transition:opacity 0.1s;}
    .srlc-hint{background:#f0f1f5;padding:6px 12px;border-radius:6px;font-size:11px;color:#6c7281;margin-bottom:16px;line-height:1.4;}
    .srlc-hint strong{color:#4f46e5;}
  </style></head><body contenteditable="true">
  <div class="srlc-hint" contenteditable="false">Click <strong style="background:#bbf7d0;padding:1px 4px;border-radius:3px;">green</strong> or <strong style="background:#fecaca;padding:1px 4px;border-radius:3px;text-decoration:line-through;color:#991b1b;">red</strong> links to toggle. Text around links is editable.</div>
  ${bodyHtml}
  <script>
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[data-link-id]');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        parent.postMessage({type:'srlc-toggle', id: parseInt(link.getAttribute('data-link-id'))}, '*');
      }
    });
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      if (e.data.type === 'srlc-update') {
        var link = document.querySelector('a[data-link-id="' + e.data.id + '"]');
        if (link) {
          if (e.data.keep) {
            link.style.cssText = 'background:#bbf7d0;padding:1px 3px;border-radius:3px;outline:1px solid #86efac;cursor:pointer;';
            link.setAttribute('title', 'Click to remove this link');
          } else {
            link.style.cssText = 'background:#fecaca;padding:1px 3px;border-radius:3px;text-decoration:line-through;color:#991b1b;cursor:pointer;';
            link.setAttribute('title', 'Click to keep this link');
          }
        }
      }
      if (e.data.type === 'srlc-update-all') {
        var updates = e.data.updates;
        for (var i = 0; i < updates.length; i++) {
          var u = updates[i];
          var link = document.querySelector('a[data-link-id="' + u.id + '"]');
          if (link) {
            if (u.keep) {
              link.style.cssText = 'background:#bbf7d0;padding:1px 3px;border-radius:3px;outline:1px solid #86efac;cursor:pointer;';
              link.setAttribute('title', 'Click to remove this link');
            } else {
              link.style.cssText = 'background:#fecaca;padding:1px 3px;border-radius:3px;text-decoration:line-through;color:#991b1b;cursor:pointer;';
              link.setAttribute('title', 'Click to keep this link');
            }
          }
        }
      }
    });
  <\/script>
  </body></html>`,
    placeholders
  };
}
