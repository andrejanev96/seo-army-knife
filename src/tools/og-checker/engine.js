// Fetch + proxy-failover logic moved to src/lib/fetchViaProxy.js so other
// tools can reuse it. Re-exported here so existing imports keep working.
export { fetchPageHtml, detectBotChallenge } from '../../lib/fetchViaProxy';

export function parseMetaTags(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const getMeta = (attr, value) => {
    const el = doc.querySelector(`meta[${attr}="${value}"]`);
    return el?.getAttribute('content') || '';
  };

  const resolveUrl = (href) => {
    if (!href) return '';
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  };

  const iconEl =
    doc.querySelector('link[rel="icon"]') ||
    doc.querySelector('link[rel="shortcut icon"]') ||
    doc.querySelector('link[rel="apple-touch-icon"]');
  const favicon = resolveUrl(iconEl?.getAttribute('href') || '');

  const meta = {
    title: doc.querySelector('title')?.textContent?.trim() || '',
    description: getMeta('name', 'description'),
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
    favicon,

    og: {
      title: getMeta('property', 'og:title'),
      description: getMeta('property', 'og:description'),
      image: resolveUrl(getMeta('property', 'og:image')),
      url: getMeta('property', 'og:url'),
      type: getMeta('property', 'og:type'),
      siteName: getMeta('property', 'og:site_name'),
    },

    twitter: {
      card: getMeta('name', 'twitter:card') || getMeta('property', 'twitter:card'),
      title: getMeta('name', 'twitter:title') || getMeta('property', 'twitter:title'),
      description: getMeta('name', 'twitter:description') || getMeta('property', 'twitter:description'),
      image: resolveUrl(getMeta('name', 'twitter:image') || getMeta('property', 'twitter:image')),
      domain: getMeta('name', 'twitter:domain') || getMeta('property', 'twitter:domain'),
      site: getMeta('name', 'twitter:site') || getMeta('property', 'twitter:site'),
    },
  };

  const rawTags = [];
  const titleEl = doc.querySelector('title');
  if (titleEl) rawTags.push({ tag: 'title', content: meta.title });

  if (meta.description) rawTags.push({ tag: 'meta', name: 'description', content: meta.description });
  if (meta.canonical) rawTags.push({ tag: 'link', rel: 'canonical', href: meta.canonical });

  doc.querySelectorAll('meta[property^="og:"]').forEach((el) => {
    rawTags.push({ tag: 'meta', property: el.getAttribute('property'), content: el.getAttribute('content') || '' });
  });

  doc.querySelectorAll('meta[name^="twitter:"], meta[property^="twitter:"]').forEach((el) => {
    const prop = el.getAttribute('name') || el.getAttribute('property');
    rawTags.push({ tag: 'meta', name: prop, content: el.getAttribute('content') || '' });
  });

  meta.rawTags = rawTags;
  return meta;
}

// Title/description length recommendations.
// Below MIN_OK or above MAX_OK → error (red).
// Outside IDEAL range but within OK range → warning (amber).
// Inside IDEAL range → green.
export const TITLE_LENGTH = { minOk: 30, idealMin: 50, idealMax: 60, maxOk: 90 };
export const DESC_LENGTH  = { minOk: 70, idealMin: 110, idealMax: 160, maxOk: 200 };

