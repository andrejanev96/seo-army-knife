// Proxies tried in order. The optional Cloudflare Worker (deployed from
// the worker/ directory, address set via VITE_OG_PROXY_URL) is preferred —
// it sends rotating social-crawler User-Agents and gets through most CF
// sites. Falls back to the three public CORS proxies if the Worker isn't
// configured, errors, or 502s.
const WORKER_URL = (import.meta.env?.VITE_OG_PROXY_URL || '').replace(/\/$/, '');

const PROXIES = [
  ...(WORKER_URL
    ? [{ name: 'worker', build: (u) => `${WORKER_URL}/?url=${encodeURIComponent(u)}` }]
    : []),
  { name: 'allorigins', build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: 'corsproxy',  build: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
  { name: 'codetabs',   build: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}` },
];

const FETCH_TIMEOUT_MS = 12000;

// fetch() + res.text() share one AbortController so a body that never finishes
// streaming still aborts on timeout. The previous implementation cleared the
// timer the moment headers arrived, so a stalled body left the request hanging
// forever (the symptom: spinning loading bar, no error toast).
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function describeError(err) {
  if (err?.name === 'AbortError') return 'timed out';
  return err?.message || 'request failed';
}

// Public proxies often get served bot-challenge pages instead of the real
// content. The HTTP status is 200 so res.ok() doesn't notice — we have to
// pattern-match the body. Returns a label for the gate or null if the HTML
// looks like a real page.
export function detectBotChallenge(html) {
  if (!html) return null;
  const lower = html.toLowerCase();

  // Cloudflare "Just a moment..." interstitial
  if (lower.includes('cf-browser-verification') ||
      lower.includes('cdn-cgi/challenge-platform') ||
      lower.includes('challenges.cloudflare.com') ||
      (lower.includes('<title>just a moment') && lower.includes('cloudflare'))) {
    return 'Cloudflare';
  }
  // Generic "Just a moment..." with no other signal — still likely a bot wall
  if (/<title>\s*just a moment/i.test(html)) {
    return 'Cloudflare-style';
  }
  // AWS WAF
  if (lower.includes('awswafcaptcha') || lower.includes('aws waf')) {
    return 'AWS WAF';
  }
  // PerimeterX / HUMAN
  if (lower.includes('px-captcha') || lower.includes('_pxcaptcha')) {
    return 'PerimeterX';
  }
  // Akamai bot manager
  if (lower.includes('akam/') && lower.includes('access denied')) {
    return 'Akamai';
  }
  // hCaptcha / reCAPTCHA full-page challenge
  if ((lower.includes('h-captcha') || lower.includes('hcaptcha.com/captcha')) &&
      !lower.includes('<meta property="og:')) {
    return 'hCaptcha';
  }

  return null;
}

export async function fetchPageHtml(url) {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
  try {
    new URL(normalized);
  } catch {
    throw new Error('Invalid URL');
  }

  const failures = [];
  let lastChallenge = null;
  for (const proxy of PROXIES) {
    try {
      const html = await fetchWithTimeout(proxy.build(normalized), FETCH_TIMEOUT_MS);
      if (!html || html.length < 50) {
        failures.push(`${proxy.name}: empty response`);
        continue;
      }
      const challenge = detectBotChallenge(html);
      if (challenge) {
        // Try the next proxy — a different exit IP may pass the challenge.
        failures.push(`${proxy.name}: blocked by ${challenge}`);
        lastChallenge = challenge;
        continue;
      }
      return { html, finalUrl: normalized };
    } catch (err) {
      failures.push(`${proxy.name}: ${describeError(err)}`);
    }
  }

  if (lastChallenge) {
    throw new Error(
      `Site is protected by ${lastChallenge}. All CORS proxies were challenged. ` +
      `Try a social platform's official debugger (e.g. Facebook Sharing Debugger) instead.`
    );
  }
  throw new Error(`Could not fetch URL (${failures.join('; ')})`);
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
