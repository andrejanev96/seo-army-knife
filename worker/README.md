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

## What it can't bypass (without help)

- Cloudflare sites that block even known crawler UAs (verified-bot
  mode, custom WAF rule, or Bot Fight Mode set to "block all bots").
  Standard fetches will return 403 on every UA.
- Sites behind auth. Use the official Facebook / LinkedIn / Google
  debugger links in the error panel for those.

## Bypassing your own sites (paired-secret mode)

If the site you can't reach is **your own** (or one whose Cloudflare
account you control), you can pair this Worker to it with a shared
secret. The Worker sends `X-Inspector-Key: <secret>` on every upstream
fetch; your site has one WAF rule that lets that header through. No
UA spoofing, no IP guessing, no broad allowlists.

### One-time setup

**1. Set the secret on the Worker:**

```bash
cd worker
# Generate a random 32-byte secret. Save this somewhere — you'll paste
# it into the Cloudflare dashboard in step 2.
openssl rand -hex 32

# Tell wrangler to store it as a Worker secret (encrypted, not in git):
npx wrangler secret put INSPECTOR_KEY
# Paste the value from openssl when prompted. Then redeploy:
npx wrangler deploy
```

**2. Add a WAF rule on the target site (the one whose pages you're
inspecting — e.g. ammo.com):**

   1. Open the Cloudflare dashboard
   2. Pick the zone (the site domain)
   3. Security → **WAF** → **Custom rules** → **Create rule**
   4. Name it: `Allow OG Inspector`
   5. Field: `Custom header`, Header name: `X-Inspector-Key`, Operator:
      `equals`, Value: paste the secret from step 1
   6. Action: **Skip**
   7. In the "Skip" panel, tick:
      - All remaining custom rules
      - All Cloudflare-managed rules
      - All rate-limiting rules
      - **Super Bot Fight Mode**
   8. Deploy

That's it. Anyone hitting your site without the header gets the
normal bot wall. The Worker, holding the secret, walks straight in.

### Verifying

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://og-fetch.<your-account>.workers.dev/?url=https://your-site.com/article"
# 200 means the rule is in place. 403/502 means the rule didn't match
# (check header-name capitalization in the dashboard, or test for
# typos in the secret).
```

### Rotating the secret

```bash
npx wrangler secret put INSPECTOR_KEY    # paste new value
npx wrangler deploy
# Then update the WAF rule in the dashboard with the new value.
```

## Cost

Free tier: 100,000 requests/day. Each fetch is well under the 10ms
CPU limit (most of the time is network wait, which doesn't count
against CPU). For a personal SEO tool you will not hit any limit.
