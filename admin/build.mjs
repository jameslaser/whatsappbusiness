// Bundles the admin app into ../site/admin/ (app.js, admin.css, index.html). The public site keeps working untouched.
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'site', 'admin');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(here, 'src', 'main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: join(out, 'app.js'),
  legalComments: 'none',
  logLevel: 'info'
});

copyFileSync(join(here, 'index.html'), join(out, 'index.html'));
// The admin stylesheet extends the public site's stylesheet (fonts, colours), so copy it next to it.
copyFileSync(join(here, 'admin.css'), join(out, 'admin.css'));
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('admin built ->', out, readFileSync(join(out, 'index.html'), 'utf8').length, 'bytes html');
