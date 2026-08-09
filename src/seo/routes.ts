/**
 * Route manifest — which pages exist, in which languages.
 *
 * This is what makes hreflang correct by construction. Previously every page
 * unconditionally claimed a Portuguese twin, so /faq/ and /guide/ advertised
 * /pt/faq/ and /pt/guide/ — both of which 404. Google can discard an entire
 * hreflang cluster over a broken return link, which put the six genuinely
 * paired routes at risk too.
 *
 * `pt: null` means "no Portuguese version exists". No alternate is emitted for
 * it, and the language switcher falls back to the Portuguese homepage instead
 * of linking to a dead URL. When a translation is added, change the null here
 * and the annotations follow automatically.
 */

export type Locale = 'en' | 'pt';

export interface RouteDef {
  readonly en: string;
  readonly pt: string | null;
}

export const ROUTES = {
  home:       { en: '/',               pt: '/pt/' },
  properties: { en: '/properties/',    pt: '/pt/properties/' },
  ramalho:    { en: '/ramalho/',       pt: '/pt/ramalho/' },
  amorim:     { en: '/amorim/',        pt: '/pt/amorim/' },
  duplex:     { en: '/amorim-duplex/', pt: '/pt/amorim-duplex/' },
  about:      { en: '/about/',         pt: '/pt/about/' },
  faq:        { en: '/faq/',           pt: null },
  guide:      { en: '/guide/',         pt: null },
} as const satisfies Record<string, RouteDef>;

export type RouteKey = keyof typeof ROUTES;

/** Force a pathname into the trailing-slash form the origin actually serves. */
export function normalisePath(pathname: string): string {
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/** Resolve a pathname back to its route entry, or null if it is not a known page. */
export function findRoute(
  pathname: string,
): { key: RouteKey; locale: Locale; def: RouteDef } | null {
  const path = normalisePath(pathname);
  for (const [key, def] of Object.entries(ROUTES) as [RouteKey, RouteDef][]) {
    if (def.en === path) return { key, locale: 'en', def };
    if (def.pt === path) return { key, locale: 'pt', def };
  }
  return null;
}

export interface Alternate {
  hreflang: string;
  path: string;
}

/**
 * hreflang annotations for a page.
 *
 * Returns an empty list when the page has no translation: an hreflang cluster
 * of one carries no information, and staying silent keeps the HTML consistent
 * with the sitemap, which already omits alternates for these routes.
 */
export function alternatesFor(pathname: string): Alternate[] {
  const route = findRoute(pathname);
  if (!route || route.def.pt === null) return [];

  return [
    { hreflang: 'en', path: route.def.en },
    { hreflang: 'pt-PT', path: route.def.pt },
    // English is the default locale, so it is also the fallback for any
    // language we do not explicitly target.
    { hreflang: 'x-default', path: route.def.en },
  ];
}

/**
 * Where the language switcher should point. Falls back to the target locale's
 * homepage when the current page has no translation, so the switcher never
 * links to a 404.
 */
export function switcherPath(pathname: string, target: Locale): string {
  const route = findRoute(pathname);
  if (route) {
    const dest = route.def[target];
    if (dest) return dest;
  }
  return target === 'pt' ? '/pt/' : '/';
}
