# SEO Implementation Plan — Ramalho Apartments

> **STATUS — 9 August 2026. Phase 3 (§1–§7) is IMPLEMENTED**, except §7 (analytics),
> across 9 commits on branch `seo-implementation`. `npm run verify` passes on a clean
> build. Phase 4 (§8) remains proposed and unbuilt, as intended.
>
> Where the delivered work differs from this plan, the plan text below is left as
> written and the difference is noted in "What actually shipped" at the end.

Companion to [SEO-AUDIT.md](SEO-AUDIT.md). Phase 3 (§1–§7) is what I propose to build. Phase 4 (§8) is proposed but explicitly **not** to be built.

Every item in Phase 3 is marked **[T1]** (invisible — zero rendered-pixel change), **[T2]** (touches visible content) or **[T3]** (new pages). Only T1 items are candidates for immediate implementation.

---

## 0. Change manifest — every file I would touch, before I touch anything

### New files

| File | Purpose | Tier |
|---|---|---|
| `src/components/SEO.astro` | The single head component every page uses | T1 |
| `src/seo/routes.ts` | Route manifest — which routes exist in which locale, and their metadata | T1 |
| `src/seo/schema.ts` | JSON-LD `@graph` builders | T1 |
| `src/seo/business.ts` | Single source of truth for NAP, socials, entity IDs | T1 |
| `public/robots.txt` | Crawler policy + `Sitemap:` | T1 |
| `public/og/*.jpg` | 8 static 1200×630 OG images (committed build artefacts) | T1 |
| `scripts/generate-og-images.mjs` | One-off generator using the existing `sharp` dependency | T1 |
| `src/assets/fonts/inter-*.woff2` | Self-hosted Inter, replacing the Google Fonts `@import` | T1 |

### Modified files

| File | Change | Tier |
|---|---|---|
| `src/layouts/Layout.astro` | Replace the inline `<head>` block (lines 35–51) with `<SEO …/>`. **Body markup and `<style>` untouched.** | T1 |
| `src/layouts/PropertyLayout.astro` | Pass property schema props through to `Layout`. Add `alt` text from data. | T1 |
| `src/i18n/utils.ts` | Fix `getLocaleUrl` trailing slash (H-2); add `routeExistsIn(locale, path)` | T1 |
| `src/i18n/ui.ts` | Rewrite the 4 `site.default_*` and `about.title`/`about.description` meta strings; add `alt` strings | T1 |
| `src/i18n/properties.ts` | Add structured-data fields (`geo`, `beds`, `bathrooms`, `occupancy`, `amenityFeature` codes) and per-image `alt` | T1 |
| `src/pages/*.astro`, `src/pages/pt/*.astro` (13 files) | Pass explicit `title`/`description`/`ogImage`/schema props. **No markup changes.** | T1 |
| `src/styles/global.css` | Delete line 1 (`@import` Google Fonts); add local `@font-face`. **All other rules byte-identical.** | T1 |
| `src/components/Footer.astro` | Real social URLs, `rel="noopener"` | T1 |
| `astro.config.mjs` | `trailingSlash: 'always'`; sitemap `serialize`/`filter`/i18n locale codes | T1 |
| `src/pages/guide.astro` | Fix `alt` on the 5 remote images | T1 |
| `src/assets/**` (25 image files) | Rename to descriptive slugs; update every `import` | T1 |

### Files I would delete — **only with your explicit approval**

| File | Reason | Tier |
|---|---|---|
| `src/pages/blog/**`, `src/layouts/BlogPost.astro`, `src/components/{BaseHead,Header,HeaderLink,FormattedDate}.astro`, `src/content/blog/**`, `src/pages/rss.xml.js`, `src/consts.ts` | Astro starter template. Currently live and indexed (H-1). | Decision needed |
| `src/components/{HeroSection,PropertyCard}.astro` | Imported by nothing (verified) | T1 (dead code) |
| `public/CNAME` | Inert since the move off GitHub Pages | Low priority |

**Nothing is deleted without a separate, explicit go-ahead from you.**

---

## 1. [T1] Centralised SEO component — §3.1

### Design

Three modules so that data, policy and rendering stay separable:

**`src/seo/routes.ts`** — the route manifest. This is what makes hreflang correct by construction rather than by hope:

```ts
export const ROUTES = {
  home:       { en: '/',               pt: '/pt/' },
  properties: { en: '/properties/',    pt: '/pt/properties/' },
  ramalho:    { en: '/ramalho/',       pt: '/pt/ramalho/' },
  amorim:     { en: '/amorim/',        pt: '/pt/amorim/' },
  duplex:     { en: '/amorim-duplex/', pt: '/pt/amorim-duplex/' },
  about:      { en: '/about/',         pt: '/pt/about/' },
  faq:        { en: '/faq/',           pt: null },   // ← no PT version: emits NO pt alternate
  guide:      { en: '/guide/',         pt: null },
} as const;
```

A `null` means "this route does not exist in that locale", and the component then emits **no** alternate for it — which is precisely the fix for C-1. When you approve a PT FAQ later, you change one `null` and the hreflang follows automatically.

**`src/components/SEO.astro`** — typed props, sane defaults:

```ts
interface Props {
  routeKey: keyof typeof ROUTES;
  locale: 'en' | 'pt';
  title: string;
  description: string;
  ogImage?: string;        // path under /og/, defaults per routeKey
  ogImageAlt?: string;
  ogType?: 'website' | 'article';
  schema?: object[];       // extra @graph nodes for this page
  noindex?: boolean;       // for future utility pages
}
```

### Exact rendered output

