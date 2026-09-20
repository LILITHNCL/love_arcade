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

const docCount = markdownFiles.length;
console.log(`Documentation static QA passed: ${docCount} Markdown files checked, no broken links or references to removed historical docs.`);
