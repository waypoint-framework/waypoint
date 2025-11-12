import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  integrations: [mdx()],
  output: 'static',
  outDir: '../docs',
  build: {
    format: 'file'
  }
});
