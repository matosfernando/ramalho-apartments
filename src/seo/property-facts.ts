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

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PropertyFacts {
  routeKey: RouteKey;
  streetAddress: string;
  postalCode?: string;
  /** Rooftop coordinates, supplied by the owner as Google Maps pins. */
  geo?: GeoPoint;
  /**
   * Count of actual beds, not sleeping capacity. Capacity lives in
   * maxOccupancy — a sofa bed adds two to capacity but only one to this.
   */
  numberOfBeds?: number;
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
    postalCode: '9500-180',
    geo: { latitude: 37.743679, longitude: -25.691076 },
    numberOfBedrooms: 3,
    // Three double bedrooms, sleeping six.
    numberOfBeds: 3,
    numberOfBathroomsTotal: 2,
    maxOccupancy: 6,
    price: 80,
    minimumNights: 2,
  },
  amorim: {
    routeKey: 'amorim',
    streetAddress: 'Rua do Amorim 15',
    postalCode: '9500-020',
    geo: { latitude: 37.7488077, longitude: -25.6669187 },
    numberOfBedrooms: 2,
    // Two double bedrooms plus a sofa bed: three beds, sleeping six.
    numberOfBeds: 3,
    numberOfBathroomsTotal: 1,
    maxOccupancy: 6,
    preOrder: true,
    availabilityStarts: '2026-10-01',
  },
  duplex: {
    routeKey: 'duplex',
    streetAddress: 'Rua do Amorim 15',
    postalCode: '9500-020',
    geo: { latitude: 37.7488077, longitude: -25.6669187 },
    numberOfBedrooms: 2,
    // One double, one twin room (two singles), plus a sofa bed: four beds
    // sleeping six. The twin room is read from the renders — confirm.
    numberOfBeds: 4,
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
