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

// ===== Sanitization =====
// User-pasted HTML is rendered inside a sandboxed iframe with allow-same-origin
// (so the parent can read contentDocument). To prevent the pasted markup from
// running JS in our origin we strip every script-bearing surface before render.
// DOMParser does NOT execute scripts during parsing, so this is safe.
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');

  doc.querySelectorAll('script, noscript, iframe, object, embed').forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
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
// Stamps each anchor with `data-srlc-id` so downstream operations can match
// anchors to link metadata by id instead of by document-order position.
export function analyzeHtml(html, domain) {
  const sanitized = sanitizeHtml(html);
  const { html: protectedHtml, placeholders } = protectTemplateSyntax(sanitized);
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
        warnings.push({ type: 'broken', message: `Broken/invalid link: href="${href}" — "${(a.textContent || '').trim().slice(0, 40)}"` });
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
      rel: a.getAttribute('rel') || '',
    };

    a.setAttribute('data-srlc-id', String(link.id));

    links.push(link);

    if (!groups[normalized]) {
      groups[normalized] = {
        normalizedHref: normalized,
        originalHref: href,
        links: [],
        imageCount: 0,
        textCount: 0,
        ctaCount: 0,
        inHeadingCount: 0,
      };
    }
    const g = groups[normalized];
    g.links.push(link);
    if (img) g.imageCount++;
    else if (cta) g.ctaCount++;
    else g.textCount++;
    if (heading) g.inHeadingCount++;
  });

  for (const [url, group] of Object.entries(groups)) {
    if (group.textCount === 0 && group.ctaCount === 0 && group.imageCount > 0) {
      warnings.push({ type: 'image-only', message: `"${url}" only appears as image links (${group.imageCount}). Consider adding a text link for SEO.` });
    }
    if (group.inHeadingCount > 0) {
      warnings.push({ type: 'heading', message: `"${url}" has ${group.inHeadingCount} link(s) inside heading tags — consider removing.` });
    }
  }

  container.querySelectorAll('p').forEach((p) => {
    const count = p.querySelectorAll('a[href]').length;
    if (count >= 5) {
      warnings.push({ type: 'density', message: `High link density (${count} links) in paragraph: "${(p.textContent || '').slice(0, 60).trim()}..."` });
    }
  });

  const totalLinks = links.length;
  const uniqueUrls = Object.keys(groups).length;
  const imageLinks = links.filter((l) => l.isImageLink).length;
  const ctaLinks = links.filter((l) => l.isCtaLink).length;
  const textLinks = totalLinks - imageLinks - ctaLinks;
  const externalLinks = links.filter((l) => l.isExternal).length;

  return {
    links,
    groups,
    warnings,
    title,
    stampedHtml: container.innerHTML,
    placeholders,
    stats: { totalLinks, uniqueUrls, imageLinks, ctaLinks, textLinks, externalLinks },
  };
}

// ===== Auto-Strip Logic =====
function hasDifferentAnchors(textLinks) {
  if (textLinks.length < 2) return false;
  const normalized = textLinks.map((l) => l.anchorText.toLowerCase().trim());
  return new Set(normalized).size > 1;
}

