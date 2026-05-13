# SEO Army Knife — Roadmap

Where we've been, where we're going, and where to pick up. Working agreement: SEO Army Knife is the central console for the editorial pipeline behind ammo.com. New work should answer **"does this save the SEO 5–30 minutes per article, per week, or per audit cycle?"** before it ships.

Phases below are calendar-loose — they're sequencing, not deadlines.

---

## ✅ Weeks 1–2 — Infrastructure (SHIPPED)

The connective tissue that makes every future tool cheaper to build.

- **`CLAUDE.md`** — agent-facing guide: stack, tool-registry contract, draft buffer, shared HTTP, conventions.
- **`README.md`** — replaced the Vite stock template with a real project README + the add-a-tool recipe.
- **`src/lib/fetchViaProxy.js`** — extracted shared HTTP / proxy-failover / bot-challenge detection out of og-checker. Now reusable by every tool that fetches third-party URLs. Adds `fetchStatusChain(url)` for the upcoming redirect-chain tools.
- **Worker generalization** — `worker/index.js` now supports `?mode=raw` (default) and `?mode=head` (status + redirect chain). Additive, non-breaking; the deployed worker keeps its `og-fetch` name in `wrangler.toml` to avoid coordinated env-var churn. `VITE_CRAWLER_PROXY_URL` is the new canonical env var; `VITE_OG_PROXY_URL` is still honored.
- **Current Draft buffer** — `CurrentDraftContext` + `useCurrentDraft()` + the `CurrentDraftBar` strip above every tool. Article-scoped, localStorage-backed. OG Checker (HTML mode) and Link Cleaner both auto-save on submit and offer a "Load from current draft" button.

## ✅ Brand pass — ammo.com identity (SHIPPED)

Chrome dressed in the AC Brand Style Guide; tool internals inherit via shared CSS vars.

- **Palette** — Revolutionary Black backdrop ramp (gray 75–500), **gold #bf9400 as PRIMARY** action color (hover #d4a017), red #99161d as SECONDARY/label-chip, light-grey text on dark. Variables live in `src/App.css` so future tools follow automatically.
- **Logo** — inline `<AmmoShieldIcon>` in `src/components/icons.jsx` (chevron variant, brand-guide-approved for nav at ≥16px). No external image dep.
- **Wordmark** — red `<span class="brand-chip">SEO</span>` next to "Army Knife" in Roboto Light. The `.brand-chip` utility class (defined in `App.css`) is the reusable label-chip pattern for any future section/category tag.
- **Typography** — Roboto loaded via Google Fonts in `index.html` (300/400/500/700 weights). Heading sizes follow the brand guide (H1 Light 48px, H2 Light 34px, etc.).
- **Animations** — pure CSS keyframes (`sak-fade-in`, `sak-fade-up`, `sak-slide-down`, `sak-shimmer`, `sak-pulse-gold`) defined globally in `App.css`. `ToolPage` re-keys on `tool.id` so each route change plays the fade-up entrance. Sidebar nav has a sliding gold edge accent on hover/active. `prefers-reduced-motion` collapses every animation to 0.01ms. Zero new runtime deps — bundle held at 90 KB JS / 7 KB CSS gzipped (vs. ~140 KB the GSAP option would have cost).
- **Audit hygiene** — `npm audit` reports **0 vulnerabilities** (was 2 moderate + 3 high; all dev/build-time deps, patched without `--force`).

The brand convention in `CLAUDE.md` was inverted in this pass: previously *"never apply ammo.com's dark/gold/red to the toolkit chrome"*; now *"toolkit chrome IS the ammo.com brand."* New tools should default to the dark surfaces + gold primary + red secondary pattern.

---

## ▶ Weeks 3–4 — SERP Snippet Preview + Schema Markup Generator

The two highest-ROI tools — both ship on Week 1 infrastructure.

### SERP Snippet Preview
**Folder:** `src/tools/serp-preview/`
**Shape:** rich tool (custom component).
**Why:** SEOs publish for blue links in Google before they publish for OG. Google truncates by **pixel width**, not character count. None of the free previewers handle the date-prefix tax or mobile vs desktop pixel budget correctly.

**Inputs:**
- Title, meta description, URL (form fields), OR
- Paste raw HTML / fetch URL via worker → auto-extract title + meta + canonical.

**Outputs:**
- Side-by-side desktop + mobile snippet preview using Arial in correct sizes.
- Live pixel-width meter showing where Google will likely truncate.
- Toggle: "fresh article" (prepends `Mon DD, YYYY — ` and re-measures).
- Toggle: "auto-append brand suffix" (` | Ammo.com` etc.) — warns if it pushes title past pixel budget.
- "Compare 3 variants" mode for A/B testing titles.

**Implementation notes:**
- Pixel measurement via a hidden DOM span with `getBoundingClientRect()`. Arial 20px (desktop title), Arial 14px (snippet).
- Mobile target: ~360px content width; desktop: ~600px.
- Hooks into `useCurrentDraft()` for "Load from current draft" — extracts `<title>` + `<meta name=description>` via DOMParser.
- Hooks into `fetchPageHtml` (already in `src/lib/`) for URL-mode.

