#!/usr/bin/env node
// Builds the single-file CLI served at https://tryflash.app/agents/flash/flash-cli.mjs (viem and the contract data inlined).
//   node bundle.mjs <output file>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('usage: node bundle.mjs <output file>');
// esbuild ships with the web client's build tools.
const { build } = createRequire(join(here, '..', '..', '..', 'app', 'package.json'))('esbuild');
const inlines = [
  { file: /lib[\\/]contracts\.mjs$/, read: /JSON\.parse\(readFileSync\(join\(here, '\.\.', '\.\.', 'known-contracts\.json'\), 'utf8'\)\)/, data: join(here, '..', 'known-contracts.json') },
  { file: /lib[\\/]plan\.mjs$/, read: /JSON\.parse\(readFileSync\(new URL\('\.\/errors\.json', import\.meta\.url\), 'utf8'\)\)/, data: join(here, 'lib', 'errors.json') },
];

await build({
  entryPoints: [join(here, 'flash.mjs')],
  outfile: output,
  bundle: true,
  minify: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  banner: { js: '// Flash CLI: read-only views and UNSIGNED transaction plans on Base. It never signs, holds keys or broadcasts.\n// Help: node flash-cli.mjs help. Docs: https://tryflash.app/agents/flash/SKILL.md' },
  plugins: [{
    name: 'inline-json',
    setup(pluginBuild) {
      for (const { file, read, data } of inlines) {
        pluginBuild.onLoad({ filter: file }, (args) => {
          const source = readFileSync(args.path, 'utf8');
          const inlined = source.replace(read, () => readFileSync(data, 'utf8').trim());
          if (inlined === source) throw new Error(`${args.path} no longer reads ${data} the expected way`);
          return { contents: inlined, loader: 'js' };
        });
      }
    },
  }],
});

const built = readFileSync(output, 'utf8');
writeFileSync(output, built.replaceAll('node flash.mjs ', 'node flash-cli.mjs '));
