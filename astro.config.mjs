import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { codeBlocks } from './src/plugins/code-blocks.mjs';
import { articleImages } from './src/plugins/article-images.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://hboutale.me',
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    processor: unified({ rehypePlugins: [codeBlocks, articleImages] }),
  },
});
