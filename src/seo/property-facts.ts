/**
 * Locale-independent structured facts about each unit.
 *
 * Split from src/i18n/properties.ts because these are measurements, not copy:
 * they are identical in every language, and duplicating them per locale is how
 * the two versions drift apart.
 *
 * Only values evidenced by the site's own content appear here. Fields listed in
 * PENDING are deliberately absent — an omitted property is valid Schema.org and
 * costs nothing, whereas a guessed bed count or coordinate is a false claim in
 * machine-readable form.
 */
import type { RouteKey } from './routes';

export interface PropertyFacts {
  routeKey: RouteKey;
  streetAddress: string;
  numberOfBedrooms: number;
  numberOfBathroomsTotal: number;
  maxOccupancy: number;
  /** Nightly price floor in EUR, if the site publishes one. */
  price?: number;
  /** Minimum stay in nights, if the site states one. */
  minimumNights?: number;
  /** Not yet open for bookings. */
  preOrder?: boolean;
  /** ISO date the unit becomes bookable. Supplied by the owner. */
  availabilityStarts?: string;
}

export const PROPERTY_FACTS = {
  ramalho: {
    routeKey: 'ramalho',
    streetAddress: 'Rua Rodrigo Rodrigues 4',
    numberOfBedrooms: 3,
    numberOfBathroomsTotal: 2,
    maxOccupancy: 6,
    price: 80,
    minimumNights: 2,
  },
  amorim: {
    routeKey: 'amorim',
    streetAddress: 'Rua do Amorim 15',
    numberOfBedrooms: 2,
    numberOfBathroomsTotal: 1,
    maxOccupancy: 6,
    preOrder: true,
    availabilityStarts: '2026-10-01',
  },
  duplex: {
    routeKey: 'duplex',
    streetAddress: 'Rua do Amorim 15',
    numberOfBedrooms: 2,
    numberOfBathroomsTotal: 2,
    maxOccupancy: 6,
    preOrder: true,
    availabilityStarts: '2026-10-01',
  },
} as const satisfies Record<string, PropertyFacts>;

export type PropertySlug = keyof typeof PROPERTY_FACTS;

/**
 * PENDING — see "Information I need from you" in SEO-AUDIT.md:
 *
 *   geo                     no coordinates anywhere in the repo; the map embeds
 *                           use a text query, so nothing usable is stored
 *   postalCode              street and number only
 *   numberOfBeds            the amorim units state "2 beds / sleeps 6", which
 *                           cannot both be true; the real inventory is unknown
 *   numberOfRooms           total rooms, not just bedrooms
 *   floorSize               m² per unit
 *   checkinTime/checkoutTime  the FAQ says 15:00 / 11:00, but that is EN-only
 *                           marketing copy and needs confirming as authoritative
 *   petsAllowed             FAQ says "generally yes"; schema needs a boolean
 *   smokingAllowed          not stated anywhere
 *   parking                 the FAQ claims parking exists but no unit lists it
 *                           as an amenity, so it is not asserted here
 *   price (amorim, duplex)  no rate published for the pre-launch units
 */
