import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
const storage = new Map();
const telemetry = [];
let uploadError = null;
let hasAccessToken = true;
let refreshCount = 0;

class MockBlob {}
class MockImage {
    constructor() { this.width = 100; this.height = 100; }
    set src(_) { this.onload(); }
}
class MockFileReader {
    readAsDataURL() { this.result = 'data:image/jpeg;base64,AA=='; this.onload(); }
}
const document = {
    createElement: () => ({
        getContext: () => ({ drawImage: () => {} }),
        toBlob: (callback) => callback(new MockBlob())
    })
};
const context = vm.createContext({
    window: { GhostAnalytics: { track: (event, meta) => telemetry.push({ event, meta }) } },
    localStorage: {
        getItem: (key) => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value))
    },
    document,
    Blob: MockBlob,
    Image: MockImage, FileReader: MockFileReader,
    URL: { createObjectURL: () => 'blob:avatar', revokeObjectURL: () => {} },
    fetch: async () => ({ ok: true, blob: async () => new MockBlob() }),
    console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date,
    Uint8Array, Buffer, atob: (value) => Buffer.from(value, 'base64').toString('binary'), setTimeout, clearTimeout
});
context.window.window = context.window;
for (const file of ['js/core/config.js', 'js/core/state-store.js', 'js/domain/avatar.js']) {
    vm.runInContext(read(file), context, { filename: file });
}

const { LoveArcadeStore: Store, LoveArcadeAvatar: Avatar } = context.window;
Avatar.setUIRefreshHandler(() => { refreshCount += 1; });

// El fallback local de un avatar predefinido conserva la ruta validada y refresca UI.
let result = await Avatar.setAvatarPath('/assets/avatar/clasicos/bocchi-81f12dff.jpg');
assert.deepEqual({ ...result }, {
    success: true, remote: false, preset: true, url: 'assets/avatar/clasicos/bocchi-81f12dff.jpg'
});
assert.equal(Avatar.getAvatar(), 'assets/avatar/clasicos/bocchi-81f12dff.jpg');
assert.equal(refreshCount, 1);
await assert.rejects(() => Avatar.setAvatarPath('../secreto.png'), /Avatar local no permitido/);

// Sin Sentinel, una foto personalizada conserva el fallback local comprimido.
result = await Avatar.setAvatar('data:image/jpeg;base64,AA==');
assert.deepEqual({ ...result }, { success: true, remote: false });
assert.equal(Avatar.getAvatar(), 'data:image/jpeg;base64,AA==');

const client = {
    auth: { getSession: async () => ({ data: { session: hasAccessToken ? { access_token: 'token' } : null }, error: null }) },
    storage: {
        from: () => ({
            upload: async () => ({ error: uploadError }),
            getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example/avatar.jpg' } })
        })
    }
};
context.window.Sentinel = {
    getSession: () => ({ user: { id: 'user-1' } }),
    getClient: () => client
};

// Con sesión y Storage válido, el preset sube y persiste la URL cloud.
result = await Avatar.setAvatarPath('assets/avatar/clasicos/bocchi-81f12dff.jpg');
assert.equal(result.success, true);
assert.equal(result.remote, true);
assert.equal(result.preset, true);
assert.equal(result.url, 'https://cdn.example/avatar.jpg');
assert.match(Avatar.getAvatar(), /^https:\/\/cdn\.example\/avatar\.jpg\?t=\d+$/);

// Una sesión expirada conserva el fallback local y reporta storage_no_session.
hasAccessToken = false;
result = await Avatar.setAvatar('data:image/jpeg;base64,AA==');
assert.deepEqual({ ...result }, { success: true, remote: false, reason: 'storage_no_session' });
assert.ok(telemetry.some(({ event }) => event === 'storage_no_session'));
hasAccessToken = true;

// Un 403 conserva el fallback local y registra el motivo de Storage.
uploadError = { status: 403, message: 'forbidden' };
result = await Avatar.setAvatarPath('assets/avatar/clasicos/505-a7bdbed3.jpg');
assert.deepEqual({ ...result }, {
    success: true, remote: false, preset: true, url: 'assets/avatar/clasicos/505-a7bdbed3.jpg'
});
assert.equal(Avatar.getAvatar(), 'assets/avatar/clasicos/505-a7bdbed3.jpg');
assert.ok(telemetry.some(({ event, meta }) => event === 'storage_forbidden_rls' && meta.preset === true));
assert.ok(refreshCount >= 3);
assert.equal(Store.getStore().userAvatar, Avatar.getAvatar());

console.log('Avatar domain tests passed.');
