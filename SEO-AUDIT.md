# SEO Audit — Ramalho Apartments

> **STATUS — updated 9 August 2026, after implementation.**
> Every Tier 1 (invisible) finding below has been implemented and verified across
> 8 commits on branch `seo-implementation`. One visible change was made with prior
> approval (the nav highlight, H-4/M-12). Findings that remain open are marked
> **OPEN** in the tables and summarised in the status section at the end of this file.
> Re-run the automated checks any time with `npm run verify`.

**Site:** https://ramalhoapartments.com
**Date:** 9 August 2026
**Audited commit:** `c502b1c` (branch `main`, clean tree)
**Scope:** Read-only reconnaissance. Nothing in the repository was modified.

---

## 0. Method and what was actually verified

Everything below is verified against files in this repo, against a local production build (`npm run build`, 20 pages, exit 0), or against live HTTP responses from the origin. Where I could not verify something, I say so.

- Repo read in full: `astro.config.mjs`, all 14 page routes, 3 layouts, 9 components, the i18n modules, `global.css`, the deploy workflow, `public/`.
- Local build produced `dist/` with 20 HTML files. I parsed every one of them for title, description, canonical, `lang`, OG/Twitter tags, hreflang, JSON-LD, heading tree, image `alt` coverage and internal links.
- The local build is representative of production: I diffed the `<head>` of the live homepage against `dist/index.html` and they match tag for tag.
- Live redirect behaviour probed across 15 scheme/host/trailing-slash combinations with `curl`.

---

## 1. Priority investigation — the redirect failure

### Verdict

**The report is real, the cause is server-side, and it is not in this repository.**

Every non-root URL emits a **cross-protocol redirect**: a request over HTTPS is answered with a `301` whose `Location` is an **`http://`** URL. A second hop (Caddy) then upgrades it back to HTTPS. For an ordinary browser this is an invisible 2-hop detour. For any client that re-canonicalises the redirect target — which is standard behaviour in SEO crawlers and many bot fetchers — it is an **infinite loop**.

### Evidence

The origin stack is **Caddy (TLS termination) → nginx 1.31.0 (static file server)**, confirmed by response headers:

```
$ curl -sSIL https://ramalhoapartments.com/properties

HTTP/2 301
location: http://ramalhoapartments.com/properties/     ← nginx, scheme downgraded to http
server: nginx/1.31.0
via: 1.1 Caddy

HTTP/1.1 308 Permanent Redirect
Location: https://ramalhoapartments.com/properties/    ← Caddy upgrades it back
Server: Caddy

HTTP/2 200
server: nginx/1.31.0
```

This affects **every** non-root path. Same signature on `/ramalho`, `/pt/ramalho`, `/faq`, `/blog`, `/pt`, and on the `www.` host.

**Root cause:** nginx serves `/properties/index.html` and issues its standard "add the trailing slash" directory redirect. It builds that redirect as an absolute URL using `$scheme`, and because the Caddy→nginx hop is plain HTTP internally, `$scheme` is `http`. nginx is not consulting `X-Forwarded-Proto` — I confirmed this directly:

```
$ curl -sSI -H "X-Forwarded-Proto: https" https://ramalhoapartments.com/properties
HTTP/2 301
location: http://ramalhoapartments.com/properties/     ← header ignored
```

**Loop reproduction.** A crawler that forces HTTPS and strips trailing slashes during URL normalisation — a very common default — never terminates:

```
hop 1: https://ramalhoapartments.com/properties -> 301 http://ramalhoapartments.com/properties/
hop 2: https://ramalhoapartments.com/properties -> 301 http://ramalhoapartments.com/properties/
hop 3: https://ramalhoapartments.com/properties -> 301 http://ramalhoapartments.com/properties/
... (identical to hop 20)
```

That is `ERR_TOO_MANY_REDIRECTS`. The root URL is exempt because `/` is already a directory and needs no slash-appending redirect — which is exactly the pattern the external crawl reported.

**Honest caveat:** I could not make plain `curl -L` loop from this machine, because curl follows the `http://` target literally and Caddy resolves it in one hop. The loop requires the client to re-apply its own normalisation. So the failure is client-dependent, not universal — but it is triggered by the most common crawler configuration, and the cross-protocol 301 is wrong regardless of which client hits it.

### Ruled out

| Suspected cause | Finding |
|---|---|
| `trailingSlash` config | Not set in `astro.config.mjs` → Astro default `'ignore'`. Not the cause. |
| `build.format` | Not set → default `'directory'`, emits `/properties/index.html`. Correct and normal. |
| `_redirects` / `_headers` | Do not exist. `public/` contains only `CNAME`, `favicon.ico`, `favicon.svg`. |
| Meta-refresh or JS redirect | None. `grep` across all layouts, pages and components finds no `http-equiv="refresh"` and no `location.href =` / `location.replace`. The PT language switcher is a plain `<a href>` ([Layout.astro:71](src/layouts/Layout.astro#L71)). |
| Cloudflare or another proxy | No Cloudflare. `via: 1.1 Caddy` and `server: nginx/1.31.0` on every response; no `cf-*` headers. |
| GitHub Pages | **The site is not on GitHub Pages.** [deploy.yml](.github/workflows/deploy.yml) SSHes into a VPS, runs `git pull && npm install && npm run build`, then `docker-compose restart`. `public/CNAME` is a leftover from the old Pages setup and is now inert. |

### Two further server-side defects found while investigating

**a) `www.` is a full duplicate of the site.** `https://www.ramalhoapartments.com/` returns `200`, not a redirect. The entire site is reachable on two hostnames with no canonicalisation at the HTTP layer. The `<link rel="canonical">` tags all point at the apex, which limits the damage, but it doubles crawl budget and splits any links pointing at `www`.

**b) No HSTS.** `strict-transport-security` is absent from every response. With HSTS the `http://` hop in the redirect chain would be upgraded client-side before a request was ever made, which would have masked this bug — and, more importantly, HSTS is standard hardening for a site that takes booking enquiries.

