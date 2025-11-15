import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'static',
  outDir: '../docs',
  site: 'https://waypoint-framework.github.io/waypoint',
  base: '/waypoint/',
  build: {
    format: 'file'
  },
  integrations: [
    mdx(),
    tailwind({
      applyBaseStyles: false
    })
  ]
});