For `/ramalho/` (line breaks added for readability; real output is Astro's usual minified head):

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">

<title>3-Bed Apartment, Ponta Delgada Centre | Ramalho Apartments</title>
<meta name="description" content="Three-bedroom apartment on Rua Rodrigo Rodrigues, central Ponta Delgada. Sleeps 6, 2 baths, full kitchen, WiFi. From €80/night booked direct on WhatsApp.">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">

<link rel="canonical" href="https://ramalhoapartments.com/ramalho/">
<link rel="alternate" hreflang="en"        href="https://ramalhoapartments.com/ramalho/">
<link rel="alternate" hreflang="pt-PT"     href="https://ramalhoapartments.com/pt/ramalho/">
<link rel="alternate" hreflang="x-default" href="https://ramalhoapartments.com/ramalho/">

<meta property="og:type"                content="website">
<meta property="og:site_name"           content="Ramalho Apartments">
<meta property="og:url"                 content="https://ramalhoapartments.com/ramalho/">
<meta property="og:title"               content="3-Bed Apartment, Ponta Delgada Centre | Ramalho Apartments">
<meta property="og:description"         content="Three-bedroom apartment on Rua Rodrigo Rodrigues, central Ponta Delgada. Sleeps 6, 2 baths, full kitchen, WiFi. From €80/night booked direct on WhatsApp.">
<meta property="og:image"               content="https://ramalhoapartments.com/og/ramalho-en.jpg">
<meta property="og:image:width"         content="1200">
<meta property="og:image:height"        content="630">
<meta property="og:image:alt"           content="Living room of the three-bedroom Ramalho apartment in central Ponta Delgada">
<meta property="og:locale"              content="en_GB">
<meta property="og:locale:alternate"    content="pt_PT">

<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="3-Bed Apartment, Ponta Delgada Centre | Ramalho Apartments">
<meta name="twitter:description" content="Three-bedroom apartment on Rua Rodrigo Rodrigues, central Ponta Delgada. Sleeps 6, 2 baths, full kitchen, WiFi. From €80/night booked direct on WhatsApp.">
<meta name="twitter:image"       content="https://ramalhoapartments.com/og/ramalho-en.jpg">
<meta name="twitter:image:alt"   content="Living room of the three-bedroom Ramalho apartment in central Ponta Delgada">

<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="sitemap" href="/sitemap-index.xml">
<script type="application/ld+json">{ …see §3… }</script>
```

For `/faq/`, the `pt-PT` line is **absent** (C-1 fixed). For `/pt/ramalho/`, `x-default` points at `https://ramalhoapartments.com/ramalho/` and `og:locale` is `pt_PT`.

### Notes on specific decisions

- **`hreflang="en"` not `en-GB`.** Per your brief. I will change the sitemap config from `en: 'en-GB'` to `en: 'en'` so the two sources agree (fixes H-3). `og:locale` stays `en_GB` because OG uses a different vocabulary that requires a region — that is not an inconsistency.
- **`theme-color` preserved** exactly as-is.
- **Two `preconnect`s removed** (M-7) — they point at Google Fonts, which §6 eliminates.
- **`rel="sitemap"` added**, currently only present on blog pages.

### Zero-visual-change confirmation ✅

`SEO.astro` renders only inside `<head>`. `Layout.astro`'s `<body>`, its `<style is:global>` block and its `<script>` are untouched. Verification: byte-diff `dist/**/*.html` from `<body>` to `</html>` before and after — must be identical except where §5 renames image files.

---

## 2. [T1] Per-page metadata — §3.2

Every title ≤60 chars, every description ≤155. Lengths below are measured, not estimated.

### English

| Route | Title (len) | Description (len) | Primary target |
|---|---|---|---|
| `/` | `Apartments in Ponta Delgada, Azores \| Ramalho Apartments` (56) | Three self-catering apartments in central Ponta Delgada, owner-run. Book direct on WhatsApp for the best rate. Sleeps up to 6, 2 km from the airport. (149) | brand + `apartments ponta delgada` |
| `/properties/` | `Our Apartments in Ponta Delgada \| Ramalho Apartments` (52) | Compare our three Ponta Delgada apartments: a 3-bed from €80/night plus two 2-beds opening October 2026. Each sleeps 6. Book direct, no platform fees. (150) | `apartments ponta delgada azores` |
| `/ramalho/` | `3-Bed Apartment, Ponta Delgada Centre \| Ramalho Apartments` (58) | Three-bedroom apartment on Rua Rodrigo Rodrigues, central Ponta Delgada. Sleeps 6, 2 baths, full kitchen, WiFi. From €80/night booked direct on WhatsApp. (153) | **`3 bedroom apartment ponta delgada`** |
| `/amorim/` | `2-Bed Apartment, Ponta Delgada \| Ramalho Apartments` (51) | Two-bedroom apartment on Rua do Amorim, minutes from Ponta Delgada centre. Sleeps 6, air conditioning, private outdoor space. Opens October 2026. (145) | `2 bedroom apartment ponta delgada` |
| `/amorim-duplex/` | `2-Bed Duplex, Ponta Delgada \| Ramalho Apartments` (48) | Split-level two-bedroom duplex on Rua do Amorim, Ponta Delgada. Sleeps 6 over two floors, 2 bathrooms, air conditioning. Opens October 2026. (140) | `duplex apartment ponta delgada` |
| `/about/` | `About Us \| Ramalho Apartments, Ponta Delgada` (44) | We are Ponta Delgada residents who own and run all three apartments ourselves. No agency, no middlemen — book direct and save up to 20% on platform rates. (154) | **`ramalho apartments`** brand |
| `/faq/` | `FAQ: Check-in, Parking, Airport \| Ramalho Apartments` (52) | Check-in times, parking, the 2 km airport transfer, WiFi, pets, cancellation and minimum stay at our Ponta Delgada apartments. Ask us anything on WhatsApp. (155) | long-tail Q&A; AI-assistant extraction |
| `/guide/` | `Ponta Delgada Guide: Top Spots & Tips \| Ramalho` (47) | A resident guide to Ponta Delgada and São Miguel: must-see spots, supermarkets, pharmacies, car hire and getting in from the airport, by your hosts. (148) | discovery-stage `what to do ponta delgada` |

### Portuguese — written natively, not translated

| Route | Title (len) | Description (len) | Primary target |
|---|---|---|---|
| `/pt/` | `Apartamentos em Ponta Delgada, Açores \| Ramalho Apartments` (58) | Três apartamentos de alojamento local no centro de Ponta Delgada, geridos pelos proprietários. Reserve direto por WhatsApp e pague menos. Até 6 hóspedes. (153) | `alojamento local ponta delgada` |
| `/pt/properties/` | `Apartamentos em Ponta Delgada Centro \| Ramalho Apartments` (57) | Compare os nossos três apartamentos em Ponta Delgada: T3 desde €80/noite e dois T2 a abrir em outubro de 2026. Reserva direta, sem comissões. (141) | `apartamentos ponta delgada` |
| `/pt/ramalho/` | `Apartamento T3 em Ponta Delgada Centro \| Ramalho` (48) | Apartamento T3 na Rua Rodrigo Rodrigues, centro de Ponta Delgada. Até 6 hóspedes, 2 casas de banho e cozinha equipada. Desde €80/noite, reserva direta. (151) | **`apartamento T3 Ponta Delgada centro`** |
| `/pt/amorim/` | `Apartamento T2 em Ponta Delgada \| Ramalho Apartments` (52) | Apartamento T2 na Rua do Amorim, a minutos do centro de Ponta Delgada. Até 6 hóspedes, ar condicionado e espaço exterior privado. Abre em outubro de 2026. (154) | `apartamento T2 Ponta Delgada` |
| `/pt/amorim-duplex/` | `Duplex T2 em Ponta Delgada \| Ramalho Apartments` (47) | Duplex T2 em dois pisos na Rua do Amorim, Ponta Delgada. Até 6 hóspedes, 2 casas de banho e ar condicionado. Abre em outubro de 2026. (133) | `duplex Ponta Delgada` |
| `/pt/about/` | `Sobre Nós \| Ramalho Apartments, Ponta Delgada` (45) | Somos residentes em Ponta Delgada e gerimos os três apartamentos pessoalmente. Sem agências nem intermediários: reserve direto e poupe até 20%. (143) | brand |

**Deliberate choices:**
- "Premium" and "luxury" removed from all meta (M-5). Replaced with the concrete levers: bedroom count, `T3`/`T2`, `centro`, `aeroporto`, capacity, `reserva direta`.
- PT uses `alojamento local` (the legal//search term Portuguese guests use), `T3`/`T2` (the Portuguese apartment-size convention), `hóspedes`, `casas de banho`, `reserva direta`. None of this is a calque of the English.
- `/properties/` and `/pt/properties/` now differ from the homepage (M-3 fixed).
- `apartment near ponta delgada airport` is targeted in the `/` and `/faq/` descriptions ("2 km from the airport"). It deserves a dedicated page eventually — noted in §8.
- `ramalho apartments book direct` is carried by `/about/` and, properly, by the `/book` page in §8.1.

---

## 3. [T1] Structured data — §3.3

### Shape

One `<script type="application/ld+json">` per page containing a single `@graph`, nodes joined by `@id`. Not disconnected islands.

Stable `@id`s (locale-independent so both language versions describe the same real-world things):

```
https://ramalhoapartments.com/#organization
https://ramalhoapartments.com/#website
https://ramalhoapartments.com/ramalho/#apartment
https://ramalhoapartments.com/amorim/#apartment
https://ramalhoapartments.com/amorim-duplex/#apartment
```

### Site-wide nodes (every page)

I propose **`LodgingBusiness`** rather than a bare `Organization`. The brand *is* the venue operator, it has a phone, an address and a service area, and `LodgingBusiness` is a `LocalBusiness` — which is what earns local-pack relevance. It also correctly parents the three `Apartment` nodes via `containsPlace`.

```jsonc
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LodgingBusiness",
      "@id": "https://ramalhoapartments.com/#organization",
      "name": "Ramalho Apartments",
      "url": "https://ramalhoapartments.com/",
      "logo":  { "@type": "ImageObject", "url": "https://ramalhoapartments.com/og/logo.png" },  // ⚠ NEED #5
      "image": "https://ramalhoapartments.com/og/home-en.jpg",
      "telephone": "+351911031847",
      "email": "ramalhoapartments@gmail.com",
      "priceRange": "€€",
      "currenciesAccepted": "EUR",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Rua Rodrigo Rodrigues 4",
        "addressLocality": "Ponta Delgada",
        "addressRegion": "Azores",
        "postalCode": "…",              // ⚠ NEED #1
        "addressCountry": "PT"
      },
      "geo": { "@type": "GeoCoordinates", "latitude": …, "longitude": … },   // ⚠ NEED #3
      "areaServed": { "@type": "AdministrativeArea", "name": "São Miguel, Azores" },
      "sameAs": [
        "https://www.facebook.com/RamalhoApartments",                        // ⚠ CONFIRM #7
        "https://www.instagram.com/…",                                       // ⚠ NEED #6
        "https://www.booking.com/hotel/pt/ramalho-apartments-t3-cidade-ponta-delgada.html",
        "https://www.airbnb.…/…",                                            // ⚠ NEED #8
        "https://www.vrbo.com/…"                                             // ⚠ NEED #9
      ],
      "containsPlace": [
        { "@id": "https://ramalhoapartments.com/ramalho/#apartment" },
        { "@id": "https://ramalhoapartments.com/amorim/#apartment" },
        { "@id": "https://ramalhoapartments.com/amorim-duplex/#apartment" }
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://ramalhoapartments.com/#website",
      "url": "https://ramalhoapartments.com/",
      "name": "Ramalho Apartments",
      "publisher": { "@id": "https://ramalhoapartments.com/#organization" },
      "inLanguage": ["en", "pt-PT"]
    },
    {
      "@type": "WebPage",
      "@id": "https://ramalhoapartments.com/ramalho/#webpage",
      "url": "https://ramalhoapartments.com/ramalho/",
      "isPartOf": { "@id": "https://ramalhoapartments.com/#website" },
      "about":    { "@id": "https://ramalhoapartments.com/ramalho/#apartment" },
      "inLanguage": "en"
    }
  ]
}
```

**Every `⚠ NEED` field is omitted entirely if you do not supply it.** No placeholders will ship. `sameAs` will contain only the URLs I actually have.

### `BreadcrumbList` — every non-home page

```jsonc
{
  "@type": "BreadcrumbList",
  "@id": "https://ramalhoapartments.com/ramalho/#breadcrumb",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home",       "item": "https://ramalhoapartments.com/" },
    { "@type": "ListItem", "position": 2, "name": "Properties", "item": "https://ramalhoapartments.com/properties/" },
    { "@type": "ListItem", "position": 3, "name": "Ramalho Three Bedroom Apartment" }
  ]
}
```

Names come from `ui.ts` per locale. Position 3 has no `item` (it is the current page) — that is correct per Google's spec.

### Per-property — `Apartment`

Example for `/ramalho/`, with only facts that exist in the repo today:

```jsonc
{
  "@type": ["Apartment", "Accommodation"],
  "@id": "https://ramalhoapartments.com/ramalho/#apartment",
  "name": "Ramalho Three Bedroom Apartment",
  "description": "Spacious three-bedroom apartment in the heart of Ponta Delgada — comfortably sleeping up to 6 guests.",
  "url": "https://ramalhoapartments.com/ramalho/",
  "image": [ /* 5 absolute URLs from the gallery */ ],
  "address": { "@type": "PostalAddress", "streetAddress": "Rua Rodrigo Rodrigues 4",
               "addressLocality": "Ponta Delgada", "addressRegion": "Azores",
               "postalCode": "…", "addressCountry": "PT" },          // ⚠ NEED #1
  "geo": { "@type": "GeoCoordinates", "latitude": …, "longitude": … }, // ⚠ NEED #3
  "numberOfBedrooms": 3,
  "numberOfBathroomsTotal": 2,
  "numberOfRooms": …,                                                  // ⚠ NEED #15
  "numberOfBeds": …,                                                   // ⚠ NEED #14
  "occupancy": { "@type": "QuantitativeValue", "maxValue": 6, "unitCode": "C62" },
  "floorSize": { "@type": "QuantitativeValue", "value": …, "unitCode": "MTK" },  // ⚠ NEED #16 (omit if unknown)
  "petsAllowed": …,                                                    // ⚠ NEED #12
  "smokingAllowed": …,                                                 // ⚠ NEED #13
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "High-speed WiFi",  "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Full kitchen",     "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Smart TV",         "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Washing machine",  "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Hair dryer",       "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Microwave",        "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Coffee machine",   "value": true }
  ],
  "containedInPlace": { "@id": "https://ramalhoapartments.com/#organization" }
}
```

Amenity names are taken **verbatim from the page's own amenity list** ([properties.ts:17-26](src/i18n/properties.ts#L17-L26)) and localised, so the markup never claims something the page does not show. Parking is **not** in the list — I will not add it until you answer NEED #18.

### `Offer` — pricing

Ramalho (bookable now):

```jsonc
{
  "@type": "Offer",
  "@id": "https://ramalhoapartments.com/ramalho/#offer",
  "itemOffered": { "@id": "https://ramalhoapartments.com/ramalho/#apartment" },
  "priceCurrency": "EUR",
  "price": "80",
  "priceSpecification": {
    "@type": "UnitPriceSpecification",
    "price": 80, "priceCurrency": "EUR",
    "unitCode": "DAY",
    "referenceQuantity": { "@type": "QuantitativeValue", "value": 2, "unitCode": "DAY" }
  },
  "availability": "https://schema.org/InStock",
  "seller": { "@id": "https://ramalhoapartments.com/#organization" }
}
```

`referenceQuantity: 2 DAY` encodes the 2-night minimum that the page already states. Depends on NEED #19 — if €80 is a seasonal low rather than a year-round floor, I will emit `priceRange` instead of a specific `price`, because a hard `price` that guests cannot actually get is exactly the kind of mismatch that triggers a structured-data manual action.

### The two Amorim units — indexable now, not bookable

```jsonc
{
  "@type": "Offer",
  "@id": "https://ramalhoapartments.com/amorim/#offer",
  "itemOffered": { "@id": "https://ramalhoapartments.com/amorim/#apartment" },
  "priceCurrency": "EUR",
  "availability": "https://schema.org/PreOrder",
  "availabilityStarts": "2026-10-01",     // ⚠ CONFIRM #21
  "seller": { "@id": "https://ramalhoapartments.com/#organization" }
}
```

`PreOrder` + `availabilityStarts` is the honest encoding: the page is indexable and the entity is understood, but nothing claims you can book it today. The visible page already says "Opening October 2026" and offers only a notify CTA, so markup and page agree. **No `price` will be emitted for these two** unless you supply one (NEED #20) — an `Offer` with a currency and no price is valid and does not imply bookability.

### `aggregateRating` — deliberately absent

Per your constraint 5, and I agree. The 9.3 is Booking.com's, displayed on our own site. Emitting it as `aggregateRating` on our own `LodgingBusiness` is self-serving review markup under Google's structured data policy and is a manual-action risk. It stays visible text. If you want it machine-readable later, the correct route is a `Review` node whose `author` is the guest and whose `publisher` is Booking.com — and even that is only appropriate for individually attributed reviews, not an aggregate we transcribed.

### Validation expectations — what actually earns rich results

I will validate every block against Schema.org and the Rich Results Test. Setting expectations honestly:

| Node | Valid Schema.org | Google rich result | Reality |
|---|---|---|---|
| `LodgingBusiness` | ✅ | ❌ no dedicated rich result | Feeds the Knowledge Panel and local understanding. Worth having; will not show a SERP widget. |
| `Apartment` / `Accommodation` | ✅ | ❌ | **Google's Vacation Rental rich result is gated** — it requires a partner integration via Google Hotel Center, not open markup. Expect entity understanding and AI-assistant extraction, not stars in the SERP. |
| `BreadcrumbList` | ✅ | ✅ | Real, visible SERP breadcrumb trail. |
| `WebSite` | ✅ | ⚠️ Sitelinks Searchbox only with `SearchAction` — we have no site search, so no. | Entity plumbing. |
| `Offer` | ✅ | ❌ standalone | Contributes to Merchant/AI understanding; no SERP price chip for lodging. |
| `FAQPage` (§8.5) | ✅ | ⚠️ Since 2023 Google shows FAQ rich results only for authoritative government/health sites | Still worth doing — it is one of the most reliably extracted formats for AI assistants. Do it for AI, not for stars. |

**Net:** the only markup here that produces a visible SERP feature today is `BreadcrumbList`. Everything else is entity comprehension and AI retrieval. That is still the right investment for this business — AI assistants are a live booking-discovery channel — but I want you deciding with accurate expectations, not on a promise of star ratings.

---

## 4. [T1] Crawl infrastructure — §3.4

### `@astrojs/sitemap`

```js
sitemap({
  i18n: {
    defaultLocale: 'en',
    locales: { en: 'en', pt: 'pt-PT' },     // was en-GB — now matches the HTML hreflang (H-3)
  },
  filter: (page) =>
    !page.includes('/blog') &&              // template routes
    !page.includes('/rss.xml'),
  serialize(item) {
    const p = new URL(item.url).pathname;
    if (p === '/' || p === '/pt/')            return { ...item, changefreq: 'weekly',  priority: 1.0 };
    if (p.endsWith('/properties/'))           return { ...item, changefreq: 'weekly',  priority: 0.9 };
    if (/(ramalho|amorim|amorim-duplex)\/$/.test(p)) return { ...item, changefreq: 'weekly', priority: 0.9 };
    if (p.endsWith('/about/'))                return { ...item, changefreq: 'monthly', priority: 0.6 };
    return { ...item, changefreq: 'monthly', priority: 0.5 };   // faq, guide
  },
})
```

Result: 14 URLs instead of 20, EN/PT cross-referenced, `/faq/` and `/guide/` correctly carrying no alternates (matching the fixed HTML).

### `public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://ramalhoapartments.com/sitemap-index.xml
```

Plus the AI-crawler block, **pending your decision**.

### ⚠️ DECISION REQUIRED — AI crawler policy

I am not deciding this for you. Here is the trade-off, stated straight:

| | Allow GPTBot / ClaudeBot / PerplexityBot / Google-Extended | Disallow them |
|---|---|---|
| **Upside** | ChatGPT, Claude and Perplexity can cite you when someone asks "where to stay in Ponta Delgada". For a direct-booking business with no ad budget this is a genuinely cheap acquisition channel, and it is growing. Your content — three specific properties, a local guide, an FAQ — is exactly the shape assistants retrieve well. | Your photos and copy are not used as training data. |
| **Downside** | Your descriptions and photos may be used in model training with no attribution or payment. | You become invisible to assistant-mediated discovery. Note this does **not** protect you from being described second-hand via your Booking.com and Airbnb listings, which you do not control. |
| **Note** | `Google-Extended` is separate from `Googlebot` — blocking it does **not** affect normal Google Search ranking. It only opts you out of Gemini/AI Overviews grounding. | |

**Three options:**

- **(A) Allow all** — maximum discovery. My recommendation for a small direct-booking business: you are trying to be found, and there is little proprietary value in the copy.
- **(B) Allow retrieval bots, block trainers** — allow `OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`; disallow `GPTBot`, `CCBot`, `Google-Extended`. Roughly "cite me, don't train on me". Honoured on the honour system, and the bot taxonomy shifts often.
- **(C) Block all AI crawlers** — maximum control, minimum reach.

**Tell me A, B or C and I will write it.** Until then `robots.txt` will ship with the universal `Allow: /` and the `Sitemap:` line only.

### The redirect fix (C-2)

**Repo side [T1]:**
- `trailingSlash: 'always'` in `astro.config.mjs` — makes Astro enforce the convention that the server already implements, and keeps `Astro.url` consistent between dev and prod. **No change to built output paths**; `dist/` is already `/properties/index.html`.
- Internal links get trailing slashes (H-4) — **but see §6, this has a visible side effect and needs your decision.**

**Server side — I cannot do this from here.** Requires the changes in [SEO-AUDIT.md §1](SEO-AUDIT.md). Please either apply them or grant access. I would also recommend moving the nginx conf and `docker-compose.yml` into this repo under `deploy/`.

### `public/llms.txt` — proposed, not created [T3]

Plain-text summary at `/llms.txt` for AI retrieval. Proposed content:

```markdown
# Ramalho Apartments

> Three owner-operated short-term rental apartments in Ponta Delgada,
> São Miguel, Azores, Portugal. Direct booking via WhatsApp; no platform fees.

## Properties
- **Ramalho Three Bedroom Apartment** — Rua Rodrigo Rodrigues 4, Ponta Delgada.
  3 bedrooms, 2 bathrooms, sleeps 6. From €80/night, 2-night minimum.
  Available now. https://ramalhoapartments.com/ramalho/
- **Amorim Two Bedroom Apartment** — Rua do Amorim 15, Ponta Delgada.
  2 bedrooms, 1 bathroom, sleeps 6, air conditioning. Opens October 2026.
  https://ramalhoapartments.com/amorim/
- **Amorim Two Bedroom Duplex** — Rua do Amorim 15, Ponta Delgada.
  2 bedrooms, 2 bathrooms, sleeps 6, split-level. Opens October 2026.
  https://ramalhoapartments.com/amorim-duplex/

## Booking
WhatsApp +351 911 031 847 · ramalhoapartments@gmail.com
Airport (PDL) 2 km. Check-in 15:00, check-out 11:00.   ← pending NEED #11

## Languages
English https://ramalhoapartments.com/ · Português https://ramalhoapartments.com/pt/
```

Not written until you approve, and the check-in line only ships once NEED #11 is confirmed.

### ⚠️ DECISION REQUIRED — the template blog (H-1)

Six live, indexed URLs titled "Astro Blog" / "First post" with Lorem ipsum bodies. Options:

- **(A) Delete** the routes, the content collection, `rss.xml`, and the 4 now-orphaned starter components. Serve `410 Gone` (or let them 404). Cleanest. They have no links and no value.
- **(B) `noindex`** them and leave the code. Keeps the scaffolding if you plan a real blog on that path. Slower to de-index.
- **(C) Keep** — only sensible if the content programme in §8.7 is imminent and will reuse the collection.

My recommendation: **(A)**, and rebuild the blog properly when §8.7 is approved. The starter code shares almost nothing with what a real content layer needs.

---

## 5. [T1] Images — §3.5

### `alt` text

Written per language, describing what is actually in the photo. Stored alongside the image list in `properties.ts` so EN and PT stay in sync.

Current state → proposed:

| Where | Current | Proposed |
|---|---|---|
| Property gallery ([PropertyLayout.astro:84](src/layouts/PropertyLayout.astro#L84)) | `"{name} – photo 1"`, `"… – photo 2"` … indexed, meaningless | Per-image: *"Open-plan living room with sofa and dining table, Ramalho three-bedroom apartment, Ponta Delgada"* / PT: *"Sala em plano aberto com sofá e mesa de jantar, apartamento T3 Ramalho, Ponta Delgada"* |
| Carousel ([PropertyCarousel.astro:62](src/components/PropertyCarousel.astro#L62)) | `alt={p.title}` — duplicates the visible link text right below it | Descriptive alt, distinct from the adjacent text |
| Properties list ([properties.astro:67](src/pages/properties.astro#L67)) | `"{name} – Ramalho Apartments"` — brand-stuffed | Descriptive |
| Hero ([index.astro:59](src/pages/index.astro#L59)) | `alt=""` + `aria-hidden="true"` | **Keep `alt=""`.** It is a decorative background behind the H1 — correctly marked already ✅ |
| Lightbox ([PropertyLayout.astro:155](src/layouts/PropertyLayout.astro#L155)) | `alt=""`, set by JS | Set from the same per-image alt array |
| `/guide/` spots ([guide.astro:65](src/pages/guide.astro#L65)) | `alt={spot.name}` — and two entries reuse the **same** Unsplash photo for different places | Descriptive alt; **and flag that "Arcos da Cidade" and "Lagoa de Santiago" currently share one image**, which is factually wrong regardless of SEO |
| Blog placeholders | 9 images with **no `alt` at all** | Moot under option (A) |

No keyword stuffing. Decorative images keep a deliberate `alt=""`.

### Source file renames

Spaces and camera-roll names → lowercase hyphenated slugs. Invisible; changes only the hashed `/_astro/` URL.

| Current | Proposed |
|---|---|
| `images/header 2026-05-03_200655.jpg` | `images/ramalho-apartments-ponta-delgada-hero.jpg` |
| `images/Presentation1.png` | `images/ramalho-apartments-collection.png` |
| `images/pexels-ihor-lypnytskyi-*.jpg` | `images/ponta-delgada-cityscape.jpg` |
| `properties/ramalho/IMG_5767.jpeg` | `properties/ramalho/ramalho-apartment-living-room.jpeg` |
| `properties/ramalho/IMG_3023 (1).JPG` | `properties/ramalho/ramalho-apartment-bedroom-two.jpg` |
| `properties/amorim/Screenshot 2026-05-03 145515.png` | `properties/amorim/amorim-apartment-living-room.png` |
| `properties/duplex/Screenshot 2026-05-03 145842.png` | `properties/duplex/amorim-duplex-living-room.png` |
| …25 files total | full mapping supplied at implementation time, once you confirm what each photo shows |

**I need you to tell me what each photo actually depicts** before I can name them honestly. I will not invent room labels. If you would rather not go photo-by-photo, I will use neutral-but-accurate slugs (`ramalho-apartment-01.jpeg` …) which still beat `IMG_5767` and carry no false claims.

### `og:image` — the highest-impact item in this plan

Eight images at 1200×630 (`/og/{route}-{lang}.jpg`), one per route per language, plus `og/logo.png`.

**Recommended approach: a one-off `sharp` script.** `sharp@0.34.3` is already a direct dependency, so this adds **nothing** to `package.json`.

```js
// scripts/generate-og-images.mjs  — run manually, output committed
sharp(source)
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(`public/og/${name}.jpg`);
```

- Output committed to `public/og/`, ~90–140 kB each.
- **Zero build-time cost, zero runtime cost, no new dependency.**
- Regenerated only when photos change.

**Alternative considered and rejected:** `astro-og-canvas` / `satori`. Renders text overlays (property name, price) onto the card, which looks more designed — but adds a dependency plus a bundled font, and runs at build time on every deploy. Not worth it for 8 static cards. Say the word if you want the branded-text version and I will price it properly.

**Why this matters most:** the business books through WhatsApp. Every link you or a guest sends today previews as a blank rectangle. Fixing it changes nothing about rankings and quite possibly changes conversion.

### LCP confirmation

Verified in the current build:

- Hero uses `loading="eager"` + `fetchpriority="high"` — **correct, not lazy-loaded** ✅
- `srcset` at 768/1280/1920 with `sizes="100vw"` — correctly sized ✅
- **Not preloaded** — I propose adding `<link rel="preload" as="image" imagesrcset=… imagesizes="100vw">` on the two homepages. Marginal given `fetchpriority`, but free.
- **`src` fallback is a 3.09 MB WebP** (M-8) — I will cap it by adding `1920` explicitly as the widest and letting `src` resolve there, cutting the deployed asset from 3.09 MB to 422 kB.
- **The real LCP win is §6's font fix**, not the image.

---

## 6. [T1] Link and markup hygiene — §3.6

### Footer social links

```html
<!-- now -->
<a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" …>
<a href="https://www.facebook.com"  target="_blank" rel="noopener noreferrer" …>

<!-- proposed -->
<a href="https://www.facebook.com/RamalhoApartments"  target="_blank" rel="noopener noreferrer" …>   <!-- ⚠ CONFIRM #7 -->
<a href="https://www.instagram.com/{handle}/"         target="_blank" rel="noopener noreferrer" …>   <!-- ⚠ NEED #6 -->
```

`rel="noopener noreferrer"` is **already present** on both ([Footer.astro:27,30](src/components/Footer.astro#L27)) — nothing to add there. The same URLs then feed `sameAs` in §3. Invisible: the icons and their positions do not change.

### ⚠️ DECISION REQUIRED — trailing slashes on internal links (H-4)

Changing `href="/properties"` → `href="/properties/"` is invisible **in itself**, and it eliminates a 2-hop redirect on every internal click. But it has a side effect I will not slip past you:

[Layout.astro:272-277](src/layouts/Layout.astro#L272-L277) marks the current nav link `.active` by comparing `link.href === window.location.href`. Today `…/properties` never equals `…/properties/`, so **the active-state highlight has never once fired.** Add the slashes and it starts working: the current page's nav link changes from `--clr-text-2` to `--clr-text`. That is a visible pixel change.

- **(A) Fix hrefs, let the highlight appear.** The highlight is what the CSS was written for and is a genuine usability improvement. **My recommendation** — but it is a visible change, so it is yours to approve.
- **(B) Fix hrefs, suppress the highlight** by leaving the comparison mismatched. Strictly zero visual change, preserves a bug on purpose.
- **(C) Leave hrefs alone.** Keeps the redirect chain on every click. Not recommended.

### Heading hierarchy — report only, no changes

Audited in [SEO-AUDIT.md §4](SEO-AUDIT.md). All 14 real pages: exactly one `<h1>`, no skipped levels, semantically appropriate `<h2>`/`<h3>` nesting. The only defects are on the template blog pages (`/blog/` has **zero** H1; `/blog/markdown-style-guide/` has **two**), which the §4 decision resolves. **No visible heading is changed by this plan.**

### Duplicated desktop/mobile nav

Both blocks render always; CSS shows one per breakpoint. Findings:

- **Not an SEO problem.** Duplicate internal anchors to the same URL are normal and ignored.
- **One real a11y issue:** the mobile drawer is hidden with `max-height: 0; overflow: hidden`, **not** `display:none` or `visibility:hidden`. Content hidden that way stays in the accessibility tree and remains focusable. `aria-hidden="true"` is set in the markup and toggled by JS, which covers screen readers — but **keyboard focus is not trapped or excluded**, so a keyboard user on desktop can tab into the invisible drawer.
  **Proposed fix [T1]:** add `inert` to the closed drawer and toggle it alongside `aria-hidden`. Supported in all current browsers, changes nothing visually, and removes the hidden links from both the a11y tree and the tab order.
- The hamburger has `aria-label`, `aria-expanded` and `aria-controls` — correct ✅

### `lang` attributes (M-4)

`<html lang="en">` ✅ correct. `<html lang="pt">` → **`pt-PT`**. Invisible; affects screen-reader pronunciation and locale signalling. Matches the `hreflang="pt-PT"` in §1.

---

## 7. [T3] Analytics and conversion tracking — §3.7

### Recommendation: self-hosted Plausible

Since you already run Hetzner:

| | **Plausible (self-hosted)** | **Umami** |
|---|---|---|
| Script size | **~1.4 kB gzipped** | ~2.1 kB gzipped |
| Cookies | None | None |
| Personal data | None stored; no cross-site ID | Same |
| GDPR consent banner | Not required | Not required |
| Stack | Elixir + ClickHouse + Postgres — ~2 GB RAM | Node + Postgres/MySQL — ~512 MB RAM |
| Custom events | `plausible('Name', {props})` | `umami.track('Name', {...})` |
| Setup | `docker-compose`, ~30 min | `docker-compose`, ~15 min |

**Plausible** — the goal-and-funnel reporting is materially better for the one question you actually have ("which pages produce WhatsApp enquiries"), and its data model is nicer for per-page conversion breakdowns. Umami is the pick if RAM on the box is tight.

### Performance cost — measured against the current baseline

| | Now | With Plausible |
|---|---|---|
| Bundled JS | **0 bytes** | 0 bytes (external script) |
| External requests | 3 (2× Google Fonts preconnect + 1 CSS `@import`) | 1 (your own analytics host) |
| Blocking resources | 1 (`@import` — §5's fix removes it) | 0 (`defer`) |
| Added transfer | — | **~1.4 kB gzipped, deferred, same-origin-ish** |
| Added CPU | — | negligible; no cookies, no storage writes |
| LCP impact | — | **None** — `defer` + no render-blocking |

**Net: the fonts fix in §5 removes more from the critical path than analytics adds.** Post-change the site would make *fewer* third-party requests than today, and still ship zero bundled JS.

### Event tracking — the thing you actually need

Every CTA gets a data attribute and one small delegated listener (~500 bytes inline). No per-link handlers, no framework.

| Event | Fired by | Props |
|---|---|---|
| `WhatsApp Click` | every `wa.me` link | `page`, `locale`, `position` (hero / sticky-bar / booking-card / footer / carousel), `property` |
| `Email Click` | every `mailto:` | same |
| `Phone Click` | footer phone (**would need to become a `tel:` link** — currently a non-clickable `<span>`, [Footer.astro:55](src/components/Footer.astro#L55)) | same |
| `Waitlist Interest` | Amorim notify CTAs | `property` |
| `Gallery Open` | lightbox open | `property` |

That gives you, per page and per language: how many people reached out, from which CTA, about which property. Right now you have none of this.

**Two caveats stated up front:**
1. Making the footer phone a `tel:` link is a **behaviour** change (it becomes clickable). Visually it can be identical — I would keep `cursor:default` styling off and match the existing link colour exactly — but it is a real change, so it needs your sign-off.
2. This is **T3** because it adds a third-party host. It should go in last, after the T1 tiers are verified.

---

# Phase 4 — Proposed, NOT to be implemented

No code will be written for anything in this section.

### 8.1 `/book` and `/pt/reservar` landing pages — **priority Tier 3**

**Rationale.** The entire business model is direct booking, and there is no page for it. A guest who finds you on Booking.com or Airbnb and then searches "ramalho apartments" to book direct currently lands on a homepage that makes them hunt. This is the highest-intent traffic you will ever get and it is the cheapest to convert.

**Target queries:** `ramalho apartments book direct`, `ramalho apartments ponta delgada booking`, `book apartment ponta delgada direct`, `reservar apartamento ponta delgada`, `ramalho apartments contacto`.

**Structure:** H1 carrying "Book direct"; a why-direct block (price comparison vs. platform rate, flexible check-in, direct contact with owners); the three properties with availability status and price; a WhatsApp-first CTA with a pre-filled message; email and phone alternates; what happens next (response time, deposit, confirmation); a short booking FAQ.

**Schema:** `WebPage` + `BreadcrumbList` + `Offer` nodes `@id`-referencing the three existing `Apartment` nodes. No new entities — it reuses the §3 graph.

**Internal linking:** primary nav "Book now" (currently a raw `wa.me` link) points here instead; footer link; a link from each property page's booking card.

**Effort:** 1–1.5 days including PT. **Impact: high.**

### 8.2 H1 rewrite

"Your home in the Azores" / "A sua casa nos Açores" is good brand voice with zero search demand and no location signal. Alternatives keeping the tone:

| EN | PT |
|---|---|
| Your home in Ponta Delgada | A sua casa em Ponta Delgada |
| Apartments that feel like home, in the heart of Ponta Delgada | Apartamentos que são casa, no centro de Ponta Delgada |
| Your home in the Azores — three apartments in Ponta Delgada *(keeps the current line, adds the signal in a subhead)* | A sua casa nos Açores — três apartamentos em Ponta Delgada |

Row 3 is the lowest-risk: the existing line survives verbatim and the geography arrives in a supporting element. **Your call.** Effort: 30 min. Impact: medium.

### 8.3 RRAL nº2881

Your Airbnb listing shows **RRAL nº2881**; it appears nowhere on this site. Portugal's *Alojamento Local* regime requires the registration number in advertising, and it is a strong trust and local-relevance signal — Portuguese guests look for it.

Two questions I cannot answer for you and am not going to guess at:
1. **Whether one RRAL covers all three units.** Registrations are typically per-establishment. If Rua do Amorim has its own numbers, each property page needs its own.
2. **The precise legal wording and placement.** You said you would confirm the requirement independently — please do; I am flagging a compliance-adjacent matter, not advising on it.

Proposed placement once confirmed: footer, plus each property page near the address. Effort: 1 hour. Impact: medium (trust/compliance).

### 8.4 Full street address in the footer

The footer says only "Ponta Delgada, Azores". NAP (name / address / phone) consistency across your site, Google Business Profile and OTA listings is foundational local SEO — the address must match character-for-character. Also lets `PostalAddress` in §3 be corroborated by visible text, which is what Google actually wants.

Depends on NEED #1. Effort: 30 min. Impact: medium-high for local pack.

### 8.5 FAQ section or page

`/faq/` exists in EN with 12 solid questions but: no PT version (and its hreflang currently points at a 404), no `FAQPage` schema, and no link from the nav or footer — it is effectively orphaned. Verified: no page links to `/faq/`.

**Proposal:** PT translation, `FAQPage` schema, nav/footer links, and expand to cover luggage storage, accessibility/stairs (**not currently answered anywhere, and it is a common pre-booking blocker**), airport transfer pricing, and cot/high-chair availability.

Manage expectations: Google restricted FAQ rich results to authoritative government and health sites in 2023, so **expect no SERP widget**. Do it because it is the format AI assistants extract most reliably, and because it deflects WhatsApp questions. Effort: 1 day. Impact: medium-high for AI retrieval.

### 8.6 Waitlist capture for the Amorim units

Currently a `mailto:` with a pre-filled body ([PropertyLayout.astro:199](src/layouts/PropertyLayout.astro#L199)). `mailto:` conversion is poor — it breaks on webmail users, offers no confirmation, and leaves you with no list.

The units open in roughly two months. A captured waitlist is the cheapest booking source you will ever have: intent is already proven and acquisition cost is zero.

Options: a static-site form service (Formspree / Buttondown / Listmonk self-hosted on the same Hetzner box). Listmonk fits your stack and keeps the data yours. Needs a privacy policy (§8.8) since you would be storing personal data — that dependency is real, not theoretical.

Effort: 0.5–1 day. **Impact: high, and time-sensitive.**

### 8.7 Content layer — area guides and itineraries

The only durable route to non-brand rankings. `/guide/` is a decent seed but it is one thin page with stock photos, some of them duplicated.

| # | Topic | Target query | Difficulty | Notes |
|---|---|---|---|---|
| 1 | Getting from PDL airport to Ponta Delgada centre | `ponta delgada airport to city centre` | **Low** | You are 2 km away — natural authority, and it links straight to a property page |
| 2 | Where to stay in Ponta Delgada: neighbourhood guide | `where to stay ponta delgada` | Medium | High commercial intent; your own location is the answer |
| 3 | 3 days in São Miguel: an itinerary | `3 days sao miguel itinerary` | **High** | Big volume, crowded. Worth it only after 1 and 2 land |
| 4 | Sete Cidades and Lagoa do Fogo in one day | `sete cidades lagoa do fogo same day` | Medium | Strong seasonal traffic |
| 5 | Parking in Ponta Delgada: a practical guide | `parking ponta delgada` | **Low** | Genuine pain point, almost no good content, and it answers a real pre-booking question |
| 6 | Ponta Delgada with kids | `ponta delgada with kids` | Low-medium | Matches your 6-guest capacity — good fit |
| 7 | Best restaurants in Ponta Delgada, by residents | `restaurants ponta delgada` | High | Crowded but evergreen; the resident angle is your differentiator |
| 8 | When to visit São Miguel: month-by-month | `best time to visit sao miguel` | Medium-high | Top-of-funnel; long payback |

Start with **1, 5, 2** — lowest difficulty, highest booking relevance, and each links naturally to a property page. Publish in both languages. **Effort: ~1 day per article including PT. Impact: high but slow — 6–12 months.**

### 8.8 `/contact`, privacy policy, terms

- **`/contact`** — contact details live only in `/about/`'s lower half. A dedicated page is a trust signal and a `ContactPage` schema anchor.
- **Privacy policy — a real GDPR gap.** You collect enquiries by email (and would collect waitlist data under §8.6) with no privacy notice. Under GDPR you owe data subjects information about controller identity, purpose, retention and their rights. This is a genuine compliance shortfall today, not a nice-to-have. It compounds with the Google Fonts hotlink in [SEO-AUDIT.md H-5](SEO-AUDIT.md), which sends every visitor's IP to Google without consent — that one is fixed in §5.
- **Terms / booking conditions** — the cancellation policy currently lives only inside an FAQ accordion. For direct bookings taking deposits, terms should be a real page.

Effort: 0.5 day for `/contact`; the legal pages need your input or a template you are comfortable with. **Impact: medium for SEO, high for compliance.**

### 8.9 Additional locales (DE / FR)

German and French are meaningful inbound markets to PDL. **Do not start this until EN/PT hreflang is verified correct in production** — the current setup already ships two 404-ing alternates with only two languages. Four languages means 12 reciprocal pairs; a broken pattern would multiply.

Prerequisites: (1) C-1 fixed and verified, (2) the `ROUTES` manifest in §1 proven over a full crawl, (3) a real translator — machine-translated hospitality copy converts badly and reads as spam.

Effort: 2–3 days per locale plus translation. **Impact: medium; defer until the EN/PT foundation is proven.**

---

## 9. What I need from you to proceed

1. **Answers to the 21 blocking facts** in [SEO-AUDIT.md §7](SEO-AUDIT.md). Structured data is gated on these, and I will ship nothing invented.
2. **Six decisions:** AI crawler policy (A/B/C, §4) · template blog (A/B/C, §4) · trailing-slash active-nav side effect (A/B/C, §6) · VPS access for the nginx fix · `www` canonical direction · Plausible vs Umami.
3. **Tier approval and ordering.** My proposed commit sequence, each independently verifiable and revertible:

| Commit | Contents | Risk |
|---|---|---|
| 1 | `robots.txt`, sitemap config, `trailingSlash` | Trivial |
| 2 | `SEO.astro` + route manifest + hreflang fix (C-1, H-2, H-3, M-1–M-4) | Low |
| 3 | Metadata rewrite, both languages (§2) | Low |
| 4 | JSON-LD `@graph` (§3) — **gated on your facts** | Low |
| 5 | OG images + `alt` text + file renames (§5) | Medium — touches 25 files |
| 6 | Self-hosted fonts, `preconnect` removal, hero `src` cap (H-5, M-7, M-8) | Low |
| 7 | Link hygiene: social URLs, `inert`, `lang="pt-PT"` (§6) | Trivial |
| 8 | Blog removal — **only if you pick (A)** | Medium |

### Post-implementation verification I will run

- Rebuild; confirm 14 (or 20) pages, exit 0, no new warnings.
- **Programmatic hreflang reciprocity check** — assert every declared alternate resolves to a real file in `dist/` *and* that the target declares the reverse link. Fails the check if any pair is one-directional. This is the item most likely to go wrong, so it gets a script, not an eyeball.
- Canonical correctness: every page self-canonical, absolute, trailing-slash consistent.
- JSON-LD: every block parsed as JSON, validated against Schema.org, run through the Rich Results Test; report what validates but is ineligible.
- Sitemap: URL count, alternates, no template routes.
- **Zero visual diff:** byte-diff `dist/**/*.html` from `<body>` to `</html>` before vs after. Non-empty diff on a T1 commit = the commit is wrong. I will also do headless screenshot comparison across the 14 routes at 3 viewports if the tooling installs cleanly in this environment; I have not yet verified that it will, so I am not promising it.
- Live redirect re-check once the nginx fix is applied.

---

**Awaiting your review. No code will be written until you approve a tier and tell me the order.**

---

## 10. What actually shipped — 9 August 2026

Nine commits on `seo-implementation`. Everything verified against a clean build.

| Phase | Commit | Delivered |
|---|---|---|
| 1 | `0dd5a4f` | Removed the starter blog (6 indexed Lorem-ipsum pages) + 6 orphaned template components; `public/robots.txt` with AI crawlers explicitly allowed; sitemap `changefreq`/`priority`, template routes filtered, locale codes aligned; `trailingSlash: 'always'` |
| 2 | `bf2f0a7` | `src/components/SEO.astro`, `src/seo/routes.ts`, `src/seo/business.ts`; conditional hreflang; `pt-PT`; full OG + Twitter; robots meta |
| 3 | `8c6ec7a` | 14 unique titles ≤60 and descriptions ≤155, both languages; `metaTitle`/`metaDescription` split from the visible property description |
| 4 | `c95b82f` | Connected `@graph` on every page — 74 nodes; `LodgingBusiness`, `WebSite`, `WebPage`, `BreadcrumbList` ×12, `Apartment` ×6, `Offer` ×6; no `aggregateRating` |
| 5 | `762f9d9` | Alt text for all 25 property images in both languages, written from the photos; 2 factually wrong captions corrected; `/guide/` stock images marked decorative |
| 6 | `d921a47` | 8 × 1200×630 OG images + `scripts/generate-og-images.mjs` (sharp, zero new dependencies) |
| 7 | `020f93f` | Inter self-hosted (48 kB, latin subset only); Google Fonts `@import` and both `preconnect`s removed; Atkinson config deleted |
| 8 | `ddf8baa` | All 220 internal links trailing-slashed; real Facebook URL; `inert` on the mobile drawer; active-nav comparison fixed (**the one approved visible change**) |
| — | `0f0ece7` | `npm run verify` — four post-build regression checks |

### Deviations from the plan above

- **§3 `Organization.logo` is omitted.** There is no logo image in this repo — the header logo is CSS-styled text. Same reason no branded-text OG card was produced.
- **§3 `sameAs` ships with two URLs**, not five: the Facebook page and the Booking.com listing. Instagram, Airbnb and Vrbo are still missing.
- **§5 source image files were not renamed.** The rename is invisible and still worth doing, but naming 25 files honestly needs you to confirm what several of them show. The alt text — the part that actually carries meaning — is done.
- **§5 OG images are one per route, not one per route per language.** The photograph does not change with language; only the alt text is translated. Eight files instead of sixteen.
- **§6 `rel="noopener"` needed no change** — it was already present on both footer social links.
- **§7 analytics was not implemented.** It adds a third-party host and depends on your Plausible-vs-Umami decision and a hostname.
- **§5 LCP preload was not added separately** — Astro's `<Font preload>` now preloads the font, which was the actual critical-path blocker. The hero already had `fetchpriority="high"`.

### Verification, on a clean build

```
npm run build   →  14 pages, exit 0, no warnings
npm run verify  →  hreflang  PASS   canonicals self-referencing, every target exists,
                                    all pairs reciprocal, sitemap agrees with HTML
                   meta      PASS   14 unique titles ≤60, descriptions ≤155
                   jsonld    PASS   all parses, @ids resolve, required fields present,
                                    no aggregateRating, no placeholders
                   alt       PASS   57 images, 0 missing the attribute
```

**Zero visual diff:** with `<script>` blocks stripped and `href`/`alt`/`inert` masked, the rendered DOM of all 14 pages is byte-identical to the pre-change build — same elements, classes, inline styles and visible text. The single intended exception is the nav highlight, which is applied at runtime by script and was approved in advance.