### The fix (not in this repo — needs VPS access)

The nginx config and `docker-compose.yml` live at `/srv/ramalho-apartments` on the VPS and are **not** version-controlled here. I could not read them. The one-line fix in the nginx `server` block:

```nginx
absolute_redirect off;   # emit "Location: /properties/" instead of "Location: http://host/properties/"
```

A relative `Location` inherits the request's scheme and host, so the loop cannot form and the chain drops from 3 hops to 2 (and to 1 once internal links carry trailing slashes — see §3, C-4).

Alongside it, in Caddy:

```
www.ramalhoapartments.com {
    redir https://ramalhoapartments.com{uri} permanent
}
ramalhoapartments.com {
    header Strict-Transport-Security "max-age=31536000; includeSubDomains"
    # ... existing reverse_proxy
}
```

**Recommendation:** commit the nginx conf and `docker-compose.yml` into this repo (e.g. `deploy/`) so server behaviour is reviewable and this class of bug is catchable in code review. I have not done this — it needs your VPS access.

---

## 2. Repository and build reconnaissance

### Stack

| Item | Value |
|---|---|
| Astro | `^6.2.1` (`output: 'static'`) |
| Integrations | `@astrojs/mdx`, `@astrojs/sitemap` |
| Styling | Tailwind v4 via `@tailwindcss/vite` — **but see note below** |
| Images | `sharp ^0.34.3`, `astro:assets` `<Image>` on real pages; raw `<img>` for the 5 remote Unsplash images on `/guide/` |
| Node | `>=22.12.0` |
| Deploy | GitHub Action → SSH → VPS → `docker-compose restart` |

**Tailwind is installed but effectively unused.** `@tailwindcss/vite` is wired into `astro.config.mjs`, but `global.css` contains no `@import "tailwindcss"` and no page uses a Tailwind utility class — all styling is hand-written CSS plus inline `style=""` attributes. This is dead build weight. I have not touched it; flagged as an opportunity only.

### Astro config ([astro.config.mjs](astro.config.mjs))

```js
site: 'https://ramalhoapartments.com'
output: 'static'
i18n: { defaultLocale: 'en', locales: ['en','pt'], routing: { prefixDefaultLocale: false } }
sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en-GB', pt: 'pt-PT' } } })
fonts: [ Atkinson via fontProviders.local() ]
// trailingSlash: NOT SET  → 'ignore'
// build.format: NOT SET   → 'directory'
```

Astro's `i18n` block is declared but the routing is not actually driven by it — PT pages are **hand-duplicated files** under `src/pages/pt/`, each hardcoding `const locale = 'pt'`. There is no `[lang]` dynamic route and no content collection for pages. This is why the two locales have drifted out of sync (see C-1).

### Route tree

| EN route | PT equivalent | Status |
|---|---|---|
| `/` | `/pt/` | paired |
| `/properties/` | `/pt/properties/` | paired |
| `/ramalho/` | `/pt/ramalho/` | paired |
| `/amorim/` | `/pt/amorim/` | paired |
| `/amorim-duplex/` | `/pt/amorim-duplex/` | paired |
| `/about/` | `/pt/about/` | paired |
| `/faq/` | — | **EN only** |
| `/guide/` | — | **EN only** |
| `/blog/` + 5 posts | — | **EN only, and it is Astro starter template content** |
| `/rss.xml` | — | template leftover |

### How `<head>` is assembled

There are **two competing head implementations**, and neither is complete:

