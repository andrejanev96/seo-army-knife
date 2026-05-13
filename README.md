# SEO Army Knife

A small, fast SPA of single-purpose SEO and content-ops utilities. Built primarily for the editorial pipeline behind ammo.com — tactical helpers that save 5–30 minutes per article during cleanup, audit, and pre-publish.

Everything runs in the browser. A small Cloudflare Worker handles the cases where the browser can't fetch a page directly (CORS, bot walls).

## Tools today

| Tool | What it does |
|---|---|
| **OG Tag Checker** | Fetch a URL (or paste raw HTML) and inspect Open Graph + meta tags. Renders previews for Facebook, X, LinkedIn, WhatsApp, Discord. Flags missing/oversized tags. |
| **Redundant Link Cleaner** | Paste an article's HTML, get a sandboxed preview, and interactively keep/remove duplicate links. Auto-strips repeats while preserving images, CTAs, and the first occurrence of each URL. |
| **Table Beautifier** | Paste any `<table>`, get the ammo.com house-style table back (dark theme, gold left border, red headers, alternating rows). |
| **Report Highlights → Create** | Plain-text bullets → `report-highlights` HTML block. |
| **Report Highlights → Convert** | Old `.content-box` markup → new `report-highlights` markup. |

A roadmap of what's next lives in [ROADMAP.md](ROADMAP.md).

## Run it locally

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # production build to dist/
npm run preview      # serve the production build locally
npm test             # vitest, single run
npm run test:watch   # vitest watch mode
npm run lint         # eslint
```

## Add a new tool

1. Create `src/tools/<tool-id>/index.js`. Two shapes:

   **Transform tool** (auto-rendered through the shared `ToolWorkbench` — input textarea → `transform(input)` → output textarea):
   ```js
   import { mySlug } from './transform';
   export default {
     id: 'my-tool',
     name: 'My Tool',
     category: null,                        // or 'My Group' to nest
     description: 'One sentence shown above the workbench.',
     inputLabel: 'Input',
     inputPlaceholder: '...',
     outputLabel: 'Output',
     outputPlaceholder: '...',
     transform: mySlug,                     // pure fn; throw on invalid input
   };
   ```

   **Rich tool** (you bring the UI):
   ```js
   import MyTool from './MyTool';
   export default {
     id: 'my-tool',
     name: 'My Tool',
     category: null,
     description: 'One sentence.',
     component: MyTool,
   };
   ```

2. Register it in [src/tools/registry.js](src/tools/registry.js):
   ```js
   import myTool from './my-tool';
   const tools = [/* ... */, myTool];
   ```

3. It appears in the sidebar at `/#/tool/my-tool`.

Conventions, the current-draft buffer, and the shared HTTP layer are documented in [CLAUDE.md](CLAUDE.md).

## The Cloudflare Worker

`worker/` is a tiny proxy that fetches third-party pages on behalf of the SPA, rotating social-crawler user-agents to bypass most "Allow legitimate crawlers" rules on Cloudflare-protected sites.

- Free tier: 100k requests/day.
- Optional paired-secret mode (`INSPECTOR_KEY`) — site owners add a WAF rule on their own zone that bypasses bot protection when the worker sends a matching `X-Inspector-Key`. No UA spoofing required.
- Two modes: `?mode=raw` (default — full HTML) and `?mode=head` (status + redirect chain).

Deploy with Wrangler. See [worker/README.md](worker/README.md). After deploying, set `VITE_CRAWLER_PROXY_URL` in `.env.local` to your worker URL (or use the legacy `VITE_OG_PROXY_URL` — both are honored).

If no worker is configured, fetch-using tools fall through to public CORS proxies (allorigins, corsproxy, codetabs). Lower success rate against CF-protected sites but the basics still work.

## License

Private — internal tooling.