### Schema Markup Generator
**Folder:** `src/tools/schema-generator/`
**Shape:** rich tool with article-type tabs.
**Why:** Rich results take 2–4× SERP real estate. For comparison and ballistics articles, FAQPage rich results are the single highest CTR lever available without backlinks.

**Article-type playbook** (one tab per type):

| Tab | Required | Optional |
|---|---|---|
| Ballistics | `Article` + `BreadcrumbList` | `FAQPage`, `Table` |
| Comparison | `Article` + `BreadcrumbList` | `FAQPage`, `ItemList` for popular loads |
| Data study | `Article` + `BreadcrumbList` | `Dataset` (eligible for Google Dataset Search) |
| Best-of | `Article` + `ItemList` | `Product` per item (price/rating/availability) |
| Category page | `CollectionPage` + `BreadcrumbList` | `ItemList` |

**Per-tab features:**
- Form fields (title, author, date, hero image, etc.) → outputs validated JSON-LD block.
- **Auto-extract from current draft** — detect FAQ-shaped content (`<h3>Q?</h3><p>A.</p>` or `<details><summary>`); detect numbered product lists; pre-fill the form.
- Validation against Google's **required + recommended** properties (not just schema.org spec — Google rejects "valid but incomplete" markup silently).
- "Test in Google" deep-link to `https://search.google.com/test/rich-results`.
- Copy as `<script type="application/ld+json">` block ready to paste in `<head>`.

---

## ▶ Weeks 5–6 — Heading Outline Auditor + Image Audit

Both pure-browser, both read from `useCurrentDraft()`, both feed the Publish Checklist (week 7).

### Heading Outline Auditor — `src/tools/heading-auditor/`
- Parse pasted/loaded HTML → render H1–H6 tree.
- Flag: multiple H1s, skipped levels (H2 → H4), empty headings, headings inside `<a>`, duplicate H2 text, headings >70 chars.
- One-click "promote/demote" + "fix levels" for the easy cases (rewrite tags, return patched HTML).
- Output: clean HTML + per-issue annotated tree.

### Image Audit — `src/tools/image-audit/`
- Parse pasted/loaded HTML → table of every `<img>`: `src`, alt, width/height, computed-from-filename quality score.
- Flag: missing/short alts, missing dimensions, http (not https), non-descriptive filenames (`IMG_8723.jpg` vs `300-blackout-vs-556.jpg`), duplicate alts.
- Bulk-edit alt text in-place; re-render the patched HTML.
- Optional: fetch image headers via worker to flag oversized files (>300KB warning, >1MB error).

---

## ▶ Weeks 7–8 — Publish Checklist (the composite)

**This is where SAK goes from "useful" to "I can't publish without it."**

**Folder:** `src/tools/publish-checklist/`
**Shape:** composite — reads the current draft, runs every relevant audit, renders a scorecard.

**Rows:**
- Title length (Google desktop / mobile / OG) — green/amber/red
- Meta description length
- JSON-LD valid (Article + BreadcrumbList minimum; per article type the matching FAQPage / ItemList)
- Heading outline clean
- All `<img>` have alts + dimensions + https + descriptive filenames
- No redundant links
- Internal links all return 200 (uses worker `mode=head`)
- Word count meets minimum for article type
- Reading level appropriate (Flesch–Kincaid)

**Behavior:**
- Each row green/amber/red, click → jump to the relevant tool with the draft prefilled.
- "Copy final clean HTML" button at the bottom that bundles fixes from heading-auditor + image-audit + link-cleaner.
- Per-article-type minimum word counts configurable in a small constants file.

**Dependencies:** every Tier 2 tool above must exist first. This is the integration layer, not new logic.

---

## ▶ Weeks 9–10 — Redirect Chain Analyzer + Bulk Status Checker

Both lean on the worker's `mode=head` (already shipped).

### Redirect Chain Analyzer — `src/tools/redirect-chain/`
- Paste URL(s) → table per URL: hop count, every status + URL in the chain, mixed-content flag.
- Highlights chains ≥3 hops (PageRank bleed).
- CSV export.

