import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { imageMetadata } from 'astro/assets/utils';

export function articleImages() {
  return async tree => {
    const images = [];
    const walk = node => {
      if (node.type === 'element' && node.tagName === 'img') images.push(node);
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
    const publicRoot = resolve('public');
    await Promise.all(images.map(async node => {
      const properties = node.properties ??= {};
      properties.loading ??= 'lazy';
      properties.decoding ??= 'async';
      const src = properties.src;
      if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//')) return;
      if (Number(properties.width) > 0 && Number(properties.height) > 0) return;
      const pathname = decodeURIComponent(src.split(/[?#]/)[0]);
      const path = resolve(publicRoot, `.${pathname}`);
      if (!path.startsWith(`${publicRoot}${sep}`)) throw new Error(`Article image must be inside public/: ${src}`);
      const metadata = await imageMetadata(await readFile(path), src);
      const width = Number(properties.width);
      const height = Number(properties.height);
      properties.width = width > 0 ? width : height > 0 ? Math.round(height * metadata.width / metadata.height) : metadata.width;
      properties.height = height > 0 ? height : width > 0 ? Math.round(width * metadata.height / metadata.width) : metadata.height;
    }));
  };
}
