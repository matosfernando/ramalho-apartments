/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    colors: {
      'white': '#ffffff',
      'black': '#000000',
      'transparent': 'transparent',
      'azure': {
        'deep': '#1a3a52',
        'medium': '#2d5f7f',
        'light': '#4a8abc',
        'volcanic': '#4a4540',
        'volcanic-light': '#6b645e',
        'accent': '#ff6b35',
        'accent-dark': '#d85225',
      },
      'gray': {
        '50': '#f9fafb',
        '100': '#f3f4f6',
        '200': '#e5e7eb',
        '300': '#d1d5db',
        '400': '#9ca3af',
        '500': '#6b7280',
        '600': '#4b5563',
        '700': '#374151',
        '800': '#1f2937',
        '900': '#111827',
      },
    },
    extend: {},
  },
  plugins: [],
};

