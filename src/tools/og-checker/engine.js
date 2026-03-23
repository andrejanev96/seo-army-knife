const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  }
}

export async function fetchPageHtml(url) {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }
  // Validate URL
  try {
    new URL(normalized);
  } catch {
    throw new Error('Invalid URL');
  }

  const target = CORS_PROXY + encodeURIComponent(normalized);

  // Try up to 2 times (initial + 1 retry on timeout)
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(target, 20000);
      if (!res.ok) {
        throw new Error(`Failed to fetch (${res.status})`);
      }
      return { html: await res.text(), finalUrl: normalized };
    } catch (err) {
      lastError = err;
      if (err.message !== 'Request timed out' || attempt === 1) throw err;
      // Retry once on timeout
    }
  }
  throw lastError;
}

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

  // Extract favicon
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

  // Collect raw tags for code display
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

  if (meta.og.title && meta.og.title.length > 90) warn(`og:title is too long (${meta.og.title.length} chars, recommended < 90)`);
  if (meta.og.title && meta.og.title.length < 15) warn(`og:title is too short (${meta.og.title.length} chars, recommended > 15)`);

  if (meta.og.description && meta.og.description.length > 200) warn(`og:description is too long (${meta.og.description.length} chars, recommended < 200)`);
  if (meta.og.description && meta.og.description.length < 70) warn(`og:description is too short (${meta.og.description.length} chars, recommended > 70)`);

  if (meta.og.image && meta.og.image.startsWith('http://')) warn('og:image uses HTTP instead of HTTPS');

  if (!meta.canonical) info('No canonical URL found');
  if (!meta.favicon) info('No favicon found');

  if (meta.title && meta.og.title && meta.title !== meta.og.title) {
    info('Page title differs from og:title');
  }

  return issues;
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
