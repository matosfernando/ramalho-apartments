/**
 * Single source of truth for the business identity used in metadata and JSON-LD.
 *
 * Everything here is a verified fact, taken from the site's own content or
 * supplied directly by the owner. Fields we do not yet have are listed in
 * PENDING below rather than guessed at — an absent field is always better than
 * an invented one, and a wrong address or coordinate in structured data is
 * actively harmful.
 */

export const SITE_URL = 'https://ramalhoapartments.com';

export const BUSINESS = {
  name: 'Ramalho Apartments',
  url: `${SITE_URL}/`,
  telephone: '+351911031847',
  email: 'ramalhoapartments@gmail.com',
  whatsappNumber: '351911031847',

  address: {
    /** Ramalho unit — also the business's operating address. */
    streetAddress: 'Rua Rodrigo Rodrigues 4',
    addressLocality: 'Ponta Delgada',
    addressRegion: 'Azores',
    addressCountry: 'PT',
  },

  /**
   * Profiles the business demonstrably controls. Used for `sameAs`, which is how
   * search engines tie this site to the same real-world entity elsewhere.
   */
  sameAs: [
    'https://www.facebook.com/RamalhoApartments',
    'https://www.booking.com/hotel/pt/ramalho-apartments-t3-cidade-ponta-delgada.html',
    'https://www.airbnb.pt/h/ramalhoapartments',
    'https://www.vrbo.com/pt-pt/arrendamento-ferias/p10981843',
  ],
} as const;

/**
 * PENDING — supply these and the corresponding schema fields switch on
 * automatically. See "Information I need from you" in SEO-AUDIT.md.
 *
 *   postalCode        both addresses
 *   geo               latitude/longitude for both buildings
 *   logo              no logo image exists in this repo (the header logo is CSS text)
 *   checkinTime       FAQ says 15:00 / 11:00 — needs confirming as authoritative
 *   petsAllowed       FAQ says "generally yes"; schema needs a boolean
 *   smokingAllowed    not stated anywhere
 *   numberOfBeds      "2 beds / sleeps 6" cannot both be true
 *   floorSize         m² per unit
 */
