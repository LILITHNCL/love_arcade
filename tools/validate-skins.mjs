import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'assets/skins/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const requiredAliases = manifest.requiredIconAliases || [];

let failed = false;
function fail(msg) { failed = true; console.error('❌', msg); }
function ok(msg) { console.log('✅', msg); }

for (const skin of manifest.skins || []) {
  const prefix = `[${skin.id}]`;
  const iconPath = skin.icons?.sprite ? path.join(root, skin.icons.sprite) : null;
  if (iconPath && !fs.existsSync(iconPath)) fail(`${prefix} missing icons sprite: ${skin.icons.sprite}`);
  if (skin.backgrounds) for (const p of Object.values(skin.backgrounds)) if (p && !fs.existsSync(path.join(root,p))) fail(`${prefix} missing background: ${p}`);
  if (skin.gameCards) for (const p of Object.values(skin.gameCards)) if (p && !fs.existsSync(path.join(root,p))) fail(`${prefix} missing game card: ${p}`);

  if (iconPath && fs.existsSync(iconPath)) {
    const svg = fs.readFileSync(iconPath, 'utf8');
    for (const alias of requiredAliases) {
      const mapped = skin.icons?.aliases?.[alias] || `icon-${alias}`;
      if (!svg.includes(`id="${mapped}"`) && !svg.includes(`id='${mapped}'`)) {
        fail(`${prefix} alias '${alias}' unresolved (expected id: ${mapped})`);
      }
    }
  }

  ok(`${prefix} validated`);
}

if (failed) process.exit(1);
console.log('✅ Skin manifest validation passed');