export function computeAutoStrip(links, groups) {
  const keepMap = {};
  links.forEach((l) => { keepMap[l.id] = true; });

  for (const group of Object.values(groups)) {
    const textLinks = group.links.filter((l) => !l.isImageLink && !l.isCtaLink);

    if (textLinks.length === 2 && hasDifferentAnchors(textLinks)) {
      group.links.forEach((l) => { keepMap[l.id] = true; });
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
  links.forEach((l) => { keepMap[l.id] = true; });
  return keepMap;
}

// ===== HTML Generation =====
// `stampedHtml` is the analyze-time HTML with anchors stamped with data-srlc-id
// AND with {{...}} sequences already replaced by __SRLC_TPL_N__ placeholders.
// `placeholders` is the matching array from analyzeHtml — we restore at the end.
export function generateCleanHtml(stampedHtml, keepMap, placeholders = []) {
  const container = document.createElement('div');
  container.innerHTML = stampedHtml;

  container.querySelectorAll('a[data-srlc-id]').forEach((a) => {
    const id = parseInt(a.getAttribute('data-srlc-id'));
    if (keepMap[id] === false) {
      const parent = a.parentNode;
      while (a.firstChild) parent.insertBefore(a.firstChild, a);
      parent.removeChild(a);
    } else {
      a.removeAttribute('data-srlc-id');
    }
  });

  let targetSelfCount = 0;
  container.querySelectorAll('a[target="_self"]').forEach((a) => {
    a.removeAttribute('target');
    targetSelfCount++;
  });

  return {
    html: restoreTemplateSyntax(container.innerHTML, placeholders),
    targetSelfCount,
  };
}

export function generateCleanHtmlFromPreview(iframeBody, keepMap, placeholders) {
  const clone = iframeBody.cloneNode(true);

  const hint = clone.querySelector('.srlc-hint');
  if (hint) hint.remove();
  clone.querySelectorAll('script').forEach((s) => s.remove());

  clone.querySelectorAll('a[data-srlc-id]').forEach((a) => {
    const id = parseInt(a.getAttribute('data-srlc-id'));
    const keep = keepMap[id] !== false;

    if (!keep) {
      const parent = a.parentNode;
      while (a.firstChild) parent.insertBefore(a.firstChild, a);
      parent.removeChild(a);
      return;
    }

    const origStyle = a.getAttribute('data-orig-style');
    const origTitle = a.getAttribute('data-orig-title');
    const origClass = a.getAttribute('data-orig-class');
    if (origStyle) a.setAttribute('style', origStyle); else a.removeAttribute('style');
    if (origTitle) a.setAttribute('title', origTitle); else a.removeAttribute('title');
    if (origClass) a.setAttribute('class', origClass); else a.removeAttribute('class');
    a.removeAttribute('data-srlc-id');
    a.removeAttribute('data-srlc-protected');
    a.removeAttribute('data-orig-style');
    a.removeAttribute('data-orig-title');
    a.removeAttribute('data-orig-class');
    a.removeAttribute('contenteditable');
  });

  let targetSelfCount = 0;
  clone.querySelectorAll('a[target="_self"]').forEach((a) => {
    a.removeAttribute('target');
    targetSelfCount++;
  });

  return {
    html: restoreTemplateSyntax(clone.innerHTML, placeholders),
    targetSelfCount,
  };
}

const PREVIEW_STYLE = `
  body{font-family:-apple-system,system-ui,sans-serif;padding:24px;line-height:1.7;font-size:14px;color:#333;max-width:800px;}
  body:focus{outline:none;}
  img{max-width:100%;height:auto;}
  table{border-collapse:collapse;width:100%;margin:1em 0;}
  td,th{border:1px solid #ddd;padding:8px;text-align:left;}
  .srlc-keep{background:#bbf7d0;padding:1px 3px;border-radius:3px;outline:1px solid #86efac;}
  .srlc-keep[data-toggleable]{cursor:pointer;}
  .srlc-keep[data-toggleable]:hover{opacity:0.75;transition:opacity 0.1s;}
  .srlc-remove{background:#fecaca;padding:1px 3px;border-radius:3px;text-decoration:line-through;color:#991b1b;cursor:pointer;}
  .srlc-remove:hover{opacity:0.75;transition:opacity 0.1s;}
  .srlc-hint{background:#f0f1f5;padding:6px 12px;border-radius:6px;font-size:11px;color:#6c7281;margin-bottom:16px;line-height:1.4;}
  .srlc-hint strong.k{background:#bbf7d0;padding:1px 4px;border-radius:3px;color:#166534;}
  .srlc-hint strong.r{background:#fecaca;padding:1px 4px;border-radius:3px;text-decoration:line-through;color:#991b1b;}
`;

const PREVIEW_SCRIPT = `
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[data-srlc-id][data-toggleable]');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      parent.postMessage({type:'srlc-toggle', id: parseInt(link.getAttribute('data-srlc-id'))}, '*');
    }
  });
  window.addEventListener('message', function(e) {
    if (!e.data) return;
    function apply(id, keep) {
      var link = document.querySelector('a[data-srlc-id="' + id + '"]');
      if (!link) return;
      link.classList.toggle('srlc-keep', !!keep);
      link.classList.toggle('srlc-remove', !keep);
      link.setAttribute('title', keep ? 'Click to remove this link' : 'Click to keep this link');
    }
    if (e.data.type === 'srlc-update') apply(e.data.id, e.data.keep);
    if (e.data.type === 'srlc-update-all') {
      (e.data.updates || []).forEach(function(u) { apply(u.id, u.keep); });
    }
  });
`;

export function generatePreviewHtml(stampedHtml, links, keepMap, placeholders) {
  const container = document.createElement('div');
  container.innerHTML = stampedHtml;

  const toggleableIds = new Set(
    links.filter((l) => !l.isImageLink && !l.isCtaLink).map((l) => l.id)
  );

  container.querySelectorAll('a[data-srlc-id]').forEach((a) => {
    const id = parseInt(a.getAttribute('data-srlc-id'));
    const keep = keepMap[id] !== false;
    const toggleable = toggleableIds.has(id);

    a.setAttribute('data-orig-style', a.getAttribute('style') || '');
    a.setAttribute('data-orig-title', a.getAttribute('title') || '');
    a.setAttribute('data-orig-class', a.getAttribute('class') || '');

    a.removeAttribute('style');
    if (toggleable) {
      a.className = keep ? 'srlc-keep' : 'srlc-remove';
      a.setAttribute('title', keep ? 'Click to remove this link' : 'Click to keep this link');
      a.setAttribute('data-toggleable', '1');
    } else {
      a.className = 'srlc-keep';
      a.setAttribute('title', 'Image/CTA link (always kept)');
    }
    a.setAttribute('contenteditable', 'false');
  });

  return {
    html:
      `<!DOCTYPE html><html><head><style>${PREVIEW_STYLE}</style></head>` +
      `<body contenteditable="true"><div class="srlc-hint" contenteditable="false">Click <strong class="k">green</strong> or <strong class="r">red</strong> links to toggle. Text around links is editable.</div>` +
      `${container.innerHTML}` +
      `<scr` + `ipt>${PREVIEW_SCRIPT}</scr` + `ipt></body></html>`,
    placeholders,
  };
}
