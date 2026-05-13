# og-fetch

A 100-line Cloudflare Worker that proxies HTML fetches for the OG Tag
Checker. Sends a rotating set of social-crawler User-Agents that
Cloudflare's default "Allow legitimate crawlers" rule whitelists, so
~70-80% of Cloudflare-protected pages become reachable without a paid
headless-browser service.

## What it does on each request

```
GET /?url=<encoded URL>
```

1. Validates the URL is absolute http(s) and not a private/internal host.
2. Iterates these User-Agents in order, stopping at the first that
   returns 200 with HTML that doesn't look like a bot-challenge page:
   - `facebookexternalhit/1.1`
   - `Twitterbot/1.0`
   - `LinkedInBot/1.0`
   - `Slackbot-LinkExpanding 1.0`
   - `Discordbot/2.0`
3. Returns the HTML with `Content-Type: text/html` and an
   `X-Og-Fetch-Ua` response header naming which crawler identity won.
4. If every UA gets blocked or times out, returns `502` with a JSON
   body listing what happened on each attempt.

## Deploy

One-time:

```bash
npm install -g wrangler   # or use npx
wrangler login            # opens browser, creates an API token tied to your CF account
```

From the `worker/` directory:

```bash
wrangler deploy
```

You'll see something like:

```
Published og-fetch (1.23 sec)
  https://og-fetch.<your-account>.workers.dev
```

That URL is your endpoint.

## Wire it into the frontend

Create `.env.local` at the repo root (gitignored via `*.local`):

```
VITE_OG_PROXY_URL=https://og-fetch.<your-account>.workers.dev
```

Restart `npm run dev`. The OG Checker now tries your Worker first and
falls back to the three public proxies if it fails or times out.

For production builds (GitHub Pages, etc.), set `VITE_OG_PROXY_URL`
in your deploy environment — for GitHub Actions, add it as a repo
variable and reference it in the workflow `env:` block.

## Local development

```bash
wrangler dev
# Listens on http://localhost:8787
# Test: curl 'http://localhost:8787/?url=https://example.com'
```

## What it can't bypass

- Cloudflare sites that explicitly disabled the social-crawler
  allowlist or enabled "Super Bot Fight Mode" with JS challenges for
  every visitor. These need a real headless browser (ScrapingBee,
  Browserless, Bright Data — paid services).
- Sites behind auth. Use the official Facebook / LinkedIn / Google
  debugger links in the error panel for those.
- Sites that block all but their owner's known Facebook App ID via
  signed crawler tokens. Rare, but exists.

## Cost

Free tier: 100,000 requests/day. Each fetch is well under the 10ms
CPU limit (most of the time is network wait, which doesn't count
against CPU). For a personal SEO tool you will not hit any limit.
