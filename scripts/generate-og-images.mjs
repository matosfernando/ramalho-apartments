/**
 * Generate the 1200x630 social-preview images in public/og/.
 *
 * Run manually and commit the output:   node scripts/generate-og-images.mjs
 *
 * Uses sharp, which is already a dependency (Astro's image pipeline needs it),
 * so this adds nothing to package.json, nothing to the build, and nothing to
 * page weight. Output is committed, so a deploy never has to regenerate it.
 *
 * Re-run only when the source photographs change.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/og');
const src = (p) => resolve(ROOT, 'src/assets', p);

/** One image per route. Language does not change the picture, so EN and PT share. */
const IMAGES = [
  { name: 'home',          from: 'images/header 2026-05-03_200655.jpg' },
  { name: 'properties',    from: 'properties/ramalho/IMG_5767.jpeg' },
  { name: 'ramalho',       from: 'properties/ramalho/IMG_5764.jpeg' },
  { name: 'amorim',        from: 'properties/amorim/Screenshot 2026-05-03 145515.png' },
  { name: 'amorim-duplex', from: 'properties/duplex/Screenshot 2026-05-03 145842.png' },
  { name: 'about',         from: 'images/pexels-ihor-lypnytskyi-117692765-17162633.jpg' },
  { name: 'faq',           from: 'properties/ramalho/IMG_5759.jpeg' },
  { name: 'guide',         from: 'images/Presentation1.png' },
];

mkdirSync(OUT, { recursive: true });

let bytes = 0;
for (const { name, from } of IMAGES) {
  const dest = resolve(OUT, `${name}.jpg`);
  const info = await sharp(src(from))
    .rotate() // honour EXIF orientation; some source photos are stored sideways
    .resize(1200, 630, { fit: 'cover', position: sharp.strategy.attention })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toFile(dest);
  bytes += info.size;
  console.log(`${`${name}.jpg`.padEnd(22)} ${String(Math.round(info.size / 1024)).padStart(4)} kB   <- ${from}`);
}
console.log(`\n${IMAGES.length} images, ${Math.round(bytes / 1024)} kB total, written to public/og/`);
