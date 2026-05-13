// og-fetch — Cloudflare Worker proxy for OG / meta-tag inspection.
//
// Public CORS proxies (allorigins, corsproxy, codetabs) all share a small
// pool of datacenter IPs that Cloudflare flags on sight. This Worker
// instead sends a rotating set of social-crawler User-Agents that
// Cloudflare's "Allow legitimate crawlers" managed rule whitelists for
// most public content. ~70-80% of CF-protected sites become reachable.
//
// Free tier: 100k requests/day on Cloudflare Workers.

const CRAWLER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
];

const TIMEOUT_MS = 10000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return json({ error: 'missing ?url= query param' }, 400);
    }

    let parsed;
    try {
      parsed = new URL(target);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('only http/https');
    } catch {
      return json({ error: 'invalid url (must be absolute http(s))' }, 400);
    }

    // Refuse to proxy private / loopback / metadata addresses. The Worker
    // runs on Cloudflare's edge, but defense in depth.
    if (isPrivateHost(parsed.hostname)) {
      return json({ error: 'private/internal host blocked' }, 403);
    }

    // Optional: shared secret for site-owner-paired access. When INSPECTOR_KEY
    // is configured, we send it as X-Inspector-Key on every upstream fetch.
    // Site owners add a WAF rule on their own Cloudflare zone that bypasses
    // bot protection when this header matches — no UA spoofing, no IP games.
    const inspectorKey = env?.INSPECTOR_KEY;

    const mode = (url.searchParams.get('mode') || 'raw').toLowerCase();
    if (mode === 'head') {
      return handleHeadMode(parsed, inspectorKey);
    }
    if (mode !== 'raw') {
      return json({ error: `unknown mode "${mode}" (supported: raw, head)` }, 400);
    }

    const attempts = [];
    for (const ua of CRAWLER_UAS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const upstreamHeaders = {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        };
        if (inspectorKey) upstreamHeaders['X-Inspector-Key'] = inspectorKey;

        const res = await fetch(parsed.toString(), {
          headers: upstreamHeaders,
          redirect: 'follow',
          signal: controller.signal,
          // Skip Cloudflare's own edge cache — we want a fresh fetch each call
          // because the target may serve different HTML per UA.
          cf: { cacheTtl: 0, cacheEverything: false },
        });
        clearTimeout(timer);

        if (!res.ok) {
          attempts.push(`${shortUa(ua)}: HTTP ${res.status}`);
          continue;
        }
        const html = await res.text();

        if (looksLikeChallenge(html)) {
          attempts.push(`${shortUa(ua)}: bot challenge`);
          continue;
        }

        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'X-Og-Fetch-Ua': shortUa(ua),
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        clearTimeout(timer);
        const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch failed');
        attempts.push(`${shortUa(ua)}: ${reason}`);
      }
    }

    return json(
      {
        error: 'All crawler user-agents were blocked or timed out.',
        url: parsed.toString(),
        attempts,
        hint: 'Site likely has aggressive bot protection (Bot Fight Mode / WAF). Try the official Facebook / LinkedIn / Google debuggers instead.',
      },
      502
    );
  },
};

// `mode=head` — walks the redirect chain manually so callers can see every
// hop, not just the final URL. Uses HEAD first; falls back to a small GET
// (Range: bytes=0-0) if the server 405s HEAD. Returns JSON, never HTML.
const MAX_REDIRECTS = 10;
async function handleHeadMode(parsed, inspectorKey) {
  const chain = [];
  let currentUrl = parsed.toString();
  let finalStatus = 0;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsedHop;
    try {
      parsedHop = new URL(currentUrl);
    } catch {
      chain.push({ url: currentUrl, status: 0, location: null, error: 'invalid redirect target' });
      break;
    }
    if (!/^https?:$/.test(parsedHop.protocol) || isPrivateHost(parsedHop.hostname)) {
      chain.push({ url: currentUrl, status: 0, location: null, error: 'blocked host' });
      break;
    }

    const upstreamHeaders = {
      'User-Agent': CRAWLER_UAS[0],
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
    };
    if (inspectorKey) upstreamHeaders['X-Inspector-Key'] = inspectorKey;

    let res;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      res = await fetch(currentUrl, {
        method: 'HEAD',
        headers: upstreamHeaders,
        redirect: 'manual',
        signal: controller.signal,
        cf: { cacheTtl: 0, cacheEverything: false },
      });
      // Some servers reject HEAD outright. Retry with a tiny ranged GET.
      if (res.status === 405 || res.status === 501) {
        res = await fetch(currentUrl, {
          method: 'GET',
          headers: { ...upstreamHeaders, Range: 'bytes=0-0' },
          redirect: 'manual',
          signal: controller.signal,
          cf: { cacheTtl: 0, cacheEverything: false },
        });
      }
    } catch (err) {
      clearTimeout(timer);
      const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch failed');
      chain.push({ url: currentUrl, status: 0, location: null, error: reason });
      break;
    }
    clearTimeout(timer);

    const status = res.status;
    const location = res.headers.get('location');
    chain.push({ url: currentUrl, status, location: location || null });
    finalStatus = status;

    if (status >= 300 && status < 400 && location) {
      let next;
      try { next = new URL(location, currentUrl).toString(); }
      catch { break; }
      if (next === currentUrl) break; // self-redirect loop guard
      currentUrl = next;
      continue;
    }
    break;
  }

  return new Response(
    JSON.stringify({ chain, finalUrl: currentUrl, finalStatus }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function shortUa(ua) {
  // Pick the most identifying token: prefer "*bot" / "*hit" / "*expanding"
  // tokens anywhere in the UA string over a generic "Mozilla" prefix.
  const known = ua.match(/\b([A-Za-z]+(?:bot|hit|expanding))\b/i);
  if (known) return known[1].toLowerCase();
  const m = ua.match(/^([A-Za-z]+)/);
  return m ? m[1].toLowerCase() : 'crawler';
}

function looksLikeChallenge(html) {
  if (!html || html.length < 200) return true;
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes('cdn-cgi/challenge-platform') ||
    head.includes('challenges.cloudflare.com') ||
    (head.includes('<title>just a moment') && head.includes('cloudflare')) ||
    head.includes('awswafcaptcha') ||
    head.includes('px-captcha')
  );
}

function isPrivateHost(host) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '::1') return true;
  // IPv4 ranges: 10/8, 127/8, 169.254/16, 172.16-31/12, 192.168/16
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
