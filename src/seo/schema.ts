/**
 * JSON-LD builders.
 *
 * Emits one connected @graph per page, with nodes joined by @id rather than a
 * pile of disconnected islands — that is what lets a search engine understand
 * "this page is about that apartment, which belongs to this business".
 *
 * Deliberately NOT emitted: aggregateRating. The site shows a 9.3 sourced from
 * Booking.com. Marking a rating we transcribed onto our own LodgingBusiness is
 * self-serving review markup under Google's structured data policy and risks a
 * manual action. It stays visible text.
 */
import { SITE_URL, BUSINESS } from './business';
import { ROUTES, type Locale, type RouteKey } from './routes';
import { PROPERTY_FACTS, type PropertySlug } from './property-facts';

type Node = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

const abs = (path: string) => `${SITE_URL}${path}`;

/**
 * Node @ids are locale-independent, always derived from the English path.
 * The EN and PT pages describe the same physical apartment, so they must
 * reference one node — not two that a search engine would treat as two
 * different flats.
 */
export const apartmentId = (slug: PropertySlug) =>
  `${abs(ROUTES[PROPERTY_FACTS[slug].routeKey].en)}#apartment`;
export const offerId = (slug: PropertySlug) =>
  `${abs(ROUTES[PROPERTY_FACTS[slug].routeKey].en)}#offer`;

/** Drop keys whose value is undefined, so unknown facts simply do not appear. */
function compact(node: Node): Node {
  return Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined));
}

const postalAddress = (streetAddress: string, postalCode?: string): Node =>
  compact({
    '@type': 'PostalAddress',
    streetAddress,
    addressLocality: BUSINESS.address.addressLocality,
    addressRegion: BUSINESS.address.addressRegion,
    postalCode,
    addressCountry: BUSINESS.address.addressCountry,
  });

const geoPoint = (geo?: { latitude: number; longitude: number }): Node | undefined =>
  geo && { '@type': 'GeoCoordinates', latitude: geo.latitude, longitude: geo.longitude };

/** The business itself. Present on every page. */
export function organisationNode(): Node {
  return compact({
    '@type': 'LodgingBusiness',
    '@id': ORG_ID,
    name: BUSINESS.name,
    url: BUSINESS.url,
    telephone: BUSINESS.telephone,
    email: BUSINESS.email,
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    address: postalAddress(BUSINESS.address.streetAddress),
    geo: geoPoint(PROPERTY_FACTS.ramalho.geo),
    areaServed: { '@type': 'AdministrativeArea', name: 'São Miguel, Azores' },
    sameAs: [...BUSINESS.sameAs],
    containsPlace: (Object.keys(PROPERTY_FACTS) as PropertySlug[]).map((slug) => ({
      '@id': apartmentId(slug),
    })),
    // logo / image omitted: no logo asset exists in this repo yet
  });
}

export function websiteNode(): Node {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: BUSINESS.url,
    name: BUSINESS.name,
    publisher: { '@id': ORG_ID },
    inLanguage: ['en', 'pt-PT'],
  };
}

export function webPageNode(path: string, locale: Locale, title: string, about?: string): Node {
  return compact({
    '@type': 'WebPage',
    '@id': `${abs(path)}#webpage`,
    url: abs(path),
    name: title,
    isPartOf: { '@id': SITE_ID },
    about: about ? { '@id': about } : undefined,
    inLanguage: locale === 'pt' ? 'pt-PT' : 'en',
  });
}

export interface Crumb {
  name: string;
  path?: string;
}

/** Breadcrumbs. The final crumb has no `item` — it is the current page. */
export function breadcrumbNode(path: string, crumbs: Crumb[]): Node {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${abs(path)}#breadcrumb`,
    itemListElement: crumbs.map((c, i) =>
      compact({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: c.path ? abs(c.path) : undefined,
      }),
    ),
  };
}

/**
 * Amenity names come straight from the property's own visible amenity list, so
 * the markup can never claim something the page does not show. Entries that are
 * really room counts ("3 bedrooms", "2 casas de banho") are filtered out — those
 * are expressed properly as numberOfBedrooms / numberOfBathroomsTotal.
 */
const COUNT_LIKE = /^\d+\s+(bedrooms?|bathrooms?|quartos?|casas? de banho)$/i;

export interface ApartmentInput {
  slug: PropertySlug;
  locale: Locale;
  name: string;
  description: string;
  path: string;
  images: string[];
  amenities: readonly { name: string }[];
}

export function apartmentNode(input: ApartmentInput): Node {
  const f = PROPERTY_FACTS[input.slug];
  return compact({
    '@type': ['Apartment', 'Accommodation'],
    '@id': apartmentId(input.slug),
    name: input.name,
    description: input.description,
    url: abs(input.path),
    image: input.images.length ? input.images : undefined,
    address: postalAddress(f.streetAddress, f.postalCode),
    geo: geoPoint(f.geo),
    numberOfBedrooms: f.numberOfBedrooms,
    numberOfBeds: f.numberOfBeds,
    numberOfBathroomsTotal: f.numberOfBathroomsTotal,
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: f.maxOccupancy,
      unitCode: 'C62', // UN/CEFACT code for "one" (a count of people)
    },
    amenityFeature: input.amenities
      .filter((a) => !COUNT_LIKE.test(a.name))
      .map((a) => ({
        '@type': 'LocationFeatureSpecification',
        name: a.name,
        value: true,
      })),
    containedInPlace: { '@id': ORG_ID },
    // numberOfRooms, floorSize, petsAllowed, smokingAllowed, checkinTime and
    // checkoutTime are still omitted — see property-facts.ts PENDING.
  });
}

export function offerNode(slug: PropertySlug): Node {
  const f = PROPERTY_FACTS[slug];

  if (f.preOrder) {
    // Indexable now, but nothing here implies it can be booked today. The page
    // itself says "Opening October 2026" and offers only a notify CTA, so the
    // markup and the visible content agree. No price is asserted: none is published.
    return compact({
      '@type': 'Offer',
      '@id': offerId(slug),
      itemOffered: { '@id': apartmentId(slug) },
      priceCurrency: 'EUR',
      availability: 'https://schema.org/PreOrder',
      availabilityStarts: f.availabilityStarts,
      seller: { '@id': ORG_ID },
    });
  }

  return compact({
    '@type': 'Offer',
    '@id': offerId(slug),
    itemOffered: { '@id': apartmentId(slug) },
    priceCurrency: 'EUR',
    price: f.price !== undefined ? String(f.price) : undefined,
    availability: 'https://schema.org/InStock',
    priceSpecification:
      f.price === undefined
        ? undefined
        : compact({
            '@type': 'UnitPriceSpecification',
            price: f.price,
            priceCurrency: 'EUR',
            unitCode: 'DAY',
            referenceQuantity: f.minimumNights
              ? {
                  '@type': 'QuantitativeValue',
                  value: f.minimumNights,
                  unitCode: 'DAY',
                }
              : undefined,
          }),
    seller: { '@id': ORG_ID },
  });
}

/**
 * The nodes every page carries: the business, the website, this page, and — for
 * anything below the homepage — a breadcrumb trail.
 */
export function baseGraph(opts: {
  path: string;
  locale: Locale;
  routeKey: RouteKey | null;
  title: string;
  crumbs: Crumb[];
  about?: string;
}): Node[] {
  const nodes: Node[] = [
    organisationNode(),
    websiteNode(),
    webPageNode(opts.path, opts.locale, opts.title, opts.about),
  ];
  if (opts.crumbs.length > 1) nodes.push(breadcrumbNode(opts.path, opts.crumbs));
  return nodes;
}
