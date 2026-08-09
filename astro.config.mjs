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

  fonts: [
      {
          provider: fontProviders.local(),
          name: 'Atkinson',
          cssVariable: '--font-atkinson',
          fallbacks: ['sans-serif'],
          options: {
              variants: [
                  {
                      src: ['./src/assets/fonts/atkinson-regular.woff'],
                      weight: 400,
                      style: 'normal',
                      display: 'swap',
                  },
                  {
                      src: ['./src/assets/fonts/atkinson-bold.woff'],
                      weight: 700,
                      style: 'normal',
                      display: 'swap',
                  },
              ],
          },
      },
	],

  vite: {
    plugins: [tailwindcss()],
  },
});