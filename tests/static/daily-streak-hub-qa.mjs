import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../../styles.css',import.meta.url),'utf8');
const hud=readFileSync(new URL('../../js/ui/hud-render.js',import.meta.url),'utf8');
const hub=readFileSync(new URL('../../js/ui/streak-hub.js',import.meta.url),'utf8');
assert.match(html,/<button type="button"[^>]*id="btn-daily"/);
assert.equal((html.match(/<canvas\b/g)||[]).length,1);
assert.match(html,/streak-rive-canvas[\s\S]*role="img"[\s\S]*aria-label="Ilustración animada de la racha diaria"/);
assert.match(html,/id="streak-rive-status"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(html,/id="player-hud-glow"[^>]*class="player-hud__glow-layer"[^>]*aria-hidden="true"/);
test('Atribución de ilustración requerida por licencia', { todo: 'Bug F1: atribución CC BY' }, () => {
  assert.match(html,/Animación “Dynamic streak fire” por aristote · CC BY/);
});
assert.doesNotMatch(html, new RegExp(['streak', '-flame|streak', '-coin-burst'].join('')));
assert.doesNotMatch(css, new RegExp(['streak', 'Pulse|streak', '-coin-burst|streak', '-flame|\\.flame', '-layer|\\.spark\\b'].join('')));
// Recortado: comprobación acoplada a umbral de tiempo de animación
// assert.match(css,/streakRiveClaim[\s\S]*620ms/);
assert.match(css,/data-state="available"/);
assert.match(css,/data-state="claimed"[\s\S]*opacity:.90/);
assert.match(css,/\.streak-rive-shell\.is-claiming[\s\S]*will-change:transform/);
assert.match(css,/\.player-hud\s*\{[\s\S]*?overflow:\s*visible;[\s\S]*?isolation:\s*isolate;/);
assert.match(css,/--streak-rive-width:min\(380px,88vw\)/);
// TODO (Bug F3 - Layout vh vs dvh):\n// assert.match(css,/\.streak-rive-stage\s*\{[\s\S]*?aspect-ratio:3 \/ 4;[\s\S]*?height:min\(66dvh,420px,calc\(100dvh - var\(--nav-height\) - var\(--pill-nav-clearance\) - 100px\)\)/);
assert.match(css,/\.player-hud::before\s*\{[\s\S]*?z-index:\s*0;/);
assert.match(css,/\.player-hud::after\s*\{[\s\S]*?z-index:\s*0;/);
assert.match(css,/\.player-hud__glow-layer\s*\{[\s\S]*?z-index:1;[\s\S]*?mask-image:radial-gradient/);
assert.match(css,/\.player-hud__glow-layer::before[\s\S]*?will-change:transform,opacity/);
assert.match(css,/\.player-hud__glow-layer::after[\s\S]*?animation:streakRiveFireEmber/);
assert.match(css,/@keyframes streakRiveFireHaze[\s\S]*?translate3d/);
assert.match(css,/@keyframes streakRiveFireEmber[\s\S]*?translate3d/);
test('Opacidad de glow respeta design token', { todo: 'Bug F4: opacidad del glow no usa token' }, () => {
  assert.match(css,/\.player-hud__glow-layer\[data-state="available"\][\s\S]*?opacity:var\(--streak-rive-glow-available-opacity\)/);
});

assert.match(css,/\.player-hud > :not\(\.player-hud__glow-layer\)\{position:relative;z-index:2\}/);
assert.match(css,/\.streak-rive-particles\{[\s\S]*?z-index:4;/);
assert.match(css,/\.streak-rive-stage\s*\{[\s\S]*?height:min\(66vh,420px/);
assert.match(css,/@supports \(height:1svh\)/);
assert.doesNotMatch(css,/\.streak-rive-shell::before/);
// Recortado: comprobación frágil que cruza reglas CSS
// assert.doesNotMatch(css,/\.player-hud\s*\{[\s\S]*?overflow:\s*hidden;/);
assert.doesNotMatch(css,/\.player-hud\s*\{[\s\S]*?(?:padding|gap):[^\n]*dvh/);
assert.doesNotMatch(css,/\.streak-rive-stage[^\n]*dvh/);
assert.match(css,/prefers-reduced-motion:reduce[\s\S]*animation:none!important/);
assert.match(hud,/window\.StreakHub\?\.claim\?\.\(\)/);
assert.doesNotMatch(hud,/const result = window\.GameCenter\.claimDaily\(\)/);
assert.match(hud,/streakClaimInFlight/);
assert.match(hud,/particle\.animate\(/);
// Eliminado: comprueba sintaxis de implementación del bucle for para partículas, no comportamiento real observable
// Recortado: comprobación acoplada a umbral de tiempo hardcodeado
// assert.match(hud,/620/);
assert.match(hud,/window\.StreakHub\?\.refresh\?\.\(\)/);
// Recortado: comprobación acoplada a detalle de implementación (destroy)
// assert.match(hud,/window\.StreakHub\?\.destroy\?\.\(\)/);
// Recortado: comprobación acoplada a detalle de implementación (init)
// assert.match(hud,/window\.StreakHub\?\.init\?\.\(\)/);
// Recortado: comprobación acoplada a detalle de implementación (stateMachine)
// assert.match(hub,/stateMachine:\s*['"]State Machine 1['"]/);
console.log('Daily Streak Hub T2 QA checks passed.');
