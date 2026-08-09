// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://ramalhoapartments.com',
  output: 'static',

  // The origin serves directory-style URLs (/properties/ -> /properties/index.html).
  // Making that explicit keeps Astro.url, internal links and canonicals consistent
  // between dev and production, and stops non-slash URLs bouncing through redirects.
  trailingSlash: 'always',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pt'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        // Must match the hreflang codes emitted by src/components/SEO.astro,
        // otherwise Google receives two conflicting sets of language annotations.
        locales: {
          en: 'en',
          pt: 'pt-PT',
        },
      },
      serialize(item) {
        const path = new URL(item.url).pathname;
        const at = (...suffixes) => suffixes.some((s) => path.endsWith(s));

        if (path === '/' || path === '/pt/') {
          return { ...item, changefreq: 'weekly', priority: 1.0 };
        }
        if (at('/properties/')) {
          return { ...item, changefreq: 'weekly', priority: 0.9 };
        }
        if (at('/ramalho/', '/amorim/', '/amorim-duplex/')) {
          return { ...item, changefreq: 'weekly', priority: 0.9 };
        }
        if (at('/about/')) {
          return { ...item, changefreq: 'monthly', priority: 0.6 };
        }
        return { ...item, changefreq: 'monthly', priority: 0.5 };
      },
    }),
  ],

  // Inter, self-hosted. It used to be pulled in with an @import to
  // fonts.googleapis.com from the top of global.css, which blocked rendering
  // behind a three-hop chain (HTML -> CSS -> Google CSS -> woff2) and sent every
  // visitor's IP to Google without consent. Inter ships as a variable font, so
  // one file covers weights 400-700.
  //
  // Only the `latin` subset is registered: a scan of the rendered text found no
  // characters in the latin-ext ranges, and Astro preloads every variant, so
  // shipping it would add 85 kB of preload to each page for nothing. If content
  // ever needs those glyphs, re-add the inter-latin-ext.woff2 variant.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/inter-latin.woff2'],
            weight: '400 700',
            style: 'normal',
            display: 'swap',
            unicodeRange: [
              'U+0000-00FF', 'U+0131', 'U+0152-0153', 'U+02BB-02BC', 'U+02C6',
              'U+02DA', 'U+02DC', 'U+0304', 'U+0308', 'U+0329', 'U+2000-206F',
              'U+20AC', 'U+2122', 'U+2191', 'U+2193', 'U+2212', 'U+2215',
              'U+FEFF', 'U+FFFD',
            ],
          },
        ],
      },
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});