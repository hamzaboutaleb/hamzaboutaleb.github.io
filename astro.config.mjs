import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { codeBlocks } from './src/plugins/code-blocks.mjs';
import { articleImages } from './src/plugins/article-images.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://hamzaboutaleb.github.io',
  output: 'static',
  markdown: {
    processor: unified({ rehypePlugins: [codeBlocks, articleImages] }),
  },
});