1. **[Layout.astro:35-51](src/layouts/Layout.astro#L35-L51)** — inline `<head>`, used by all 14 real pages. Emits title, description, viewport, theme-color, favicon, canonical, 3× hreflang, `og:title`/`og:description`/`og:type`, and two `preconnect`s. **No `og:image`, no `og:url`, no `og:site_name`, no `og:locale`, no Twitter tags, no JSON-LD.**
2. **[BaseHead.astro](src/components/BaseHead.astro)** — the Astro starter component, used only by the 6 blog pages. Ironically it is the *more* complete of the two: it has `og:image`, `og:url` and a full Twitter card. It also imports `SITE_TITLE = 'Astro Blog'` from [consts.ts:4](src/consts.ts#L4).

No shared SEO component exists. Metadata is passed page-by-page as `title`/`description` props, sourced from [i18n/ui.ts](src/i18n/ui.ts) or [i18n/properties.ts](src/i18n/properties.ts), with three pages hardcoding their strings inline.

### Property data model

Hardcoded TypeScript object in [src/i18n/properties.ts](src/i18n/properties.ts), keyed `[locale][slug]`, `as const`. Contains name, description, specs string, tagline (street address), price, amenity list with emoji, highlights, badge. **This is the right place to hang structured-data fields** — it is already bilingual and typed.

Two data inconsistencies worth noting:

- **Amorim T2 outdoor space is described three ways.** `description` says "private balcony" ([properties.ts:33](src/i18n/properties.ts#L33)), `about_p1` says "private patio" ([:40](src/i18n/properties.ts#L40)), `highlights` says "Private patio" ([:52](src/i18n/properties.ts#L52)), and `amenities` says "Private balcony" ([:49](src/i18n/properties.ts#L49)). One of these is wrong; I need to know which before it goes into `amenityFeature`.
- **`specs` claims "2 beds · up to 6 guests"** for both Amorim units. Two beds sleeping six implies sofa beds or bunks that aren't itemised. `numberOfBeds` in schema needs the real count.

### Images

| Location | Count | Notes |
|---|---|---|
| `src/assets/properties/ramalho/` | 14 | `IMG_5767.jpeg`, `IMG_3023 (1).JPG`, `20190524_180411.jpg` — camera-roll names, one with parentheses and a space |
| `src/assets/properties/amorim/` | 4 | `Screenshot 2026-05-03 145515.png` — **spaces in filenames** |
| `src/assets/properties/duplex/` | 8 | same screenshot naming |
| `src/assets/images/` | 3 | `header 2026-05-03_200655.jpg` (**space**), `Presentation1.png`, a Pexels stock file |
| `src/assets/blog-placeholder-*.jpg` | 6 | starter template |

The spaces survive into production URLs: `/_astro/header%202026-05-03_200655.CVbMPKvI_Z1Xp1ol.webp`. Not fatal, but it is a filename-as-URL smell and gives up a free relevance signal.

### `public/`

| File | Status |
|---|---|
| `robots.txt` | **Missing.** Live `/robots.txt` returns **404**. |
| `sitemap-index.xml` | Generated by the integration. Live: 200. |
| `_headers` / `_redirects` | Do not exist (and would be ignored — nginx, not Netlify/Pages). |
| `CNAME` | Present, contains `ramalhoapartments.com`. Inert since the move off GitHub Pages. |
| `llms.txt` | Missing. |

---

## 3. Severity-ranked issues

### CRITICAL

| # | Issue | Evidence | User impact | Search impact | Fix complexity |
|---|---|---|---|---|---|
| **C-1** | **`hreflang` points at two URLs that 404.** `/faq/` declares `hreflang="pt" → /pt/faq/` and `/guide/` declares `→ /pt/guide/`. Neither page exists; both return 404 live. | [Layout.astro:47](src/layouts/Layout.astro#L47) unconditionally emits an alternate for every page; no PT `faq`/`guide` in `src/pages/pt/`. Verified: `curl /pt/faq/` → 404. | None directly | Google treats a broken return-link as an invalid annotation. Invalid entries can cause the **whole hreflang cluster to be discarded**, not just the broken pair — so this risks the 6 correctly-paired routes too. | Low |
| **C-2** | **Cross-protocol redirect on every non-root URL** — HTTPS request answered with an `http://` `Location`. Loops for crawlers that re-canonicalise. | §1 above. Reproduced on 6 paths, both hosts. | Extra RTT on every internal navigation | Breaks AI crawlers, link-preview bots and SEO tooling; wastes crawl budget on every URL. | Low fix, **but requires VPS access — not fixable from this repo** |
| **C-3** | **Zero structured data on the entire site.** 0 JSON-LD blocks across all 20 pages. | `grep 'application/ld+json' dist/**/*.html` → 0 hits on the 14 real pages. | None | No entity understanding, no rich results eligibility, no local-pack signals, nothing for AI assistants to extract. For a lodging business this is the single biggest missed category. | Medium |
| **C-4** | **No `og:image` anywhere on the real site.** Every link shared on WhatsApp, Messenger, iMessage, Slack or X previews as a blank box. | [Layout.astro:42-44](src/layouts/Layout.astro#L42-L44) emits only `og:title`/`description`/`type`. Confirmed absent in all 14 real pages of `dist/`. | **Direct revenue impact** — the business books via WhatsApp, and every shared link looks broken | Weak social signal; no image in AI/SERP previews that use OG. | Medium (needs asset generation) |

### HIGH

| # | Issue | Evidence | User impact | Search impact | Fix complexity |
|---|---|---|---|---|---|
| **H-1** | **Astro starter blog is live and indexable.** `/blog/` titled "Astro Blog", description "Welcome to my website!", posts titled "First post" with body "Lorem ipsum dolor sit amet". All 6 are in the sitemap. | [consts.ts:4-5](src/consts.ts#L4-L5); `dist/blog/*/index.html`; sitemap contains all 6. Live `/blog/` → 200, `<title>Astro Blog</title>`. | Anyone landing here sees placeholder junk | Thin/boilerplate content on a commercial domain; dilutes topical focus; wastes crawl budget; "Lorem ipsum" is a textbook low-quality signal. | Low |
| **H-2** | **EN homepage `hreflang` points to a redirecting URL.** `/` emits `hreflang="pt" href=".../pt"` (no slash) while `/pt/`'s own canonical is `.../pt/`. | [i18n/utils.ts:19](src/i18n/utils.ts#L19) — `` `/pt${stripped === '/' ? '' : stripped}` `` returns `/pt`. Confirmed in `dist/index.html`. | None | Non-reciprocal annotation on the site's most important page; the target also fires the C-2 redirect chain. | Low |
| **H-3** | **`hreflang` values disagree with the sitemap.** HTML says `en` / `pt`; the sitemap says `en-GB` / `pt-PT`. | `Layout.astro:46-47` vs `astro.config.mjs` sitemap `i18n`. Both present in build output. | None | Conflicting signals from two sources Google reads for the same thing. | Low |
| **H-4** | **Every internal link omits the trailing slash** while every served URL has one — so each click triggers the C-2 chain. | Header/footer/nav emit `/properties`, `/about`, `/ramalho` ([Layout.astro:64-66](src/layouts/Layout.astro#L64-L66), [Footer.astro:39-47](src/components/Footer.astro#L39-L47)); `dist/` serves `/properties/`. | Slower navigation, 2 wasted round-trips per click | PageRank passed through 301s; crawl budget burned; internal links look like they point to redirects. | Low — **but see the visual-change warning in §5** |
| **H-5** | **`global.css` hotlinks Google Fonts.** Line 1 is `@import url('https://fonts.googleapis.com/css2?family=Inter...')` — a render-blocking third-party import at the head of the main stylesheet. | [global.css:1](src/styles/global.css#L1) | LCP/FCP delayed by a 3-request chain: HTML → CSS → Google CSS → woff2 | Core Web Vitals drag on every page. Also a **GDPR exposure** — hotlinked Google Fonts transmits every visitor's IP to Google, which EU courts and DPAs have ruled unlawful without consent. | Low |
| **H-6** | **`www.` serves a full duplicate of the site with no redirect.** | `curl https://www.ramalhoapartments.com/` → 200, not 301. | Users can land on an inconsistent host | Duplicate content across two hostnames; doubled crawl budget. Canonical tags mitigate but do not resolve. | Low — **VPS-side** |
| **H-7** | **`robots.txt` returns 404**, so there is no `Sitemap:` directive and no crawler policy. | `curl /robots.txt` → 404; no file in `public/`. | None | Sitemap discovery relies solely on Search Console; no ability to steer or exclude any crawler. | Trivial |

### MEDIUM

| # | Issue | Evidence | User impact | Search impact | Fix complexity |
|---|---|---|---|---|---|
| **M-1** | **No Twitter/X card tags** on any real page. | `dist/` — `twitter:*` present only on the 6 blog pages. | Degraded previews on X | Minor. | Trivial |
| **M-2** | **`og:url`, `og:site_name`, `og:locale`, `og:locale:alternate` missing.** | [Layout.astro:42-44](src/layouts/Layout.astro#L42-L44) | Scrapers may resolve the wrong URL | Weaker social entity signal. | Trivial |
| **M-3** | **Duplicate meta descriptions.** `/properties/` reuses the homepage description verbatim; `/pt/properties/` does the same in PT. | [properties.astro:16](src/pages/properties.astro#L16) — `description = t('site.default_description')`. | None | Duplicate descriptions get rewritten by Google; wasted SERP real estate. | Trivial |
| **M-4** | **`<html lang="pt">` should be `pt-PT`.** | [Layout.astro:34](src/layouts/Layout.astro#L34) | Screen readers may select Brazilian Portuguese pronunciation | Weak locale-targeting signal. | Trivial |
| **M-5** | **Descriptions lead with "luxury" / titles with "Premium".** | [ui.ts:4-5](src/i18n/ui.ts#L4-L5), [:150-151](src/i18n/ui.ts#L150-L151) | None | Near-zero search volume for these terms in this market; crowds out "3 bedroom", "T3", "centro", "aeroporto" which are what guests actually type. | Low |
| **M-6** | **Lightbox loads full-resolution originals** — 1.9 MB to 3.7 MB per photo. `img.src` on an Astro `ImageMetadata` is the *unoptimised* asset. | [PropertyLayout.astro:572](src/layouts/PropertyLayout.astro#L572) — `allImages.map(img => img.src)`. `dist/_astro/IMG_5783.DiiFzeo3.jpeg` = 3.74 MB. | Gallery is painful on mobile data — and the gallery is the main conversion surface | INP/loading signals; large useless payload in the crawl. | Medium |
| **M-7** | **Dead `preconnect` hints** to `fonts.googleapis.com` and `fonts.gstatic.com` are emitted on every page — these would be useful for H-5 but become pure waste once the font is self-hosted, and they are currently duplicated effort alongside the `@import`. | [Layout.astro:49-50](src/layouts/Layout.astro#L49-L50) | Two wasted DNS+TLS handshakes | Negligible alone. | Trivial |
| **M-8** | **Hero `<img>` ships a 3.09 MB WebP as its `src` fallback** and declares `width="6000"`. `srcset` caps at 1920w, so modern browsers are fine — but the 3 MB variant is generated and deployed, and any client without `srcset` support downloads it. | `dist/_astro/header 2026-05-03_200655.CVbMPKvI_Z1Xp1ol.webp` = 3,168,336 bytes; [index.astro:57-66](src/pages/index.astro#L57-L66) `widths={[768,1280,1920]}`. | LCP risk on edge cases | CWV. | Low |
| **M-9** | **5 images on `/guide/` are hotlinked from Unsplash**, with `alt` set to just the place name. | [guide.astro:8-12](src/pages/guide.astro#L8-L12) | Third-party dependency for page rendering | No image-SEO benefit; two of the five reuse the same photo for different places, which is factually misleading. | Low |
| **M-10** | **Blog pages have 9 images with no `alt` attribute at all**, and `/blog/markdown-style-guide/` has **two `<h1>`s**. | `dist/blog/index.html` — 5 `<img>` without `alt`; `dist/blog/markdown-style-guide/index.html` — H1 ×2. | Accessibility failure | Moot if H-1 is actioned by removing the blog. | Trivial (or moot) |
| **M-11** | **Desktop and mobile nav duplicate every link's text**, so each page has "Home", "Properties", "About" and "Book now" twice in the DOM. | [Layout.astro:64-66](src/layouts/Layout.astro#L64-L66) and [:90-92](src/layouts/Layout.astro#L90-L92) | None (one is CSS-hidden at any breakpoint) | Harmless for SEO — but the hidden-drawer copy is *not* `display:none`, it is `max-height:0; overflow:hidden`, so it stays in the a11y tree. `aria-hidden` is toggled by JS, so it is correct after hydration but wrong before. | Low |
| **M-12** | **The active-nav-link script never matches**, so the current-page nav highlight is dead code. | [Layout.astro:274](src/layouts/Layout.astro#L274) compares `link.href` (`…/properties`) to `window.location.href` (`…/properties/`). | Users get no "you are here" cue | None. | Low — **but fixing H-4 revives it, which is a visible change. See §5.** |

### OPPORTUNITY

| # | Item | Rationale |
|---|---|---|
| **O-1** | No `/book` or `/pt/reservar` landing page | The whole business model is direct booking, and there is no page targeting it. Highest-value Tier 3 item. |
| **O-2** | RRAL nº2881 absent from the site | Appears on the Airbnb listing but nowhere here. Trust and local-relevance signal, and likely an *Alojamento Local* advertising requirement. |
| **O-3** | No street address in the footer | NAP consistency with Google Business Profile and the OTA listings is foundational local SEO. Footer currently says only "Ponta Delgada, Azores". |
| **O-4** | `/faq/` and `/guide/` exist in EN only | Two content assets with no PT version, and they are the two pages whose hreflang is currently broken (C-1). |
| **O-5** | No analytics of any kind | Zero visibility into which pages drive WhatsApp enquiries. |
| **O-6** | Amorim waitlist is a `mailto:` | No captured list for units opening in ~2 months. |
| **O-7** | Tailwind installed but unused | Dead build dependency. |
| **O-8** | `rss.xml` publishes starter-template posts | Moot once H-1 is resolved. |
| **O-9** | No `llms.txt` | Cheap, and AI assistants are an increasingly real discovery channel for accommodation. |

---

## 4. Per-route audit

All 20 built routes. `desc` shows character count. "int links" counts unique internal destinations.

| URL | `<title>` (len) | Meta description | Canonical | OG | Twitter | hreflang | JSON-LD | H1 | H2 outline | imgs missing `alt` | int links |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Ramalho Apartments \| Premium Stays in Ponta Delgada, Azores (59) | dup of `/properties/` (132) | ✅ `/` | title, description, type — **no image** | ❌ | en→`/`, pt→**`/pt`** (no slash, H-2), x-default→`/` | ❌ | Your home in the Azores | Homes our guests love · Genuine Azorean hospitality, no middlemen · Ready to experience the Azores? | 1 of 5 | 7 |
| `/properties/` | Our Properties – Ramalho Apartments (35) | **dup of `/`** (132) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Three curated apartments in Ponta Delgada | 3 property names · Not sure which apartment is right for you? | 0 of 3 | 7 |
| `/ramalho/` | Ramalho Three Bedroom Apartment – Ramalho Apartments (52) | (101) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Ramalho Three Bedroom Apartment | About this place · What this place offers · Where you'll be | 0 of 6 (1 deliberate `alt=""`) | 7 |
| `/amorim/` | Amorim Two Bedroom Apartment – Ramalho Apartments (49) | (119) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Amorim Two Bedroom Apartment | same 3 | 0 of 5 | 7 |
| `/amorim-duplex/` | Amorim Two Bedroom Duplex – Ramalho Apartments (46) | (116) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Amorim Two Bedroom Duplex | same 3 | 0 of 6 | 7 |
| `/about/` | About – Ramalho Apartments (26) | (87) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | A passion for the Azores and genuine hospitality | Our story · What we stand for · Get in touch · Find us in Ponta Delgada | 0 of 1 | 7 |
| `/faq/` | FAQ – Ramalho Apartments (24) | (94) | ✅ | title, description, type | ❌ | ⛔ **pt→`/pt/faq/` 404s (C-1)** | ❌ | Frequently asked questions | Still have questions? | 0 of 0 | 7 |
| `/guide/` | Local Guide – Ramalho Apartments (32) | (102) | ✅ | title, description, type | ❌ | ⛔ **pt→`/pt/guide/` 404s (C-1)** | ❌ | Ponta Delgada & São Miguel | Must-see spots · Local essentials · Logistics & transport · Questions about your visit? | 0 of 5 (all remote) | 7 |
| `/pt/` | Ramalho Apartments \| Alojamento Premium em Ponta Delgada, Açores (64) | dup of `/pt/properties/` (136) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | A sua casa nos Açores | 3 sections | 1 of 5 | 7 |
| `/pt/properties/` | As Nossas Propriedades – Ramalho Apartments (43) | **dup of `/pt/`** (136) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Três apartamentos selecionados em Ponta Delgada | 3 property names + CTA | 0 of 3 | 7 |
| `/pt/ramalho/` | Apartamento Ramalho T3 – Ramalho Apartments (43) | (102) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Apartamento Ramalho T3 | Sobre este espaço · O que este espaço oferece · Onde vai ficar | 0 of 6 | 7 |
| `/pt/amorim/` | Apartamento Amorim T2 – Ramalho Apartments (42) | (122) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Apartamento Amorim T2 | same 3 | 0 of 5 | 7 |
| `/pt/amorim-duplex/` | Duplex Amorim T2 – Ramalho Apartments (37) | (123) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Duplex Amorim T2 | same 3 | 0 of 6 | 7 |
| `/pt/about/` | Sobre Nós – Ramalho Apartments (30) | (93) | ✅ | title, description, type | ❌ | ✅ reciprocal | ❌ | Uma paixão pelos Açores e pela hospitalidade genuína | 4 sections | 0 of 1 | 7 |
| `/blog/` | **Astro Blog** (10) | **Welcome to my website!** (22) | ✅ | full set incl. image | ✅ full | ❌ none | ❌ | **none — 0 H1** | Astro Blog | **5 of 5** | 11 |
| `/blog/first-post/` | First post (10) | **Lorem ipsum dolor sit amet** | ✅ | full | ✅ | ❌ | ❌ | First post | Astro Blog | **1 of 1** | 6 |
| `/blog/second-post/` | Second post | Lorem ipsum… | ✅ | full | ✅ | ❌ | ❌ | Second post | Astro Blog | **1 of 1** | 6 |
| `/blog/third-post/` | Third post | Lorem ipsum… | ✅ | full | ✅ | ❌ | ❌ | Third post | Astro Blog | **1 of 1** | 6 |
| `/blog/using-mdx/` | Using MDX | Lorem ipsum… | ✅ | full | ✅ | ❌ | ❌ | Using MDX | Astro Blog · Why MDX? · Example · More Links | **1 of 1** | 6 |
| `/blog/markdown-style-guide/` | Markdown Style Guide | Astro syntax sample (103) | ✅ | full | ✅ | ❌ | ❌ | **2 H1s** | 11 H2s of template filler | **1 of 2** | 6 |

### Heading hierarchy — report only, no changes proposed

- Every real page has exactly one `<h1>`. ✅
- No skipped levels on any real page: `/about/` and `/guide/` go H1→H2→H3 correctly. ✅
- `/properties/` uses `<h2>` for each property name inside an `<article>` — semantically correct. ✅
- Property pages: H1 = property name, then three H2s. Correct. ✅
- **Only defects are on the template blog pages** (`/blog/` has zero H1; `/blog/markdown-style-guide/` has two).

### Sitemap contents

20 URLs, one `sitemap-0.xml`. 24 `xhtml:link` alternates.

- Correctly cross-references EN↔PT for the 7 paired routes.
- **Correctly omits alternates for `/faq/` and `/guide/`** — meaning the sitemap already knows there is no PT version, while the HTML claims there is. The two disagree (C-1, H-3).
- **Includes all 6 blog template pages.** No `changefreq`, no `priority`, no `lastmod` on any entry.
- Uses `en-GB` / `pt-PT`; the HTML uses `en` / `pt`.

---

## 5. Build health and Core Web Vitals

Build: **clean, exit 0, no warnings.** 20 pages in 12.07 s; 38 images optimised in 6.85 s.

| Metric | Value | Assessment |
|---|---|---|
| CSS shipped | 12.6 kB + 5.4 kB (unminified-source, built) | Fine |
| JS shipped | **0 bundled JS files** — all scripts are inline `<script>` | Excellent |
| `dist/` total | **49 MB** | Very heavy for 20 pages — dominated by full-size gallery originals (M-6) |
| Largest asset | `IMG_5783.DiiFzeo3.jpeg` — **3.74 MB** | Lightbox original |
| Hero LCP candidate | `srcset` 768/1280/1920 (75 kB / 199 kB / 422 kB) | Reasonable at 1920w |
| Hero `src` fallback | **3.09 MB WebP at 6000×3365** | M-8 |
| `loading` / `fetchpriority` on hero | `eager` + `fetchpriority="high"` | ✅ Correct — **not lazy-loaded** |
| `<link rel="preload" as="image">` for LCP | **Absent** | Low marginal value given `fetchpriority="high"`, but worth adding |
| Font loading | **`@import` to Google Fonts from inside `global.css`** | ❌ H-5 — worst-case pattern: blocks render, third-party, GDPR exposure |
| Local Atkinson font | Configured in `astro.config.mjs`, emitted to `dist/_astro/fonts/` | **Only ever used by the template blog pages.** Dead config for the real site. |
| `preconnect` hints | 2, to Google Fonts | M-7 |
| Google Maps iframes | 1 per property page + 1 on `/about/`, all `loading="lazy"` | ✅ Correctly deferred |

**LCP summary:** the hero is eager + high-priority and correctly sized via `srcset` — that part is right. The real LCP risk is H-5: text cannot paint until a three-hop chain to `fonts.googleapis.com` resolves.

---

## 6. Tier split

### Tier 1 — invisible, implementable now (zero rendered-pixel change)

| Ref | Item |
|---|---|
| C-1 | Make `hreflang` conditional on the alternate route actually existing |
| C-3 | Add JSON-LD `@graph` (site-wide + per-property) |
| C-4 | Add `og:image` (1200×630) + full OG/Twitter tag set |
| H-2 | Fix `getLocaleUrl('/', 'pt')` → `/pt/` |
| H-3 | Align hreflang codes to `en` / `pt-PT` / `x-default` across HTML and sitemap |
| H-5 | Self-host Inter, drop the Google Fonts `@import` |
| H-7 | Add `public/robots.txt` with `Sitemap:` |
| M-1, M-2 | Twitter card; `og:url`, `og:site_name`, `og:locale`, `og:locale:alternate` |
| M-3 | Unique descriptions for `/properties/` and `/pt/properties/` |
| M-4 | `<html lang="pt-PT">` |
| M-5 | Rewrite all titles/descriptions (meta only — no on-page copy) |
| M-7 | Remove the two dead `preconnect`s |
| M-8 | Cap hero `src` fallback |
| M-9 | Fix duplicated/misleading `alt` on `/guide/` images |
| — | Descriptive `alt` on all images, in the page's language |
| — | Rename source image files to descriptive slugs |
| — | Footer social links → real profiles, add `rel="noopener"` |
| — | `<meta name="robots" content="index,follow,max-image-preview:large,…">` |
| — | Sitemap `changefreq`/`priority`; exclude template routes |
| — | `trailingSlash: 'always'` in `astro.config.mjs` |

**Two Tier-1 candidates I am deliberately holding back — they look invisible but are not:**

- **H-4 (trailing slashes on internal links).** The href change itself is invisible. But it revives the dead active-nav script (M-12): `.nav-link.active` would start applying, changing the current page's nav link from `--clr-text-2` to `--clr-text`. That is a real pixel change. **Decision needed** — see `SEO-PLAN.md` §3.6.
- **H-1 (the template blog).** Removing `/blog/` deletes 6 live URLs. Invisible to anyone browsing the real site, but it is a content deletion with redirect implications. **Your call** — see `SEO-PLAN.md` §3.4.

### Tier 2 — touches visible content, needs approval

| Item | Why |
|---|---|
| H1 rewrite: "Your home in the Azores" → something carrying "Ponta Delgada" / "apartments" | Visible copy |
| Adding RRAL nº2881 to the footer | Visible copy |
| Full street address in the footer | Visible copy |
| Waitlist form replacing the Amorim `mailto:` | Visible UI |
| Removing "Premium"/"luxury" from *visible* strings (footer tagline, `/properties/` intro) | Visible copy — distinct from the meta-only rewrite in Tier 1 |
| Fixing the M-6 lightbox to serve optimised images | Behaviour change; image quality in the lightbox would visibly differ |

### Tier 3 — new pages / strategic, needs approval

| Item |
|---|
| `/book` + `/pt/reservar` landing pages |
| PT versions of `/faq/` and `/guide/` |
| FAQ schema + a real FAQ information architecture |
| Area guides / itinerary content programme |
| `/contact`, privacy policy, terms |
| Self-hosted analytics with WhatsApp/email/phone conversion events |
| `public/llms.txt` |
| DE / FR locales |

---

## 7. Information I need from you

Nothing in this list can be inferred safely from the repo. I will not guess or ship placeholders. Items marked **blocking** stop a specific deliverable.

### Blocking — structured data cannot be emitted without these

| # | Need | Why | Notes |
|---|---|---|---|
| 1 | **Full postal address for Rua Rodrigo Rodrigues nº4** — postcode, and floor/door if part of the address | `PostalAddress.postalCode`, `streetAddress` | Repo has street + number only |
| 2 | **Full postal address for Rua do Amorim 15** | same | |
| 3 | **Latitude/longitude for both buildings** | `GeoCoordinates` | The Google Maps embeds use a text query, not coordinates, so nothing usable is stored. Rooftop-accurate values please, not the street centroid |
| 4 | **Legal/registered entity name** | `Organization.name` / `legalName` | "Ramalho Apartments" is the trading name; schema should carry the real one if different |
| 5 | **A logo image file** | `Organization.logo`, and needed for OG images | **There is no logo asset in this repo** — the header logo is CSS-styled text. I need a square PNG/SVG, ideally ≥512×512 |

### Blocking — `sameAs` and the footer link fix

| # | Need | Why |
|---|---|---|
| 6 | **Instagram handle/URL** | Footer currently links to bare `https://www.instagram.com` — a broken link to nothing ([Footer.astro:27](src/components/Footer.astro#L27)) |
| 7 | **Confirm the Facebook URL is `facebook.com/RamalhoApartments`** | You supplied this; I want it confirmed before it ships. Footer currently links to bare `https://www.facebook.com` ([Footer.astro:30](src/components/Footer.astro#L30)) |
| 8 | **Airbnb listing URL(s)** | `sameAs`. Repo has none |
| 9 | **Vrbo listing URL(s)** | `sameAs`. Repo has none |
| 10 | **Booking.com URLs for the two Amorim units**, if they exist yet | Repo has only the Ramalho T3 URL ([index.astro:27](src/pages/index.astro#L27)) |

### Blocking — per-property schema facts

| # | Need | Why |
|---|---|---|
| 11 | **`checkinTime` / `checkoutTime`** | [faq.astro:9](src/pages/faq.astro#L9) says check-in 3 PM, check-out 11 AM — but that is EN-only marketing copy. **Confirm it is accurate and applies to all three units** before I put it in schema |
| 12 | **`petsAllowed`** | FAQ says "generally yes… contact us". Schema needs a boolean. Which is it? |
| 13 | **`smokingAllowed`** | Not stated anywhere in the repo |
| 14 | **`numberOfBeds` — the real bed count** | `specs` says Amorim T2 has "2 beds · up to 6 guests". Two beds cannot sleep six. What is the actual bed inventory per unit (doubles, singles, sofa beds)? |
| 15 | **`numberOfRooms`** (total rooms, not bedrooms) per unit | Not derivable |
| 16 | **`floorSize` in m² per unit** | Optional but valuable. Skip if unknown |
| 17 | **Amorim T2: is the outdoor space a balcony or a patio?** | The repo says both, in four places ([properties.ts:33](src/i18n/properties.ts#L33), [:40](src/i18n/properties.ts#L40), [:49](src/i18n/properties.ts#L49), [:52](src/i18n/properties.ts#L52)). One is wrong and it will end up in `amenityFeature` |
| 18 | **Is parking actually available, and of what kind?** | FAQ claims "designated parking or nearby street parking" but no property's amenity list includes parking. `amenityFeature` needs the truth per unit |
| 19 | **Is €80/night year-round, or a seasonal low?** | Affects whether `Offer.price` or `priceRange` is honest |
| 20 | **Indicative price for the two Amorim units** | Needed for a meaningful pre-launch `Offer`. If unknown, I will omit price rather than guess |
| 21 | **Exact opening date for the Amorim units** | Repo says "October 2026". `availabilityStarts` needs a date. Is 1 October correct? |

### Decisions I need from you

| # | Decision | Options |
|---|---|---|
| 22 | **AI crawler policy** in `robots.txt` (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) | Allow / disallow / selective — trade-off laid out in `SEO-PLAN.md` §3.4 |
| 23 | **The template blog** — delete the 6 pages, `noindex` them, or keep them? | See `SEO-PLAN.md` §3.4 |
| 24 | **The active-nav-link side effect of H-4** | Accept the highlight appearing (visible change), or suppress it to keep pixel parity |
| 25 | **VPS access for the nginx/Caddy fix (C-2, H-6)** | I cannot fix these from this repo. Will you apply them, or should the server config be moved into version control? |
| 26 | **`www` canonical direction** | Redirect `www` → apex (matches current canonical tags and `CNAME`), or the reverse |
| 27 | **Analytics: Plausible or Umami**, and the hostname you will self-host it on | Needed before I can write the script tag |

---



---

## 8. Implementation status — 9 August 2026

Branch `seo-implementation`, 9 commits. `npm run verify` passes on a clean build.

### Done

| Ref | Issue | Commit |
|---|---|---|
| C-1 | Broken `hreflang` to `/pt/faq/` and `/pt/guide/` | phase 2 |
| C-3 | Zero structured data | phase 4 |
| C-4 | No `og:image` anywhere | phase 6 |
| H-1 | Astro starter blog live and indexed | phase 1 |
| H-2 | Homepage `hreflang` pointed at redirecting `/pt` | phase 2 |
| H-3 | `hreflang` codes disagreed with the sitemap | phase 2 |
| H-4 | Internal links missing trailing slashes | phase 8 |
| H-5 | Google Fonts `@import` blocking render | phase 7 |
| H-7 | `robots.txt` 404 | phase 1 |
| M-1, M-2 | Twitter card, `og:url`/`site_name`/`locale` | phase 2 |
| M-3 | Duplicate meta descriptions | phase 3 |
| M-4 | `<html lang="pt">` → `pt-PT` | phase 2 |
| M-5 | "Premium"/"luxury" in metadata | phase 3 |
| M-7 | Dead Google Fonts `preconnect`s | phase 7 |
| M-9 | Misleading `/guide/` image alt | phase 5 |
| M-10 | Blog images with no `alt`, duplicate H1 | phase 1 (pages removed) |
| M-11 | Mobile drawer focusable while hidden | phase 8 (`inert`) |
| M-12 | Active-nav highlight never fired | phase 8 (**approved visible change**) |
| — | Indexed placeholder `alt` on 25 property images | phase 5 |
| — | Two factually wrong `alt` strings | phase 5 |
| — | Sitemap `changefreq`/`priority`, template routes excluded | phase 1 |
| — | Explicit `robots` meta with `max-image-preview:large` | phase 2 |

### Open — not fixable from this repository

| Ref | Issue | Needs |
|---|---|---|
| **C-2** | Cross-protocol `301` on every non-root URL | `absolute_redirect off;` in the nginx server block on the VPS |
| **H-6** | `www.` serves a full duplicate, no redirect | Caddy redirect to the apex |
| — | No HSTS header | Caddy `Strict-Transport-Security` |

### Open — deliberately deferred

| Ref | Issue | Why |
|---|---|---|
| M-6 | Lightbox loads 1.9–3.7 MB originals | Tier 2 — changes gallery image quality, needs approval |
| M-8 | Hero `src` fallback is a 3.09 MB WebP | Only affects clients with no `srcset` support; the font fix was the real LCP lever |
| O-2, O-3 | RRAL number and street address absent | Tier 2 — visible copy |
| O-4 | `/faq/` and `/guide/` are English-only | Tier 3 — needs translation |
| O-5, O-6 | No analytics, `mailto:` waitlist | Tier 3 |
| O-7 | Tailwind installed but unused | Left alone to avoid touching the build |
| O-9 | No `llms.txt` | Tier 3, drafted in `SEO-PLAN.md` §4 |

### Found during implementation, not in the original audit

- **The Amorim and Duplex photos are architectural renders**, not photographs — those units are not yet furnished. Alt text now says so. **Recommendation: label them visibly too.** Presenting renders as room photos to someone deciding whether to book is a fairness problem, not just an SEO one. Tier 2 — your call.
- **`Presentation1.png` was captioned "Our apartments in Ponta Delgada"** but is a collage of an Azorean pineapple, a crater lake, the Portas da Cidade and a guest reading a guide. Corrected.
- **The About photo was captioned "Ponta Delgada cityscape and our apartments"** but is the Igreja Matriz bell tower. Corrected.
- **Two of the five `/guide/` images are the same Unsplash photo** used for different landmarks, and none are photos of the places they label. Marked decorative pending real photos.
- **`IMG_3059` (Ramalho, utility balcony) is stored rotated 90°.** Worth checking how it renders in the gallery.
- **There is no logo image anywhere in the repo** — the header logo is CSS-styled text. This blocks `Organization.logo` and any branded OG card.


---

*Phase 2 findings above; implementation status as of 9 August 2026. Plan in [SEO-PLAN.md](SEO-PLAN.md).*
