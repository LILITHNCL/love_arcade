import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const microInteractionsSource = fs.readFileSync(path.join(projectRoot, 'js/ui/micro-interactions.js'), 'utf8');
const utilsSource = fs.readFileSync(path.join(projectRoot, 'js/core/utils.js'), 'utf8');

assert.match(
  utilsSource,
  /function\s+canUseVibration\s*\(/,
  'utils.js must define the vibration capability guard used by pointer feedback.'
);
assert.match(
  microInteractionsSource,
  /if\s*\(isAndroid\s*&&\s*_canUseVibration\(\)\)/,
  'Android pointer feedback must use the vibration capability guard.'
);

console.log('Interactive haptics static QA passed.');
