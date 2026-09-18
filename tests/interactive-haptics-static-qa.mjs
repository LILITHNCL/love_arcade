import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = fs.readFileSync(path.join(projectRoot, 'js/app.js'), 'utf8');

assert.match(
  appSource,
  /function\s+_canUseVibration\s*\(/,
  'app.js must define the vibration capability guard used by pointer feedback.'
);
assert.match(
  appSource,
  /if\s*\(isAndroid\s*&&\s*_canUseVibration\(\)\)/,
  'Android pointer feedback must use the vibration capability guard.'
);

console.log('Interactive haptics static QA passed.');