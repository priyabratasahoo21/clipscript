// Build dist/: an ES module for npm and bundlers, and a standalone script
// (plain and minified) that defines window.Cueflick for plain HTML pages.

import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const banner = `/*! cueflick v${pkg.version} | MIT License | product films for software, written as data */`;

const shared = {
    entryPoints: ['src/index.js'],
    bundle: true,
    target: ['es2022', 'chrome110', 'firefox115', 'safari16.4'],
    loader: { '.css': 'text' },
    define: { __CUEFLICK_VERSION__: JSON.stringify(pkg.version) },
    banner: { js: banner },
    legalComments: 'none',
    logLevel: 'info'
};

await Promise.all([
    build({ ...shared, format: 'esm', outfile: 'dist/cueflick.mjs' }),
    build({ ...shared, format: 'iife', globalName: 'Cueflick', outfile: 'dist/cueflick.js' }),
    build({ ...shared, format: 'iife', globalName: 'Cueflick', minify: true, outfile: 'dist/cueflick.min.js' })
]);
