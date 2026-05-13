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
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'GET') {
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

    const attempts = [];
    for (const ua of CRAWLER_UAS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(parsed.toString(), {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
          },
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

function shortUa(ua) {
  const m = ua.match(/^([A-Za-z]+(?:bot|hit|expanding)?)/i);
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
