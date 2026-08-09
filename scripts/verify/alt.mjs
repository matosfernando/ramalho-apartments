import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
function walk(d, a = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, a);
    else if (e.endsWith('.html')) a.push(p);
  }
  return a;
}
const dec = (s) => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const fail = [];
let total = 0, empty = 0, described = 0;
const seen = new Map();

for (const f of walk(DIST).sort()) {
  const url = '/' + relative(DIST, f).replace(/index\.html$/, '').replace(/\\/g, '/');
  const html = readFileSync(f, 'utf8');
  for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
    total++;
    const m = tag.match(/\salt="([^"]*)"/);
    const bare = /\salt(?=[\s/>])/.test(tag);
    if (!m && !bare) { fail.push(`${url}: <img> with NO alt attribute: ${tag.slice(0, 110)}`); continue; }
    const alt = m ? dec(m[1]) : '';
    if (alt === '') { empty++; continue; }
    described++;
    if (/–\s*photo\s*\d+$/i.test(alt) || /^photo \d+/i.test(alt))
      fail.push(`${url}: indexed placeholder alt still present: "${alt}"`);
    if (alt.length < 15) fail.push(`${url}: suspiciously short alt: "${alt}"`);
    if (/ramalho apartments\s*$/i.test(alt) && alt.split(' ').length < 8)
      fail.push(`${url}: brand-stuffed alt: "${alt}"`);
    const key = `${url}|${alt}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
}
for (const [k, n] of seen) if (n > 1) fail.push(`duplicate alt used ${n}× on one page: ${k}`);

console.log(`images: ${total}   described: ${described}   deliberate alt="": ${empty}   missing attribute: ${total - described - empty}`);
console.log('');
if (fail.length) { console.log(`FAILED — ${fail.length}:`); fail.forEach((x) => console.log('  ✗ ' + x)); process.exit(1); }
console.log('PASS — every image has an alt attribute; no indexed placeholders, no brand stuffing, no per-page duplicates.');
