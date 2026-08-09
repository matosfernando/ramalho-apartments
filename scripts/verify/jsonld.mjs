/**
 * Validate the JSON-LD in every built page.
 *   - parses as JSON
 *   - every @id referenced somewhere is defined somewhere on the same page
 *   - required Google fields present per type
 *   - no aggregateRating anywhere (policy: no self-serving review markup)
 *   - no leftover placeholder values
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const fail = [];
function walk(d, a = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, a);
    else if (e.endsWith('.html')) a.push(p);
  }
  return a;
}
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const PLACEHOLDER = /\b(TODO|FIXME|XXX|lorem ipsum|example\.com|your-|placeholder|\bTBD\b)/i;
const typeCount = {};

// A bare {"@id": "..."} may point at a node defined on another page — that is
// valid JSON-LD and is how the business links to its apartments. So collect
// every @id defined anywhere on the site first, then require each reference to
// resolve somewhere. A reference that resolves nowhere is a genuine dangling link.
const definedSiteWide = new Set();
for (const f of walk(DIST)) {
  const html = readFileSync(f, 'utf8');
  const b = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!b) continue;
  try {
    (function collect(v) {
      if (Array.isArray(v)) return v.forEach(collect);
      if (v && typeof v === 'object') {
        if (v['@id'] && Object.keys(v).length > 1) definedSiteWide.add(v['@id']);
        Object.values(v).forEach(collect);
      }
    })(JSON.parse(decode(b[1]))['@graph']);
  } catch { /* reported below */ }
}

for (const f of walk(DIST).sort()) {
  const url = '/' + relative(DIST, f).replace(/index\.html$/, '').replace(/\\/g, '/');
  const html = readFileSync(f, 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  if (blocks.length === 0) { fail.push(`${url}: no JSON-LD`); continue; }
  if (blocks.length > 1) fail.push(`${url}: ${blocks.length} JSON-LD blocks; expected one @graph`);

  let data;
  try { data = JSON.parse(decode(blocks[0][1])); }
  catch (e) { fail.push(`${url}: JSON-LD does not parse — ${e.message}`); continue; }

  if (data['@context'] !== 'https://schema.org') fail.push(`${url}: missing/wrong @context`);
  const graph = data['@graph'];
  if (!Array.isArray(graph)) { fail.push(`${url}: no @graph array`); continue; }

  const defined = new Set();
  const referenced = new Set();
  const types = [];

  (function scan(v) {
    if (Array.isArray(v)) return v.forEach(scan);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (v['@id'] && keys.length === 1) referenced.add(v['@id']);
      else if (v['@id']) defined.add(v['@id']);
      for (const [k, val] of Object.entries(v)) {
        if (k === '@type') types.push(...[].concat(val));
        if (typeof val === 'string' && PLACEHOLDER.test(val))
          fail.push(`${url}: placeholder value in ${k}: "${val}"`);
        scan(val);
      }
    }
  })(graph);

  for (const t of new Set(types)) typeCount[t] = (typeCount[t] ?? 0) + 1;

  for (const ref of referenced)
    if (!defined.has(ref) && !definedSiteWide.has(ref))
      fail.push(`${url}: @id "${ref}" referenced but defined nowhere on the site`);

  const byType = (t) => graph.filter((n) => [].concat(n['@type']).includes(t));

  // Required-field checks
  for (const org of byType('LodgingBusiness')) {
    for (const k of ['name', 'url', 'address', 'telephone'])
      if (!org[k]) fail.push(`${url}: LodgingBusiness missing ${k}`);
    if (org.address && !org.address.addressCountry)
      fail.push(`${url}: PostalAddress missing addressCountry`);
  }
  for (const bc of byType('BreadcrumbList')) {
    const items = bc.itemListElement ?? [];
    if (items.length < 2) fail.push(`${url}: BreadcrumbList with <2 items`);
    items.forEach((it, i) => {
      if (it.position !== i + 1) fail.push(`${url}: breadcrumb position out of order at ${i}`);
      if (!it.name) fail.push(`${url}: breadcrumb item ${i} missing name`);
      if (i < items.length - 1 && !it.item)
        fail.push(`${url}: non-final breadcrumb ${i} missing item URL`);
    });
  }
  for (const apt of byType('Apartment')) {
    for (const k of ['name', 'url', 'address', 'numberOfBedrooms', 'occupancy'])
      if (apt[k] === undefined) fail.push(`${url}: Apartment missing ${k}`);
    if (apt.amenityFeature) {
      for (const a of apt.amenityFeature)
        if (/^\d+\s+(bedroom|bathroom|quarto|casa)/i.test(a.name))
          fail.push(`${url}: room count "${a.name}" markup'd as an amenity`);
    }
  }
  for (const off of byType('Offer')) {
    if (!off.priceCurrency) fail.push(`${url}: Offer missing priceCurrency`);
    if (!off.availability) fail.push(`${url}: Offer missing availability`);
    if (off.availability?.includes('PreOrder') && off.price !== undefined)
      fail.push(`${url}: PreOrder offer asserts a price it should not`);
  }

  if (JSON.stringify(graph).includes('aggregateRating'))
    fail.push(`${url}: aggregateRating present — self-serving review markup, must not ship`);
  if (JSON.stringify(graph).includes('9.3'))
    fail.push(`${url}: Booking.com rating 9.3 leaked into structured data`);

  console.log(`  ${url.padEnd(22)} ${graph.length} nodes: ${graph.map((n) => [].concat(n['@type']).join('+')).join(', ')}`);
}

console.log('\nType coverage:', Object.entries(typeCount).map(([t, c]) => `${t}×${c}`).join('  '));
console.log('');
if (fail.length) { console.log(`FAILED — ${fail.length}:`); fail.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('PASS — all JSON-LD parses, graph references resolve, required fields present, no aggregateRating, no placeholders.');
