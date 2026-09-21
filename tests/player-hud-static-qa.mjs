import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../js/core/config.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function cssRule(selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  assert.ok(match, `Missing ${selector} CSS rule.`);
  return match[1];
}

const ambient = cssRule('.player-hud::before');
const sheen = cssRule('.player-hud::after');

assert.match(ambient, /inset:\s*0;/);
assert.match(ambient, /feTurbulence/);
assert.match(ambient, /radial-gradient\(circle at 20% 30%, var\(--accent-soft\), transparent 55%\)/);
assert.match(ambient, /radial-gradient\(circle at 85% 72%, rgba\(255,255,255,0\.07\), transparent 48%\)/);
assert.match(ambient, /linear-gradient\(\s*135deg,[\s\S]*?color-mix\(in srgb, var\(--accent\) 12%, var\(--solid-surface-float\) 88%\)/);
assert.match(ambient, /background-repeat:\s*repeat, no-repeat, no-repeat, no-repeat;/);
assert.match(ambient, /background-size:\s*200px 200px, cover, cover, cover;/);
assert.match(ambient, /filter:\s*blur\(12px\);/);
assert.match(ambient, /opacity:\s*0\.72;/);
assert.doesNotMatch(ambient, /\b(?:animation|transition|transform|will-change)\s*:/);

assert.match(sheen, /feTurbulence/);
assert.match(sheen, /linear-gradient\(180deg, rgba\(255,255,255,0\.035\), transparent 42%\)/);
assert.match(sheen, /background-repeat:\s*repeat, no-repeat;/);
assert.match(sheen, /background-size:\s*200px 200px, cover;/);

assert.doesNotMatch(css, /\.player-hud\.is-ready::before|\.player-hud\.motion-paused::before/);
assert.doesNotMatch(css, /hudAmbientSweep/);

const themeBlock = configSource.match(/const THEMES = (\{[\s\S]*?\n    \})\;/);
assert.ok(themeBlock, 'Could not locate the THEMES map.');
const themes = Function(`return (${themeBlock[1]})`)();
const bootThemeMap = indexHtml.match(/var T=(\{[^;]+\});/);
assert.ok(bootThemeMap, 'Could not locate the first-paint theme map.');
const bootThemes = Function(`return (${bootThemeMap[1]})`)();

assert.equal(Object.keys(themes).length, 25, 'All 25 themes must remain available to the ambient.');
for (const key of ['violet', 'white', 'magenta', 'lime']) {
  assert.match(themes[key].accent, /^#[0-9A-F]{6}$/i, `${key} needs a valid accent.`);
}
assert.deepEqual(
  Object.fromEntries(Object.entries(themes).map(([key, theme]) => [key, theme.accent])),
  bootThemes,
  'The first-paint theme map must stay aligned with THEMES.'
);

console.log('Player HUD static ambient QA checks passed.');
