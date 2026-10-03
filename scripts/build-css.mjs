import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const layers = ['tokens', 'base', 'layout', 'components', 'features', 'utilities', 'overrides'];
const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const stylesRoot = join(projectRoot, 'styles');
const outputPath = resolve(projectRoot, process.argv[2] ?? 'styles.css');

function listCssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) return listCssFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : [];
    });
}

function buildLayer(layer) {
  const layerDirectory = join(stylesRoot, layer);
  const files = listCssFiles(layerDirectory);
  const contents = files
    .map((file) => {
      const source = readFileSync(file, 'utf8').trimEnd();
      return `  /* Source: styles/${relative(stylesRoot, file).replaceAll('\\', '/')} */\n${source.split('\n').map((line) => `  ${line}`).join('\n')}`;
    })
    .join('\n\n');

  return `@layer ${layer} {\n${contents}\n}`;
}

const output = [
  '/* GENERADO — no editar a mano, ver styles/ y scripts/build-css.mjs */',
  `@layer ${layers.join(', ')};`,
  ...layers.map(buildLayer),
  '',
].join('\n\n');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output, 'utf8');
