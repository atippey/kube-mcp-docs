import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const source = join(distDir, 'sitemap-index.xml');
const target = join(distDir, 'sitemap.xml');

if (!existsSync(source)) {
  throw new Error(`Expected ${source} to exist after build`);
}

copyFileSync(source, target);
console.log('Created sitemap alias:', target);
