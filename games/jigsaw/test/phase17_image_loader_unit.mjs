import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loaderSource = fs.readFileSync(path.join(root, 'js/MAREJIG_imageLoader.js'), 'utf8');

function loadLoader({ failFull = false } = {}) {
  const requests = [];
  class FakeImage {
    set src(url) {
      requests.push(url);
      if (failFull) {
        queueMicrotask(() => this.onerror());
        return;
      }
      queueMicrotask(() => this.onload());
    }

    decode() {
      return Promise.resolve();
    }
  }

  const sandbox = {
    console: { warn() {} },
    Image: FakeImage,
    Map,
    Promise,
    queueMicrotask,
    window: null,
    MAREJIG_Cloudinary: {
      buildThumbnailUrl() {
        throw new Error('La imagen jugable no debe solicitar una miniatura');
      },
      buildFullUrl(level, profile) {
        return 'full:' + level.id + ':' + profile;
      },
      getRuntimeProfile() {
        return 'fullMobile';
      }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(loaderSource, sandbox, { filename: 'MAREJIG_imageLoader.js' });
  return { requests, loader: sandbox.MAREJIG_ImageLoader };
}

const level = { id: 'fixture_001' };

{
  const { requests, loader } = loadLoader();
  const progress = [];
  const result = await loader.loadPlayableImage(level, 'fullPremium', (value, label) => progress.push([value, label]));

  assert.deepEqual(requests, ['full:fixture_001:fullPremium'], 'the playable full image is the first and only loader request');
  assert.deepEqual(progress, [[46, 'Cargando imagen completa'], [78, 'Decodificando imagen'], [100, 'Listo']], 'full-image progress remains meaningful');
  assert.equal(result.failed, false, 'a full image still enters the game normally');
  assert.equal(result.profile, 'fullPremium', 'the selected delivery profile is preserved');
  assert.equal('preview' in result, false, 'the unused large preview is not retained in the result');
}

{
  const { requests, loader } = loadLoader({ failFull: true });
  const result = await loader.loadPlayableImage(level, 'fullMobile');

  assert.deepEqual(requests, ['full:fixture_001:fullMobile'], 'the fallback path still attempts only the playable full image');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    levelId: 'fixture_001',
    profile: 'fullMobile',
    image: null,
    drawable: null,
    drawableKind: 'fallback',
    failed: true,
    error: 'No se pudo cargar imagen: full:fixture_001:fullMobile'
  }, 'a failed full image keeps the existing visual fallback contract');
  assert.equal('preview' in result, false, 'the fallback result does not retain an obsolete preview field');
}

console.log('phase17 image loader unit tests ok');