export function detectIssues(meta) {
  const issues = [];
  const err = (msg) => issues.push({ severity: 'error', message: msg });
  const warn = (msg) => issues.push({ severity: 'warning', message: msg });
  const info = (msg) => issues.push({ severity: 'info', message: msg });

  if (!meta.og.title) err('Missing og:title');
  if (!meta.og.description) err('Missing og:description');
  if (!meta.og.image) err('Missing og:image');

  if (!meta.og.url) warn('Missing og:url');
  if (!meta.og.type) warn('Missing og:type');
  if (!meta.twitter.card) warn('Missing twitter:card');

  const t = meta.og.title;
  if (t) {
    if (t.length > TITLE_LENGTH.maxOk) err(`og:title is too long (${t.length} chars, max ${TITLE_LENGTH.maxOk})`);
    else if (t.length < TITLE_LENGTH.minOk) err(`og:title is too short (${t.length} chars, min ${TITLE_LENGTH.minOk})`);
    else if (t.length < TITLE_LENGTH.idealMin || t.length > TITLE_LENGTH.idealMax) {
      warn(`og:title is ${t.length} chars (ideal ${TITLE_LENGTH.idealMin}-${TITLE_LENGTH.idealMax})`);
    }
  }

  const d = meta.og.description;
  if (d) {
    if (d.length > DESC_LENGTH.maxOk) err(`og:description is too long (${d.length} chars, max ${DESC_LENGTH.maxOk})`);
    else if (d.length < DESC_LENGTH.minOk) err(`og:description is too short (${d.length} chars, min ${DESC_LENGTH.minOk})`);
    else if (d.length < DESC_LENGTH.idealMin || d.length > DESC_LENGTH.idealMax) {
      warn(`og:description is ${d.length} chars (ideal ${DESC_LENGTH.idealMin}-${DESC_LENGTH.idealMax})`);
    }
  }

  if (meta.og.image && meta.og.image.startsWith('http://')) warn('og:image uses HTTP instead of HTTPS');

  if (!meta.canonical) info('No canonical URL found');
  if (!meta.favicon) info('No favicon found');

  if (meta.title && meta.og.title && meta.title !== meta.og.title) {
    info('Page title differs from og:title');
  }

  return issues;
}

export function lengthStatus(len, spec) {
  if (!len) return 'empty';
  if (len < spec.minOk || len > spec.maxOk) return 'error';
  if (len < spec.idealMin || len > spec.idealMax) return 'warning';
  return 'ok';
}

export function generateMetaTagsCode(meta) {
  const lines = [];

  lines.push('<!-- HTML Meta Tags -->');
  if (meta.title) lines.push(`<title>${esc(meta.title)}</title>`);
  if (meta.description) lines.push(`<meta name="description" content="${esc(meta.description)}">`);
  if (meta.canonical) lines.push(`<link rel="canonical" href="${esc(meta.canonical)}">`);

  lines.push('');
  lines.push('<!-- Open Graph / Facebook -->');
  if (meta.og.url) lines.push(`<meta property="og:url" content="${esc(meta.og.url)}">`);
  if (meta.og.type) lines.push(`<meta property="og:type" content="${esc(meta.og.type)}">`);
  if (meta.og.siteName) lines.push(`<meta property="og:site_name" content="${esc(meta.og.siteName)}">`);
  if (meta.og.title) lines.push(`<meta property="og:title" content="${esc(meta.og.title)}">`);
  if (meta.og.description) lines.push(`<meta property="og:description" content="${esc(meta.og.description)}">`);
  if (meta.og.image) lines.push(`<meta property="og:image" content="${esc(meta.og.image)}">`);

  lines.push('');
  lines.push('<!-- Twitter -->');
  if (meta.twitter.card) lines.push(`<meta name="twitter:card" content="${esc(meta.twitter.card)}">`);
  if (meta.twitter.domain) lines.push(`<meta name="twitter:domain" content="${esc(meta.twitter.domain)}">`);
  if (meta.twitter.site) lines.push(`<meta name="twitter:site" content="${esc(meta.twitter.site)}">`);
  if (meta.twitter.title) lines.push(`<meta name="twitter:title" content="${esc(meta.twitter.title)}">`);
  if (meta.twitter.description) lines.push(`<meta name="twitter:description" content="${esc(meta.twitter.description)}">`);
  if (meta.twitter.image) lines.push(`<meta name="twitter:image" content="${esc(meta.twitter.image)}">`);

  return lines.join('\n');
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
