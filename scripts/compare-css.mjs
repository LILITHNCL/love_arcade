import { readFileSync } from 'node:fs';

const [leftPath, rightPath] = process.argv.slice(2);
if (!leftPath || !rightPath) {
  console.error('Usage: node scripts/compare-css.mjs <original.css> <generated.css>');
  process.exit(2);
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitTopLevel(source, separator) {
  const parts = [];
  let start = 0;
  let quote = '';
  let parenDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parenDepth += 1;
    else if (character === ')') parenDepth -= 1;
    else if (character === separator && parenDepth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function declarationMap(source) {
  const declarations = new Map();
  for (const declaration of splitTopLevel(source, ';')) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) continue;
    const property = normalize(declaration.slice(0, colonIndex));
    const value = normalize(declaration.slice(colonIndex + 1));
    if (property && value) declarations.set(property, value);
  }
  return declarations;
}

function parseRules(source, context = '', rules = new Map()) {
  let cursor = 0;
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? '')) cursor += 1;
    const headerStart = cursor;
    while (cursor < source.length && source[cursor] !== '{') cursor += 1;
    if (cursor >= source.length) break;

    const header = normalize(source.slice(headerStart, cursor));
    let depth = 1;
    const blockStart = ++cursor;
    let quote = '';
    while (cursor < source.length && depth > 0) {
      const character = source[cursor];
      if (quote) {
        if (character === '\\') cursor += 1;
        else if (character === quote) quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
      cursor += 1;
    }
    if (!header || depth !== 0) throw new Error(`Unbalanced CSS block near: ${header || '(anonymous)'}`);

    const block = source.slice(blockStart, cursor - 1);
    const nested = /\{/.test(block);
    const nextContext = context ? `${context} :: ${header}` : header;
    if (nested) {
      parseRules(block, nextContext, rules);
      continue;
    }

    const selector = header.startsWith('@') || !context ? header : nextContext;
    const declarations = declarationMap(block);
    if (declarations.size > 0) rules.set(selector, declarations);
  }
  return rules;
}

function compare(left, right) {
  const differences = [];
  const selectors = new Set([...left.keys(), ...right.keys()]);
  for (const selector of [...selectors].sort()) {
    const leftDeclarations = left.get(selector);
    const rightDeclarations = right.get(selector);
    if (!leftDeclarations) {
      differences.push(`Only in generated: ${selector}`);
      continue;
    }
    if (!rightDeclarations) {
      differences.push(`Only in original: ${selector}`);
      continue;
    }
    const properties = new Set([...leftDeclarations.keys(), ...rightDeclarations.keys()]);
    for (const property of [...properties].sort()) {
      const leftValue = leftDeclarations.get(property);
      const rightValue = rightDeclarations.get(property);
      if (leftValue !== rightValue) {
        differences.push(`${selector} → ${property}: original=${JSON.stringify(leftValue ?? null)}, generated=${JSON.stringify(rightValue ?? null)}`);
      }
    }
  }
  return differences;
}

const original = parseRules(stripComments(readFileSync(leftPath, 'utf8')));
const generated = parseRules(stripComments(readFileSync(rightPath, 'utf8')));
const differences = compare(original, generated);

if (differences.length > 0) {
  console.error(`CSS differs (${differences.length} difference${differences.length === 1 ? '' : 's'}):`);
  for (const difference of differences) console.error(`- ${difference}`);
  process.exit(1);
}

console.log('CSS semantic comparison passed.');
