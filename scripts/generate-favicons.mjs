/**
 * Generate favicon.ico and apple-touch-icon.png from public/favicon.svg.
 *
 * Run manually and commit the output:   node scripts/generate-favicons.mjs
 *
 * favicon.ico previously shipped as the Astro framework's logo, left over from
 * the starter template, and that is what browsers showed in the tab — Chrome
 * prefers the .ico over the .svg when both are declared. The SVG was already
 * the correct "R." brand mark, so these are generated from it.
 *
 * Uses sharp, already a dependency. The ICO is assembled here because the
 * format is trivial and it avoids adding an image-encoding package for one file.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

// The SVG carries a prefers-color-scheme block so it adapts on its own. ICO and
// PNG cannot, so the static files are rendered from the light variant.
const svg = readFileSync(resolve(PUBLIC, 'favicon.svg'), 'utf8');
const light = Buffer.from(svg.replace(/<style>[\s\S]*?<\/style>/, ''));

const render = (size, flatten = false) => {
  let p = sharp(light, { density: 600 }).resize(size, size);
  if (flatten) p = p.flatten({ background: '#ffffff' });
  return p.png({ compressionLevel: 9 }).toBuffer();
};

/**
 * Minimal ICO container around PNG payloads. Every browser in use supports
 * PNG-compressed ICO entries.
 *
 * Layout: 6-byte header, then one 16-byte directory entry per image, then the
 * image data. A width/height byte of 0 means 256.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette size (0 = no palette)
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const SIZES = [16, 32, 48];
const images = [];
for (const size of SIZES) images.push({ size, data: await render(size) });

const ico = buildIco(images);
writeFileSync(resolve(PUBLIC, 'favicon.ico'), ico);
console.log(`favicon.ico          ${String(ico.length).padStart(5)} bytes  (${SIZES.join(', ')} px)`);

// iOS uses this for home-screen bookmarks. Without it the icon is a screenshot
// of the page. Must be opaque: iOS renders transparency as black.
const apple = await render(180, true);
writeFileSync(resolve(PUBLIC, 'apple-touch-icon.png'), apple);
console.log(`apple-touch-icon.png ${String(apple.length).padStart(5)} bytes  (180 px, opaque)`);
