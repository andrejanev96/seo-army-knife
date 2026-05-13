// Shared HTTP plumbing for tools that fetch third-party URLs from the browser.
//
// The optional Cloudflare Worker (deployed from the worker/ directory) is
// preferred — it sends rotating social-crawler User-Agents and gets through
// most CF-protected sites. Falls back to public CORS proxies when the worker
// isn't configured, errors, or 502s.
//
// Engine modules should import from here rather than reimplementing fetch
// + timeout + proxy-failover logic per tool.

const WORKER_URL = (
  import.meta.env?.VITE_CRAWLER_PROXY_URL ||
  import.meta.env?.VITE_OG_PROXY_URL ||
  ''
).replace(/\/$/, '');

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
// streaming still aborts on timeout. The previous og-checker bug: clearing the
// timer when headers arrived left a stalled body hanging forever (spinning bar,
// no error toast).
async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
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

// Public proxies often serve bot-challenge pages with HTTP 200, so res.ok
// can't catch them — pattern-match the body. Returns a label for the gate
// or null if the HTML looks like a real page.
export function detectBotChallenge(html) {
  if (!html) return null;
  const lower = html.toLowerCase();

  if (lower.includes('cf-browser-verification') ||
      lower.includes('cdn-cgi/challenge-platform') ||
      lower.includes('challenges.cloudflare.com') ||
      (lower.includes('<title>just a moment') && lower.includes('cloudflare'))) {
    return 'Cloudflare';
  }
  if (/<title>\s*just a moment/i.test(html)) {
    return 'Cloudflare-style';
  }
  if (lower.includes('awswafcaptcha') || lower.includes('aws waf')) {
    return 'AWS WAF';
  }
  if (lower.includes('px-captcha') || lower.includes('_pxcaptcha')) {
    return 'PerimeterX';
  }
  if (lower.includes('akam/') && lower.includes('access denied')) {
    return 'Akamai';
  }
  if ((lower.includes('h-captcha') || lower.includes('hcaptcha.com/captcha')) &&
      !lower.includes('<meta property="og:')) {
    return 'hCaptcha';
  }

  return null;
}

function normalizeUrl(url) {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
  try {
    new URL(normalized);
  } catch {
    throw new Error('Invalid URL');
  }
  return normalized;
}

// Fetch the raw HTML of a URL through the proxy chain. Returns
// `{ html, finalUrl }` or throws with a human-readable message that names
// every proxy that failed and how (HTTP status / timeout / bot challenge).
export async function fetchPageHtml(url) {
  const normalized = normalizeUrl(url);

  const failures = [];
  let lastChallenge = null;
  for (const proxy of PROXIES) {
    try {
      const html = await fetchWithTimeout(proxy.build(normalized));
      if (!html || html.length < 50) {
        failures.push(`${proxy.name}: empty response`);
        continue;
      }
      const challenge = detectBotChallenge(html);
      if (challenge) {
        // Try the next proxy — a different exit IP may pass.
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

// Walks the redirect chain via the worker's `mode=head` endpoint. Returns
// `{ chain: [{url, status, location}], finalUrl, finalStatus }` or throws.
//
// When the worker is not configured, falls back to a single GET via the
// public proxies — without a worker we can't see intermediate redirects,
// so the chain will be [{url, status: finalStatus, location: null}].
export async function fetchStatusChain(url) {
  const normalized = normalizeUrl(url);

  if (WORKER_URL) {
    const endpoint = `${WORKER_URL}/?url=${encodeURIComponent(normalized)}&mode=head`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, { signal: controller.signal });
      if (!res.ok) throw new Error(`worker HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.chain)) {
        throw new Error('worker returned malformed chain');
      }
      return data;
    } catch (err) {
      throw new Error(`status chain failed: ${describeError(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  // No worker — best-effort via public proxies. We can't observe hops.
  try {
    await fetchPageHtml(normalized);
    return {
      chain: [{ url: normalized, status: 200, location: null }],
      finalUrl: normalized,
      finalStatus: 200,
    };
  } catch (err) {
    return {
      chain: [{ url: normalized, status: 0, location: null, error: err.message }],
      finalUrl: normalized,
      finalStatus: 0,
    };
  }
}
