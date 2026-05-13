# SEO Army Knife — agent guide

A React 19 + Vite SPA hosting browser-side SEO/content-ops utilities, with a Cloudflare Worker that proxies fetches when a tool needs to bypass CORS or bot walls. Built primarily for the editorial pipeline behind ammo.com (ballistics / comparison / data-study / best-of articles).

## Stack
- React 19, React Router 7 (`HashRouter` — works on any static host without server-side routing).
- Vite 7 build, Vitest + happy-dom for tests, ESLint 9 flat config.
- Cloudflare Worker (`worker/`) deployed via Wrangler. Free tier — 100k req/day.
- No TypeScript yet. No CSS framework — hand-rolled CSS variables in `src/App.css`.

## Tool-registry contract — how to add a tool

1. Create `src/tools/<tool-id>/index.js`. Export a default object:
   ```js
   export default {
     id: 'my-tool',              // URL slug, unique
     name: 'My Tool',            // sidebar label
     category: null,             // or a string to group with siblings under a collapsible
     description: 'One sentence.',
     // EITHER (transform-tool shape — auto-rendered via ToolWorkbench):
     inputLabel: 'Paste here',
     inputPlaceholder: '...',
     outputLabel: 'Result',
     outputPlaceholder: '...',
     transform: (input) => '...',   // pure fn, throws on invalid input
     // OR (rich-tool shape — bring your own UI):
     component: MyToolComponent,
   };
   ```
2. Add the import + array entry to `src/tools/registry.js`.
3. Done — it appears in the sidebar and at `/#/tool/<tool-id>`.

**Transform-tools must throw on invalid input.** `ToolWorkbench` catches the throw and clears the output. Don't return error strings into the output panel.

**Rich-tools** get the whole `<main>` and can use the toast (`useToast`) and current-draft (`useCurrentDraft`) hooks. They render their own input/output UI. Keep CSS scoped to the tool folder.

## Current Draft buffer

The header strip above every tool is the **Current Draft Bar**. It's a localStorage-backed cross-tool buffer for article-shaped HTML. Tools that consume article HTML (link-cleaner, og-checker HTML mode, future heading-auditor / image-audit / publish-checklist) should:

- Read via `const { draft, setDraft, clearDraft } = useCurrentDraft();`
- Offer a "Load from current draft" button when the user has HTML pasted-or-not.
- Auto-save the user's input as the current draft when they hit submit/analyze. The buffer is intended to make "paste once, run many audits" cheap.

`draft` shape: `{ html: string, title: string, wordCount: number, setAt: number } | null`. Title is derived from `<h1>` or `<title>` on save; tools should not trust it as authoritative.

Tools that operate on short snippets (table-beautifier, report-highlights-*) should ignore the buffer.

## Shared HTTP / proxy plumbing

`src/lib/fetchViaProxy.js` is the canonical entry point for any tool that needs to fetch a third-party URL from the browser. It tries the configured Worker first, then falls back through public CORS proxies. It detects bot-challenge interstitials so a 200 with "Just a moment..." doesn't reach the parser.

- `fetchPageHtml(url)` — returns `{ html, finalUrl }` or throws with a human-readable message.
- `fetchStatusChain(url)` — calls the Worker in `mode=head` mode, returns `{ chain, finalUrl, finalStatus }`. Falls back to a single GET if the worker isn't configured.
- `detectBotChallenge(html)` — pattern-matches Cloudflare / AWS WAF / PerimeterX / Akamai / hCaptcha challenge pages. Returns a label or null.

Engines that need to parse HTML (og-checker's `parseMetaTags`) should import only the parse functions from their own `engine.js`. Fetch logic belongs in `src/lib/`.

## Worker (`worker/index.js`)

One deployed worker, multiple modes. Default mode is unchanged from its original `og-fetch` behavior, so existing tools keep working.

- `GET /?url=<encoded>` — default `mode=raw`. Rotates social-crawler user-agents, returns the page HTML. Optional `INSPECTOR_KEY` env var sends `X-Inspector-Key` for site-owner paired bypass.
- `GET /?url=<encoded>&mode=head` — returns JSON `{ chain: [{url,status,location}], finalUrl, finalStatus }`. Walks up to 10 redirects. For redirect-chain / status-check tools.

Don't rename the deployed worker (`name = "og-fetch"` in `wrangler.toml`) without coordinating an env-var change. Add modes additively.

## Conventions
- File naming: components are PascalCase `.jsx`; engines/transforms/utils are kebab-case or camelCase `.js`. Tool folders are kebab-case.
- CSS: variables live in `src/App.css`. Toolkit UI follows the ammo.com brand: dark backgrounds (`#1E1E1E` containers, `#111111` page), **gold is the PRIMARY action color** (`#BF9400` / `#D4A017`), red is SECONDARY/destructive (`#99161D`), white text on dark. Roboto is the brand typeface (loaded via Google Fonts). Use the red label-chip pattern (white bold text on red rectangle) for section/category labels — mirrors the brand guide and the ammo.com site. Avoid blue on dark backgrounds except for info status. See AC Brand Style Guide for full rules.
- Errors: throw `Error` with a user-readable `message`. The toast layer surfaces it.
- Tests: colocate as `*.test.js` beside the file under test. Engine logic gets unit tests; React components only when they have non-trivial state.
- Imports: relative paths, no path aliases configured. Keep imports shallow — if a tool needs >3 levels of `../`, the shared code probably belongs in `src/lib/` or `src/components/`.
- No client-side analytics, no auth, no backend. Everything is either pure-browser or routes through the worker.

## Env vars

See `env.example`.
- `VITE_CRAWLER_PROXY_URL` — canonical name for the Worker URL (preferred).
- `VITE_OG_PROXY_URL` — legacy name; still honored as fallback for backward compatibility.

If neither is set, fetch-using tools fall back to public CORS proxies (lower success rate against CF-protected sites).

## Where to pick up next

See `ROADMAP.md` at the repo root. Weeks 1–2 (infrastructure) shipped; Weeks 3+ are scoped per tool.
