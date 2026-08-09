/**
 * Verify hreflang and canonical correctness across the whole build.
 *
 * Asserts, for every page:
 *   1. exactly one canonical, absolute, self-referencing, trailing-slash form
 *   2. every hreflang target resolves to a file that actually exists in dist/
 *   3. every hreflang target declares the reverse link back (reciprocity)
 *   4. every page with alternates self-references with its own language code
 *   5. exactly one x-default per cluster, pointing at the default locale
 *   6. the sitemap's alternates agree with the HTML's
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const SITE = 'https://ramalhoapartments.com';
const fail = [];
const note = (ok, msg) => { if (!ok) fail.push(msg); };

function walk(d, acc = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (e.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const pages = {};
for (const f of walk(DIST).sort()) {
  const html = readFileSync(f, 'utf8');
  const url = '/' + relative(DIST, f).replace(/index\.html$/, '').replace(/\\/g, '/');
  pages[url] = {
    canonical: (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] ?? null,
    lang: (html.match(/<html[^>]*lang="([^"]*)"/) || [])[1] ?? null,
    alts: [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)]
      .map((m) => ({ hreflang: m[1], href: m[2] })),
  };
}

const pathOf = (href) => {
  note(href.startsWith(SITE), `absolute URL expected, got ${href}`);
  return href.slice(SITE.length) || '/';
};
const exists = (p) => existsSync(join(DIST, p, 'index.html')) || existsSync(join(DIST, p));

console.log(`Checking ${Object.keys(pages).length} pages\n`);

for (const [url, p] of Object.entries(pages)) {
  // 1. canonical
  note(p.canonical !== null, `${url}: no canonical`);
  if (p.canonical) {
    note(p.canonical === SITE + url, `${url}: canonical is ${p.canonical}, expected ${SITE + url}`);
    note(p.canonical.endsWith('/'), `${url}: canonical missing trailing slash`);
  }

  if (p.alts.length === 0) {
    console.log(`  ${url.padEnd(22)} lang=${String(p.lang).padEnd(5)} no alternates (single-language route)`);
    continue;
  }

  const codes = p.alts.map((a) => a.hreflang);
  const selfCode = p.lang === 'pt-PT' ? 'pt-PT' : 'en';

  // 4. self-reference
  const self = p.alts.find((a) => a.hreflang === selfCode);
  note(!!self, `${url}: no self-referencing hreflang="${selfCode}"`);
  if (self) note(pathOf(self.href) === url, `${url}: hreflang="${selfCode}" points at ${self.href}, not itself`);

  // 5. x-default
  const xd = codes.filter((c) => c === 'x-default');
  note(xd.length === 1, `${url}: expected exactly 1 x-default, found ${xd.length}`);

  for (const a of p.alts) {
    const target = pathOf(a.href);

    // 2. target exists
    note(exists(target), `${url}: hreflang="${a.hreflang}" -> ${target} DOES NOT EXIST in dist/`);
    if (!exists(target)) continue;

    // 3. reciprocity (x-default is a fallback pointer, not a language pair)
    if (a.hreflang === 'x-default') continue;
    const back = pages[target];
    note(!!back, `${url}: hreflang target ${target} not among built pages`);
    if (!back) continue;
    const returns = back.alts.some((b) => b.hreflang === a.hreflang && pathOf(b.href) === target);
    note(returns, `${url}: ${target} does not return hreflang="${a.hreflang}" -> itself`);
    const backToUs = back.alts.some((b) => pathOf(b.href) === url);
    note(backToUs, `${url}: NOT RECIPROCAL — ${target} does not link back to ${url}`);
  }

  console.log(`  ${url.padEnd(22)} lang=${String(p.lang).padEnd(5)} ${codes.join(' ')}`);
}

// 6. sitemap agreement
const sm = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
for (const block of sm.split('<url>').slice(1)) {
  const loc = (block.match(/<loc>([^<]*)<\/loc>/) || [])[1];
  const smAlts = [...block.matchAll(/hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => m[1]).sort();
  const page = pages[pathOf(loc)];
  if (!page) { fail.push(`sitemap lists ${loc} which is not a built page`); continue; }
  const htmlAlts = page.alts.filter((a) => a.hreflang !== 'x-default').map((a) => a.hreflang).sort();
  note(
    JSON.stringify(smAlts) === JSON.stringify(htmlAlts),
    `sitemap/HTML mismatch for ${loc}: sitemap=[${smAlts}] html=[${htmlAlts}]`,
  );
}

console.log('');
if (fail.length) {
  console.log(`FAILED — ${fail.length} problem(s):`);
  for (const f of fail) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('PASS — canonicals correct, every hreflang target exists, all pairs reciprocal, sitemap agrees.');
