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
const rows = [];
for (const f of walk(DIST).sort()) {
  const h = readFileSync(f, 'utf8');
  rows.push({
    url: '/' + relative(DIST, f).replace(/index\.html$/, '').replace(/\\/g, '/'),
    title: dec((h.match(/<title>([^<]*)<\/title>/) || [])[1] ?? ''),
    desc: dec((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ''),
  });
}
const fail = [];
console.log('URL                    TITLE                                                       LEN  DESC');
for (const r of rows) {
  const tl = r.title.length, dl = r.desc.length;
  if (tl === 0) fail.push(`${r.url}: no title`);
  if (dl === 0) fail.push(`${r.url}: no description`);
  if (tl > 60) fail.push(`${r.url}: title ${tl} chars (>60)`);
  if (dl > 155) fail.push(`${r.url}: description ${dl} chars (>155)`);
  console.log(`${r.url.padEnd(22)} ${r.title.padEnd(60).slice(0, 60)} ${String(tl).padStart(3)}  ${String(dl).padStart(3)}`);
}
for (const key of ['title', 'desc']) {
  const seen = new Map();
  for (const r of rows) {
    const v = r[key];
    if (seen.has(v)) fail.push(`duplicate ${key}: ${r.url} and ${seen.get(v)} share "${v.slice(0, 60)}..."`);
    else seen.set(v, r.url);
  }
}
console.log('');
if (fail.length) { console.log('FAILED:'); fail.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS — ${rows.length} pages: all titles ≤60, all descriptions ≤155, all unique.`);