### Bulk Status Checker — `src/tools/bulk-status/`
- Paste up to 200 URLs → grouped buckets: 200 / 3xx / 404 / 410 / 5xx / timeout.
- Worker rate-limit-aware (10 concurrent, queued).
- "Replace these in current draft" — auto-rewrite the draft to drop the dead links (using link-cleaner's anchor-stamping internals).

---

## ▶ Weeks 11–12 — Internal Link Suggester

**Highest leverage tool, built last because it benefits from everything above.**

**Folder:** `src/tools/link-suggester/`

**Inputs:**
1. Article HTML (current draft).
2. Site corpus — three accepted shapes:
   - Sitemap URL (worker fetches + parses; cache titles/H1s with 1h TTL).
   - Pasted CSV (`URL, Title, H1, Primary Keyword`).
   - Pasted URL list (worker fetches each in parallel, caches).

**Ranking signals** (blend, don't single-source):
- **A. Anchor opportunity scan** (highest precision) — n-grams in article that exactly match candidate title/H1.
- **B. Entity match** — cartridge/brand/projectile dictionary; entity overlap per paragraph.
- **C. TF-IDF / BM25 paragraph similarity** — fallback signal when A and B don't fire.
- **D. Hub-spoke topology** — ballistics article should preferentially link to sibling ballistics articles + parent category + comparisons featuring the cartridge.
- **E. Existing-link suppression** — reuse link-cleaner's URL normalization to dedupe.
- **F. Over-linking guard** — cap per paragraph (default 1), per topical cluster (default 2), skip first paragraph by default.

**UI:**
- Left pane: article HTML.
- Right pane: per-paragraph table of `(URL, anchor candidate, confidence %, reason chip)`.
- Click row → injects `<a>` at insertion point.
- "Apply all ≥85%" bulk button.
- Output: patched HTML + diff of inserted links.

**Phase 2** (optional, cheap): Claude tiebreaker for 50–75% confidence — `"Rate 0–10 how naturally this link reads here, one sentence reason."`

---

## Second 90 days — Briefing Generator & Refresh Audit

Higher-leverage than most individual tools, but they require the foundation above.

### Briefing Generator — `src/tools/briefing/`
**Reverse-direction tool.** Input: target keyword + top-3 competitor URLs. Worker fetches competitors, extracts headings + word counts + entities. Output: a brief listing average word count, common H2 topics, unique H2 topics per competitor (gap analysis), common cited entities, internal/external link patterns, common FAQs. Replaces ~30 min of manual competitor research per article.

### Refresh Audit — `src/tools/refresh-audit/`
For the `ac-update-audit-crawl` workflow. Input: old URL + new draft. Tool fetches old, diffs against new: title changed, H1 changed, word count delta, **keywords lost** (entities in old missing in new), **internal links removed** (and where they were going), schema added/removed, meta description changed. Sanity-check before re-publishing — catches the "I rewrote the article and accidentally dropped the section that was ranking" disaster.

---

## Cross-cutting capabilities (apply to every tool as they grow)

Not features — infrastructure. Build these incrementally; don't block tool work on them.

1. **CSV in / CSV out.** Every tool that produces a report ships a "Download CSV" button. Every tool that takes one URL accepts a pasted column and runs in bulk.
2. **Saved runs / named snapshots.** `localStorage` keyed by tool + label. Re-run later → diff against the snapshot. Turns the toolkit into an audit-over-time system.
3. **Diff mode.** Any tool that takes one input optionally takes two and shows what differs.
4. **Magento hook** (optional, later). If the site exposes a product feed or read-access, link-suggester + image-audit pull live data. Design the abstraction so it can plug in without rewriting tools.
5. **Browser extension shell** (bigger lift). Same tools packaged as a "Run on this page" right-click menu in Chrome. Worth scoping after 8–10 tools exist in the SPA.

---

## Followups flagged during Weeks 1–2

Small, not blocking new tools, worth addressing opportunistically:

- **TypeScript migration.** Link-cleaner's `links`/`groups`/`keepMap` shape-heavy code is the natural starting point.
- **CI workflow audit.** `.github/workflows/` exists — verify it runs `npm test` + `npm run lint` + `npm run build` on PRs.
- **Tighten standalone-tool descriptions.** OG-checker and link-cleaner have two-paragraph descriptions in their `index.js`; report-highlights' are crisp one-liners. Bring everything to one-sentence-in-sidebar, detail-in-tool-body.
- **Brand-guide pages 21+** (Imagery, Icon Usage, Website Assets, Social Media) weren't read during the brand pass. If they tighten conventions further (button radii, icon-padding rules), fold them in next session.
- **Worker rename to `crawler-proxy`.** Currently deferred — do this when there's a coordinated reason (e.g. a new Wrangler project, or env-var migration is already happening).

---

## Where to pick up next

**Start week 3 here:**

1. Re-read `CLAUDE.md` for the tool-registry contract.
2. `mkdir src/tools/serp-preview/`, scaffold `index.js` + `SerpPreview.jsx`.
3. Use `useCurrentDraft()` for "Load from current draft" — DOMParser the HTML, pull `<title>` and `<meta name=description>`.
4. Pixel-width measurement: hidden span with `font: bold 20px Arial` (desktop title) / `font: normal 14px Arial` (snippet); compare `offsetWidth` against ~600px (desktop) / ~360px (mobile).
5. Ship the URL-mode second — wires through `fetchPageHtml` from `src/lib/`.

Schema generator follows the same shape: form per tab, validated JSON-LD output, "Load from current draft" pre-fills fields by DOMParser-ing the article.
