/**
 * Post-build SEO regression checks. Run against dist/ after `npm run build`:
 *
 *   npm run verify
 *
 * Each check exits non-zero on failure, so this is safe to wire into CI. They
 * exist because the defects they guard against are silent: a broken hreflang
 * pair, a duplicate meta description or a stray aggregateRating all build fine
 * and only show up weeks later in Search Console.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const checks = [
  ['hreflang', 'canonicals, hreflang reciprocity, sitemap agreement'],
  ['meta', 'title/description presence, length limits, uniqueness'],
  ['jsonld', 'JSON-LD validity, @id resolution, no self-serving ratings'],
  ['alt', 'alt coverage and quality'],
];

let failed = 0;
for (const [name, what] of checks) {
  console.log(`\n──── ${name}: ${what} ────`);
  const r = spawnSync(process.execPath, [resolve(HERE, `${name}.mjs`)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll SEO checks passed.');
process.exit(failed ? 1 : 0);
