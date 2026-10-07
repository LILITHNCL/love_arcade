#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const repoRoot = path.resolve(root.pathname);

const removedDocs = [
  'docs/DOCUMENTACION.md',
  'docs/player-hub.md',
  'docs/player-hub-v2.md',
  'docs/rediseno-tienda.md',
  'docs/shop-catalog-migration.md',
  'docs/material-expressive-design-audit.md',
];

const markdownFiles = [];

function walk(currentDir) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.md')) {
      markdownFiles.push(fullPath);
    }
  }
}

walk(repoRoot);

const issues = [];

const legacyTerms = [
  ['js/streak-', 'hub.js'].join(''),
  ['streak-', 'flame'].join(''),
  ['streak-', 'flame__svg'].join(''),
  ['flame-', 'layer'].join(''),
  ['flameSway', 'Back'].join(''),
  ['flameSway', 'Mid'].join(''),
  ['flameSway', 'Core'].join(''),
  ['flame', 'Burst'].join(''),
  ['flame', 'Outer'].join(''),
  ['flame', 'Core'].join(''),
  ['streak', 'Pulse'].join(''),
  ['streak-', 'coin-burst'].join(''),
  /(?:^|\/)streak\\.riv(?:$|[^a-z-])/.source,
  ['https://unpkg.com/@rive-app/', 'canvas'].join(''),
];

const textualExtensions = new Set(['.html', '.css', '.js', '.mjs', '.md', '.json', '.webmanifest']);

function walkTextFiles(currentDir) {
  const files = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) files.push(...walkTextFiles(fullPath));
    else if (entry.isFile() && textualExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

for (const filePath of walkTextFiles(repoRoot)) {
  const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  if (relPath === 'tests/documentation-static-qa.mjs' || relPath === 'implementación.md') continue;
  const fileText = fs.readFileSync(filePath, 'utf8');
  for (const legacyTerm of legacyTerms) {
    if (fileText.includes(legacyTerm)) issues.push(`${relPath}: legacy streak reference remains: ${legacyTerm}`);
  }
}

for (const filePath of markdownFiles) {
  const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const fileText = fs.readFileSync(filePath, 'utf8');

  for (const removedFile of removedDocs) {
    if (fileText.includes(removedFile)) {
      issues.push(`${relPath}: still references removed document ${removedFile}`);
    }
  }

  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(fileText)) !== null) {
    const target = match[1].trim();
    if (!target || target.startsWith('#') || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('tel:') || target.startsWith('data:')) {
      continue;
    }

    const normalizedTarget = target.replace(/^[<>]/, '').split('#')[0].split('?')[0];
    if (!normalizedTarget) {
      continue;
    }

    const candidate = normalizedTarget.startsWith('/')
      ? path.join(repoRoot, normalizedTarget.replace(/^\//, ''))
      : path.resolve(path.dirname(filePath), normalizedTarget);

    if (!fs.existsSync(candidate)) {
      issues.push(`${relPath}: broken relative link -> ${target}`);
    }
  }
}

if (issues.length > 0) {
  console.error('Documentation static QA failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

const architecture = fs.readFileSync(path.join(repoRoot, 'docs/ARCHITECTURE.md'), 'utf8');
const streakDoc = fs.readFileSync(path.join(repoRoot, 'docs/sistema-racha-diaria.md'), 'utf8');
const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

if (!readme.includes('Rive Web runtime 2.44.0') || !readme.includes('self-hosted')) {
  issues.push('README.md: missing Rive 2.44.0 self-hosted runtime documentation');
}
for (const required of ['IntersectionObserver', 'visibilitychange', 'ResizeObserver', 'ViewModel', 'available', 'claimed', 'cleanup']) {
  if (!architecture.includes(required)) issues.push(`docs/ARCHITECTURE.md: missing Streak Hub contract: ${required}`);
}
for (const required of ['gamecenter_v6_promos', 'daily.lastClaim', 'daily.streak', 'repairAvailable', 'canAffordRepair', 'Pop', '620 ms', '0.75x', 'RIESGO NO VERIFICADO', 'LoveArcadeTime', 'Dynamic streak fire', 'aristote', 'CC BY']) {
  if (!streakDoc.includes(required)) issues.push(`docs/sistema-racha-diaria.md: missing T3 documentation: ${required}`);
}

const docCount = markdownFiles.length;
console.log(`Documentation static QA passed: ${docCount} Markdown files checked, no broken links or references to removed historical docs.`);
