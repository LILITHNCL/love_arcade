# Profile Avatar & Nickname Refactor Radiography

Generated on 2026-06-16 for a planned refactor from the current inline profile avatar/nickname controls into a centralized Netflix-style edit modal.

## Skills and Analysis Method

- **diagnose**: used as a code-path radiography workflow: locate the UI seam, trace event listeners, trace persistence, identify hidden coupling, then document regression risks before any implementation.
- **frontend-design**: used to evaluate the current visual/component architecture and the structural implications of moving to a modal-based profile editing experience.
- **fixing-accessibility**: used because the target architecture is a modal with image selection, file upload, validation, and keyboard interaction.
- **emil-design-eng**: used to document motion/interaction polish expectations and performance-sensitive animation constraints.

No production code was written, modified, or deleted as part of this analysis. The only new artifact is this document.

---

## Executive Summary

The current profile editing experience is split across three places:

1. **Markup in `index.html`**: the profile hero contains a clickable file-label avatar control and a separate nickname edit button.
2. **Inline script in `index.html`**: previews avatar uploads immediately by reading the selected file as a Data URL and directly mutating `.avatar`, `.hud-avatar`, and `.profile-avatar` background images.
3. **Core state/Supabase logic in `js/app.js`**: persists avatars through `window.GameCenter.setAvatar()`, compresses images, uploads to Supabase Storage when possible, falls back to local compressed Base64, and syncs `nickname`/`avatar_url` to Supabase through Sentinel Cloud Sync.

The planned Netflix-style modal should not be treated as a purely visual change. It changes the interaction contract from “click avatar to immediately open the native file picker” and “click pencil to edit nickname” into “open an edit profile surface, make one or more draft changes, then save/cancel.” That requires explicit draft state, source typing for avatars, clearer database semantics for local asset paths versus remote URLs, and better accessible modal behavior than the current identity modal provides.

---

## 1. Current DOM & CSS Architecture

### 1.1 Profile Hero DOM Tree

Current profile markup is in `index.html` inside `#view-profile`:

```html
<div id="view-profile" class="view-section hidden">
  <section class="profile-hub" data-profile-panel="home" aria-labelledby="profile-title">
    <div class="profile-hero glass-panel">
      <label for="avatar-upload-profile" class="profile-avatar-button" aria-label="Cambiar foto de perfil">
        <span class="profile-avatar" id="profile-avatar-display" style="background-image: url('https://res.cloudinary.com/dyspgn0sw/image/upload/default_avatar.avif');">
          <svg class="icon" width="44" height="44" aria-hidden="true"><use href="#icon-user"></use></svg>
        </span>
        <span class="profile-avatar-edit" aria-hidden="true"><svg class="icon" width="14" height="14"><use href="#icon-pencil"></use></svg></span>
        <input type="file" id="avatar-upload-profile" class="visually-hidden" accept="image/*">
      </label>
      <div class="profile-name-row">
        <h1 id="profile-title" class="profile-name">Love Arcade</h1>
        <button id="profile-edit-identity" class="profile-name-edit" type="button" aria-label="Editar nickname">
          <svg class="icon" width="14" height="14" aria-hidden="true"><use href="#icon-pencil"></use></svg>
        </button>
      </div>
    </div>
  </section>
</div>
```

#### Structural observations

- `.profile-hero.glass-panel` is a container and styling boundary, not just a wrapper.
- The avatar control is a `<label>` tied directly to the hidden file input. This makes clicking the avatar open the OS file picker immediately.
- The avatar edit badge is decorative (`aria-hidden="true"`) and has `pointer-events: none` through CSS. It is not its own control.
- Nickname edit is a true `<button>` with an accessible name (`aria-label="Editar nickname"`).
- The pencil icon symbol is global SVG sprite markup: `<symbol id="icon-pencil">` exists in `index.html`, and both avatar and nickname controls use `<use href="#icon-pencil">`.

### 1.2 Profile Hero CSS Rules

The hero block currently uses a hybrid of the global `.glass-panel` primitive and a more specific `.profile-hero` skin.

#### `.glass-panel`

```css
.glass-panel {
    background: var(--solid-surface-base);
    border: 1px solid transparent;
    box-shadow: var(--surface-shadow-soft);
    position: relative;
    z-index: 1;
}
```

Implications:

- Adds `position: relative` and `z-index: 1`, creating a local stacking context dependency.
- Establishes base background/border/shadow values that `.profile-hero` overrides in part.
- Other components reuse `.glass-panel` heavily, so removing it from the hero alone will not remove the global primitive.

#### `.profile-hero`

```css
.profile-hero {
    padding: 28px 18px 24px;
    border-radius: var(--radius-xl);
    text-align: center;
    background:
        radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 46%),
        var(--solid-surface-base);
    border: 1px solid var(--accent-border);
    box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.06);
}
```

At `min-width: 720px`:

```css
.profile-hero { padding: 36px 28px 30px; }
```

Implications:

- `.profile-hero` owns most visible appearance: padding, radius, centered text, gradient, border, and stronger shadow.
- The hero does **not** currently define `position` or `z-index`; those come from `.glass-panel`.
- If the `glass-panel` class is removed, the visible design will mostly remain, but the stacking behavior changes because `position: relative; z-index: 1;` disappears.
- If future modal trigger affordances, floating badges, or pseudo-elements rely on hero stacking, those rules should move into `.profile-hero` explicitly before removing `.glass-panel`.

### 1.3 Avatar Control CSS

#### `.profile-avatar-button`

```css
.profile-avatar-button {
    position: relative;
    display: inline-flex;
    margin-inline: auto;
    cursor: pointer;
    border-radius: 999px;
    outline: 2px solid transparent;
    outline-offset: 6px;
}
```

Focus state:

```css
.profile-avatar-button:focus-within {
    outline-color: var(--focus-ring-aa);
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--focus-ring-aa) 18%, transparent);
}
```

Implications:

- Focus ring is currently triggered by the hidden file input receiving focus because the parent label uses `:focus-within`.
- The label is not a button; keyboard activation behavior depends on the associated file input and browser label behavior.
- A modal-trigger refactor should replace this direct file-label behavior with a native `<button>` or keep a visually hidden file input inside the modal only.

#### `.profile-avatar`

```css
.profile-avatar {
    display: grid;
    place-items: center;
    width: clamp(118px, 34vw, 168px);
    height: clamp(118px, 34vw, 168px);
    border-radius: 999px;
    background-color: var(--bg-elevated);
    background-position: center;
    background-size: cover;
    color: var(--text-low);
    border: 3px solid var(--accent-border);
    box-shadow: 0 18px 42px rgba(0,0,0,0.38), 0 0 0 10px color-mix(in srgb, var(--accent) 10%, transparent);
    transition: transform var(--motion-micro), border-color var(--motion-small), box-shadow var(--motion-small);
}
```

Interaction rules:

```css
.profile-avatar-button:active .profile-avatar { transform: scale(0.98); }

@media (hover: hover) and (pointer: fine) {
    .profile-avatar-button:hover .profile-avatar {
        transform: translateY(-2px);
        border-color: var(--accent);
        box-shadow: 0 22px 48px rgba(0,0,0,0.42), 0 0 0 10px color-mix(in srgb, var(--accent) 14%, transparent);
    }
}
```

Implications:

- The avatar image is rendered as CSS `background-image`, not `<img src>`. This pattern is shared with navbar and HUD avatars.
- Placeholder icon visibility is manually hidden by JS after a background image is applied.
- The hover state is already gated behind `(hover: hover) and (pointer: fine)`, which is good for touch devices.
- Refactoring to a modal trigger can reuse the same visual avatar shell, but it should decouple “open edit modal” from “open native file picker.”

#### `.profile-avatar-edit`

```css
.profile-avatar-edit {
    position: absolute;
    right: 10px;
    bottom: 10px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    border: 2px solid var(--solid-surface-base);
    box-shadow: var(--control-shadow-hover);
    pointer-events: none;
}
```

Implications:

- This is a decorative affordance only.
- Removing the inline pencil badge removes the only visual indication that the avatar is editable unless replaced by text, a hover overlay, or a combined “Editar perfil” control.
- If the avatar becomes a modal trigger, the badge could become a semantic part of the button content but should remain `aria-hidden` if decorative.

### 1.4 Nickname Row CSS

The relevant CSS appears after the profile internal screen section:

```css
.profile-name-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}
```

```css
.profile-name-edit {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--solid-surface-base);
    color: var(--text-med);
    box-shadow: var(--control-shadow-rest);
    transition: transform var(--motion-micro), border-color var(--motion-small), color var(--motion-small), box-shadow var(--motion-small), background-color var(--motion-small);
}
```

```css
.profile-name-edit:hover,
.profile-name-edit:focus-visible {
    color: var(--accent);
    border-color: var(--accent-border);
    box-shadow: var(--control-shadow-hover);
}

.profile-name-edit:active { transform: scale(0.96); }
```

Implications:

- The nickname edit button is a small icon-only control with a proper `aria-label`.
- A Netflix-style modal usually uses one larger “Edit profile” surface or a pencil overlay on the avatar/card. If the standalone nickname pencil is removed, the accessible name and primary edit affordance must move elsewhere.
- Removing inline `#icon-pencil` instances without replacing the edit affordance creates a discoverability regression.

### 1.5 Consequences of Removing `.profile-hero.glass-panel`

If the wrapper is entirely removed rather than restyled:

- The profile avatar and name row lose their visual grouping.
- The profile page hierarchy becomes flatter; `.profile-action-grid` will appear closer to the avatar unless replacement spacing is added to `.profile-hub` or a new header component.
- The radial accent, border, shadow, padding, and centered text are lost if `.profile-hero` itself is removed.
- If only `glass-panel` is removed, most visible hero styling remains, but `position: relative` and `z-index: 1` from `.glass-panel` are lost.
- Existing `.profile-avatar-edit` absolute positioning is relative to `.profile-avatar-button`, so it does not depend on `.profile-hero` for positioning.
- Existing focus ring also lives on `.profile-avatar-button`, not `.profile-hero`.

Recommended future direction:

- Keep a semantic/profile header container but rename or restyle it intentionally, e.g. `.profile-summary` or `.profile-card`.
- Move any needed `position: relative; z-index: 1;` into the new component class if the visual layer still needs stacking isolation.
- Replace direct avatar file label with a single button that opens the centralized modal.

---

## 2. Supabase Synchronization & State

### 2.1 State Storage Overview

Primary client state lives in localStorage under:

```js
const CONFIG = {
    stateKey: 'gamecenter_v6_promos',
    ...
};
```

The hub store contains at least:

- `store.userAvatar`
- `store.nickname`
- `store.gender`
- gameplay/economy data

Persistence goes through `saveState(options = {})`, which:

1. Serializes `store`.
2. Trims data if near storage limits.
3. Writes to `localStorage.setItem(CONFIG.stateKey, payload)`.
4. Calls `updateUI()`.
5. Calls `_syncCloudIfNeeded(immediateCloudSync)`.
6. Calls `checkStorageSize()`.

Supabase cloud sync is handled by the `SentinelCloudSync` IIFE in `js/app.js`.

Important constants:

```js
const SUPABASE_TABLE = 'user_profiles';
const SENTINEL_TS_KEY = 'love_arcade_sentinel_ts';
const HIGH_PRIORITY_DEBOUNCE_MS = 1_000;
const PASSIVE_PRIORITY_DEBOUNCE_MS = 60_000;
```

### 2.2 Avatar Upload Data Flow

#### Entry point: `<input type="file" id="avatar-upload-profile">`

There are **two** change listeners tied to this one input.

#### Listener A: inline preview in `index.html`

```js
const avatarUploads = [
    document.getElementById('avatar-upload-profile')
];
avatarUploads.forEach(input => {
    if (!input) return;
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const url = ev.target.result;
            document.querySelectorAll('.avatar, .hud-avatar, .profile-avatar').forEach(el => {
                el.style.backgroundImage = `url('${url}')`;
                const icon = el.querySelector('svg');
                if (icon) icon.style.display = 'none';
            });
        };
        reader.readAsDataURL(file);
    });
});
```

Flow:

1. User selects a file.
2. FileReader reads it as Data URL.
3. All `.avatar`, `.hud-avatar`, and `.profile-avatar` nodes are immediately updated to the raw Data URL.
4. SVG placeholder icons inside those elements are hidden.

Important implication:

- This listener previews the raw selected file **before** compression/upload/persistence succeeds.
- If Supabase upload and local fallback both fail, the UI may briefly show an avatar that was not saved until the next authoritative `applyAvatar()`/`updateUI()` cycle.
- A modal refactor should replace this global immediate mutation with modal-local preview state, then commit only after save succeeds.

#### Listener B: delegated persistence in `js/app.js`

```js
document.addEventListener('change', async (e) => {
    if (e.target.id === 'avatar-upload-profile') {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                await window.GameCenter.setAvatar(evt.target.result);
            } catch (err) {
                _showStorageToast(err?.message || 'No se pudo guardar el avatar.', 'error');
            }
        };
        reader.readAsDataURL(file);
    }
});
```

Flow:

1. Same file input emits `change`.
2. FileReader reads the file as Data URL.
3. `window.GameCenter.setAvatar(dataUrl)` is called.
4. Errors are surfaced through `_showStorageToast()`.

#### `GameCenter.setAvatar(dataUrl)` cloud-first path

```js
setAvatar: async (dataUrl) => {
    const session = window.Sentinel?.getSession?.();
    const sbClient = window.Sentinel?.getClient?.();
    const userId = session?.user?.id;
    const bucket = 'avatars';

    if (session && sbClient && userId) {
        const path = `${userId}/profile.jpg`;
        try {
            const { data: authData, error: authError } = await sbClient.auth.getSession();
            if (authError) throw authError;
            const freshSession = authData?.session;
            if (!freshSession?.access_token) {
                ...
                await _saveAvatarLocally(dataUrl);
                return { success: true, remote: false, reason: 'storage_no_session' };
            }

            const sourceBlob = _dataUrlToBlob(dataUrl);
            const compressed = await compressImage(sourceBlob, 200, 200, 0.7);
            const { error: uploadError } = await sbClient
                .storage
                .from(bucket)
                .upload(path, compressed, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'image/jpeg'
                });
            if (uploadError) throw uploadError;

            const { data } = sbClient.storage.from(bucket).getPublicUrl(path);
            if (!data?.publicUrl) throw new Error('No se pudo generar URL pública del avatar.');
            store.userAvatar = data.publicUrl;
            saveState({ immediateCloudSync: true });
            applyAvatar();
            return { success: true, remote: true, url: data.publicUrl };
        } catch (err) {
            ...
        }
    }

    await _saveAvatarLocally(dataUrl);
    return { success: true, remote: false };
}
```

Cloud path details:

- Uses `window.Sentinel.getSession()` and `window.Sentinel.getClient()`.
- Requires `session.user.id`.
- Uses Supabase Storage bucket: **`avatars`**.
- Object path is fixed: **`${userId}/profile.jpg`**.
- Calls `sbClient.auth.getSession()` again to ensure a fresh access token.
- Converts Data URL to Blob with `_dataUrlToBlob()`.
- Compresses with `compressImage(sourceBlob, 200, 200, 0.7)`.
- Uploads JPEG with `cacheControl: '3600'`, `upsert: true`, `contentType: 'image/jpeg'`.
- Gets a public URL with `getPublicUrl(path)`.
- Persists `store.userAvatar = data.publicUrl`.
- Calls `saveState({ immediateCloudSync: true })` and `applyAvatar()`.

#### Compression

```js
function compressImage(blob, maxWidth = 200, maxHeight = 200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((compressed) => {
                URL.revokeObjectURL(url);
                if (!compressed) reject(new Error('No se pudo comprimir la imagen.'));
                resolve(compressed);
            }, 'image/jpeg', quality);
        };
        img.onerror = () => { ... };
        img.src = url;
    });
}
```

Compression characteristics:

- Max bounding box: 200x200.
- Preserves aspect ratio.
- Never upscales above original size.
- Always outputs JPEG at quality 0.7.
- Does not crop square; non-square uploads become non-square JPEGs rendered through circular CSS background cover.

#### Local fallback path

```js
async function _saveAvatarLocally(dataUrl) {
    const sourceBlob = _dataUrlToBlob(dataUrl);
    const compressed = await compressImage(sourceBlob, 200, 200, 0.7);
    const finalDataUrl = await _blobToDataUrl(compressed);
    const sizeKB = finalDataUrl.length / KB;
    if (sizeKB > AVATAR_MAX_LOCAL_KB) {
        throw new Error('Imagen demasiado grande. Usa una foto de menos de 100 KB.');
    }
    store.userAvatar = finalDataUrl;
    saveState({ immediateCloudSync: true });
    applyAvatar();
}
```

Local path details:

- Compresses exactly like cloud path.
- Converts compressed Blob back to Data URL.
- Rejects if final Data URL is larger than `AVATAR_MAX_LOCAL_KB` (100 KB per user-facing error and docs).
- Stores Base64 Data URL in `store.userAvatar`.
- Calls `saveState({ immediateCloudSync: true })` and `applyAvatar()`.

#### Avatar rendering

```js
function applyAvatar() {
    if (!store.userAvatar) return;
    document.querySelectorAll('#user-avatar-display, #hud-avatar-display, #profile-avatar-display, .hud-avatar').forEach(el => {
        el.style.backgroundImage = `url('${store.userAvatar}')`;
        const icon = el.querySelector('i, svg');
        if (icon) icon.style.display = 'none';
    });
}
```

Implications:

- Any valid CSS URL string is currently accepted: HTTP(S), Data URL, or relative path.
- There is no source-type metadata.
- The same string drives navbar, HUD, and profile avatar.
- The UI assumes `store.userAvatar` is safe to embed inside CSS `url('...')`; a local-asset migration should avoid accepting arbitrary untrusted strings from user input.

### 2.3 Nickname Update Data Flow

#### Trigger: `#profile-edit-identity`

At the end of the inline identity script:

```js
document.getElementById('profile-edit-identity')
    ?.addEventListener('click', () => openIdentityModal('edit'));

initIdentityModalListeners();
```

Clicking the profile pencil opens the existing identity modal in edit mode.

#### `openIdentityModal('edit')`

Key behavior:

```js
function openIdentityModal(mode) {
    const identityModal = document.getElementById('identity-modal');
    const isEdit = (mode === 'edit');
    identityModalState.mode = isEdit ? 'edit' : 'welcome';

    if (titleEl) titleEl.textContent = isEdit ? 'Editar identidad' : '¡Bienvenid@ a Love Arcade!';
    if (subEl) subEl.textContent = isEdit
        ? 'Actualiza tu nombre o forma de saludo.'
        : 'Elige cómo quieres que te llame la plataforma.';
    if (confirmLbl) confirmLbl.textContent = isEdit ? 'Guardar cambios' : 'Empezar';

    const currentIdentity = window.GameCenter?.getIdentity?.() ?? { nickname: '', gender: '@' };
    identityModalState.selectedGender = isEdit ? currentIdentity.gender : '@';

    nicknameInput.value = isEdit ? currentIdentity.nickname : '';
    charCount.textContent = `${nicknameInput.value.length}/15`;

    setActiveGenderChip(identityModalState.selectedGender);
    identityModal.classList.remove('hidden');
    window.ModalA11y?.open?.(identityModal, document.activeElement);
    errorEl?.classList.add('hidden');
    setTimeout(() => nicknameInput?.focus(), 280);
}
```

Flow:

1. Sets modal mode to `edit`.
2. Changes modal copy and confirm label.
3. Reads current nickname/gender via `GameCenter.getIdentity()`.
4. Prefills `#identity-nickname-input`.
5. Updates character count.
6. Marks selected gender chip.
7. Shows the modal.
8. Calls global `ModalA11y.open()`.
9. Focuses nickname input after 280 ms.

#### Validation and confirmation

```js
function confirmIdentityFromModal() {
    const nickname = nicknameInput?.value.trim() || '';

    if (!nickname) {
        errorEl?.classList.remove('hidden');
        nicknameInput?.focus();
        return;
    }

    window.GameCenter?.setIdentity?.(nickname, identityModalState.selectedGender);
    identityModal?.classList.add('hidden');
    window.ModalA11y?.close?.(identityModal);
    if (identityModalState.mode !== 'edit') {
        window.revealUI?.();
    }
}
```

Validation characteristics:

- Only validates non-empty after `trim()`.
- Input markup has `maxlength="15"`; `GameCenter.setIdentity()` also slices to 15 characters.
- No profanity, duplicate, min length, or character whitelist validation.
- Error message is `role="alert"` and hidden/shown by `.hidden`.
- Input has `aria-describedby="identity-input-error"`, but does not set `aria-invalid` when invalid.

#### Input listeners

```js
nicknameInput?.addEventListener('input', () => {
    if (charCount) charCount.textContent = `${nicknameInput.value.length}/15`;
    if (nicknameInput.value.trim()) errorEl?.classList.add('hidden');
});

nicknameInput?.addEventListener('focus', () => {
    setTimeout(() => {
        document.getElementById('identity-confirm-btn')
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 350);
});

nicknameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        confirmIdentityFromModal();
    }
});
```

Implications:

- Character counter is live (`aria-live="polite"` on the counter element).
- `focus` triggers smooth scroll to the confirm button, which may be useful on mobile but can be disorienting. A future modal should respect reduced motion.
- Enter submits nickname edits.

#### `GameCenter.setIdentity()`

```js
setIdentity: (nickname, gender) => {
    const VALID_GENDERS = ['o', 'a', '@'];
    store.nickname = String(nickname).trim().slice(0, 15);
    store.gender   = VALID_GENDERS.includes(gender) ? gender : '@';
    saveState();
    applyIdentity();
}
```

Flow:

1. Trims nickname and hard-limits to 15 characters.
2. Validates gender against `['o', 'a', '@']`, defaulting to `'@'`.
3. Calls `saveState()`.
4. Calls `applyIdentity()`.

`saveState()` itself calls `updateUI()`, and `updateUI()` calls `applyAvatar()` plus other UI updates. Then `setIdentity()` calls `applyIdentity()` directly again. This is redundant but harmless.

#### Nickname rendering

```js
function applyIdentity() {
    const suffixEl   = document.getElementById('pref-suffix');
    const nicknameEl = document.getElementById('display-nickname');
    const profileNameEl = document.getElementById('profile-title');
    if (suffixEl)   suffixEl.textContent   = store.gender   || '@';
    if (nicknameEl) nicknameEl.textContent = store.nickname || '';
    if (profileNameEl) profileNameEl.textContent = store.nickname || 'Love Arcade';
}
```

UI sinks:

- `#pref-suffix`
- `#display-nickname`
- `#profile-title`

### 2.4 Supabase Tables and Sync Contract

#### Table

Supabase table used by Sentinel:

```js
const SUPABASE_TABLE = 'user_profiles';
```

Upsert payload:

```js
const { error } = await _sbClient
    .from(SUPABASE_TABLE)
    .upsert(
        { id: userId, game_data: snap, nickname, avatar_url, updated_at: now },
        { onConflict: 'id' }
    );
```

Columns currently involved:

- `id`: Supabase Auth user ID.
- `game_data`: JSONB snapshot of watched localStorage keys.
- `nickname`: derived from `window.GameCenter.getIdentity().nickname`.
- `avatar_url`: derived from `_getCloudAvatarUrl()`.
- `updated_at`: ISO timestamp.

#### Storage bucket

Supabase Storage bucket:

- Bucket name: **`avatars`**
- Object path: **`${userId}/profile.jpg`**
- Public URL stored in `store.userAvatar`, then uploaded to `user_profiles.avatar_url` through Sentinel.

#### `game_data` avatar exclusion

Sentinel intentionally strips `userAvatar` out of the `game_data` snapshot:

```js
if ((key === CONFIG.stateKey || key === 'gamecenter_v6_promos') && typeof val === 'string') {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'userAvatar')) {
        const sanitized = { ...parsed };
        delete sanitized.userAvatar;
        snap[key] = JSON.stringify(sanitized);
        return;
    }
}
```

Reason: cloud avatar binary/URL is intended to live in `user_profiles.avatar_url`, not inside `game_data`.

#### `_getCloudAvatarUrl()` limitation

```js
function _getCloudAvatarUrl() {
    const avatar = window.GameCenter?.getAvatar?.();
    if (typeof avatar !== 'string') return null;
    if (_isBase64Avatar(avatar)) return null;
    return /^https?:\/\//i.test(avatar) ? avatar : null;
}
```

Current behavior:

- Base64 avatars are not synced to `avatar_url`.
- Only HTTP(S) URLs are synced to `avatar_url`.
- Relative local asset paths would **not** sync to `avatar_url` under the current implementation.

This is the key architectural blocker for `/assets/avatar/` integration.

#### Cloud hydration

On auth/session restore:

```js
const { data, error } = await _sbClient
    .from(SUPABASE_TABLE)
    .select('game_data, updated_at, nickname, avatar_url')
    .eq('id', userId)
    .maybeSingle();

if (data?.nickname && !window.GameCenter?.hasIdentity?.()) {
    window.GameCenter?.setIdentity?.(data.nickname, '@');
}
if (data?.avatar_url && typeof data.avatar_url === 'string') {
    const avatar = data.avatar_url.trim();
    if (avatar) {
        store.userAvatar = avatar;
        saveState();
    }
}
```

Implications:

- Cloud nickname only applies if no local identity exists.
- Cloud gender is not selected from Supabase; nickname hydration uses default gender `'@'`.
- Cloud avatar applies from `avatar_url` if non-empty.
- Current hydration expects `avatar_url` to be a single renderable string.

---

## 3. Modal Architecture & `/assets/avatar` Integration

### 3.1 Existing Modal Infrastructure

There is already global modal accessibility infrastructure in `index.html`:

```js
const modalA11yState = {
    activeModal: null,
    modalTriggerMap: new WeakMap(),
    focusTrapHandler: null,
    hiddenSiblings: []
};
```

`window.ModalA11y.open(modalEl, triggerEl)`:

- Stores opener in `modalTriggerMap`.
- Sets `activeModal`.
- Calls `setBackgroundInteractivity(modalEl, true)` to set `aria-hidden="true"` and `inert = true` on body siblings.
- Installs a `Tab` focus trap.

`window.ModalA11y.close(modalEl)`:

- Clears background interactivity.
- Removes the focus trap handler.
- Restores focus to the trigger.

Gaps to address for the new modal:

- Escape key close is not implemented in `ModalA11y` itself.
- Initial focus is not handled centrally; each modal does it manually.
- Nested/multiple modals are not stack-safe (`activeModal` is single-value, `hiddenSiblings` is global mutable state).
- `getFocusableElements()` excludes elements with `offsetParent === null`; this can miss fixed/visually unusual focusables in edge cases.
- Close restoration does not remove the `WeakMap` entry, although this is minor.

### 3.2 Required State Changes for a Centralized Edit Modal

The current implementation has no profile edit draft state. The new modal needs at least:

```js
const profileEditState = {
    isOpen: false,
    mode: 'edit',
    draftNickname: '',
    draftGender: '@',
    draftAvatar: {
        kind: 'remote-url' | 'local-asset' | 'data-url' | 'none',
        value: '',
        file: null,
        previewUrl: ''
    },
    selectedAvatarId: null,
    isSaving: false,
    error: ''
};
```

Recommended separation:

- **Committed state**: existing `store.nickname`, `store.gender`, `store.userAvatar` or a future typed avatar object.
- **Draft state**: modal-local values that can be canceled without mutating the HUD/profile/nav.
- **Preview state**: object URLs or Data URLs used only inside the modal until save.
- **Save state**: async flags for Supabase upload/upsert and UI disabling.

Minimum new functions:

- `openProfileEditModal(triggerEl)`
- `closeProfileEditModal({ restoreFocus = true })`
- `hydrateProfileEditDraftFromStore()`
- `selectPresetAvatar(assetPathOrId)`
- `selectUploadedAvatar(file)`
- `validateProfileEditDraft()`
- `saveProfileEditDraft()`
- `renderProfileEditDraft()` or DOM update helpers if staying in vanilla JS

### 3.3 Interaction Contract Change

Current contract:

- Avatar click → native file picker opens immediately.
- File selection → global preview immediately mutates all avatar surfaces.
- Nickname pencil → identity modal opens.

Target contract:

- Avatar/profile edit trigger → centralized edit modal opens.
- User chooses a preset avatar or uploads a custom image.
- User edits nickname/gender if included.
- User presses Save.
- App validates, persists avatar and nickname, syncs Supabase, updates UI.
- User can Cancel and no committed UI changes occur.

This means the old inline avatar preview listener should eventually be removed or scoped to the modal’s upload input to avoid duplicate/early mutations.

### 3.4 `/assets/avatar/` Integration Requirements

The repo currently has no discovered `assets/avatar/` directory. Existing assets under `assets/` are icons only. The new architecture should therefore define a manifest or deterministic directory contract before implementation.

Recommended directory shape:

```text
assets/avatar/
  arcade/
    neon-cat.avif
    moon-bunny.avif
  heroes/
    nova.avif
    kira.avif
  avatar-manifest.json
```

Recommended manifest:

```json
{
  "version": 1,
  "collections": [
    {
      "id": "arcade",
      "label": "Arcade",
      "items": [
        {
          "id": "arcade/neon-cat",
          "label": "Neon Cat",
          "src": "assets/avatar/arcade/neon-cat.avif"
        }
      ]
    }
  ]
}
```

Why a manifest is preferable:

- Static web apps cannot reliably enumerate directories client-side.
- A manifest gives accessible labels for each avatar.
- IDs are more stable than file paths if assets are reorganized later.
- It allows curation/order/grouping without hard-coded JS arrays.

### 3.5 Distinguishing Local Asset Path vs Remote Supabase URL

Current storage is a single string:

```js
store.userAvatar = data.publicUrl; // remote
store.userAvatar = finalDataUrl;   // local Base64 fallback
```

Current cloud sync only writes HTTP(S) strings to `user_profiles.avatar_url`.

A local asset path like `assets/avatar/arcade/neon-cat.avif` creates ambiguity:

- Is it safe local content selected from a controlled catalog?
- Is it an arbitrary string injected into CSS?
- Should it sync through `avatar_url`?
- Should it survive domain moves or CDN changes?

#### Recommended typed avatar model

Add a typed avatar descriptor in client state:

```js
store.avatar = {
    kind: 'preset',
    id: 'arcade/neon-cat',
    src: 'assets/avatar/arcade/neon-cat.avif'
};
```

For Supabase Storage avatars:

```js
store.avatar = {
    kind: 'upload',
    url: 'https://<project>.supabase.co/storage/v1/object/public/avatars/<userId>/profile.jpg',
    storageBucket: 'avatars',
    storagePath: '<userId>/profile.jpg',
    updatedAt: '2026-06-16T00:00:00.000Z'
};
```

For legacy local fallback:

```js
store.avatar = {
    kind: 'data-url',
    dataUrl: 'data:image/jpeg;base64,...'
};
```

Compatibility bridge:

- Keep `store.userAvatar` temporarily as the render URL string for old code paths.
- Add `GameCenter.getAvatarDescriptor()` and `GameCenter.setAvatarDescriptor()` later.
- Make `GameCenter.getAvatar()` return the resolved render URL for current UI sinks.

#### Recommended database model

Best option: add columns to `user_profiles`:

- `avatar_kind text` — `'upload' | 'preset' | 'external' | null`
- `avatar_url text` — remote URL for uploaded/custom cloud image, or resolved public URL if keeping one-column compatibility
- `avatar_asset_id text` — stable preset ID, e.g. `arcade/neon-cat`
- `avatar_asset_path text` — optional path snapshot, e.g. `assets/avatar/arcade/neon-cat.avif`
- `avatar_storage_path text` — optional Supabase Storage object path for uploaded custom image

If schema changes must be avoided, encode a descriptor in `avatar_url`, but this is less clean. Examples:

- `avatar_url = 'preset:arcade/neon-cat'`
- `avatar_url = '/assets/avatar/arcade/neon-cat.avif'`

However, the existing `_getCloudAvatarUrl()` rejects non-HTTP values, so using `avatar_url` for local paths requires changing that function and auditing security implications.

#### Recommended render resolver

```js
function resolveAvatarUrl(avatar) {
    if (!avatar) return DEFAULT_AVATAR_URL;
    if (typeof avatar === 'string') return avatar; // legacy
    if (avatar.kind === 'preset') return lookupAvatarAsset(avatar.id)?.src || DEFAULT_AVATAR_URL;
    if (avatar.kind === 'upload') return avatar.url || DEFAULT_AVATAR_URL;
    if (avatar.kind === 'data-url') return avatar.dataUrl || DEFAULT_AVATAR_URL;
    return DEFAULT_AVATAR_URL;
}
```

Security rule:

- Preset local paths should come only from a manifest lookup by ID, not from arbitrary DB-provided paths.
- The database can store `avatar_asset_id`; the client maps it to an approved `src` from the bundled manifest.
- Avoid blindly inserting user-controlled strings into CSS `url('...')`.

### 3.6 Supabase Sync Changes Needed

#### Current `_getCloudAvatarUrl()` will not sync preset paths

Current function:

```js
return /^https?:\/\//i.test(avatar) ? avatar : null;
```

Needed replacement:

```js
function _getCloudAvatarPayload() {
    const descriptor = window.GameCenter?.getAvatarDescriptor?.();
    if (!descriptor) return { avatar_url: null, avatar_kind: null, avatar_asset_id: null };

    if (descriptor.kind === 'upload') {
        return {
            avatar_kind: 'upload',
            avatar_url: descriptor.url,
            avatar_asset_id: null,
            avatar_storage_path: descriptor.storagePath || null
        };
    }

    if (descriptor.kind === 'preset') {
        return {
            avatar_kind: 'preset',
            avatar_url: null,
            avatar_asset_id: descriptor.id,
            avatar_storage_path: null
        };
    }

    return { avatar_kind: null, avatar_url: null, avatar_asset_id: null };
}
```

#### Upsert should include typed avatar data

Future upsert shape:

```js
.upsert({
    id: userId,
    game_data: snap,
    nickname,
    avatar_kind,
    avatar_url,
    avatar_asset_id,
    avatar_storage_path,
    updated_at: now
}, { onConflict: 'id' })
```

#### Hydration should reconstruct the descriptor

Future select:

```js
.select('game_data, updated_at, nickname, avatar_kind, avatar_url, avatar_asset_id, avatar_storage_path')
```

Future hydration:

- If `avatar_kind === 'preset'`, validate `avatar_asset_id` against manifest and set descriptor to preset.
- If `avatar_kind === 'upload'`, validate `avatar_url` as HTTP(S) and set descriptor to upload.
- If only legacy `avatar_url` exists, treat it as legacy upload/external URL.

### 3.7 Upload Flow in the New Modal

Recommended flow for uploaded custom image:

1. User opens modal.
2. User activates “Upload from gallery.”
3. Hidden file input in the modal receives a file.
4. Validate file type starts with `image/`.
5. Optional: validate file size before reading to avoid huge memory use.
6. Create object URL or Data URL for modal-local preview.
7. Do **not** mutate `store.userAvatar` yet.
8. On Save:
   - Compress with existing `compressImage()`.
   - If session exists: upload to `avatars/${userId}/profile.jpg` as today.
   - Else/failure: use existing `_saveAvatarLocally()` or a new lower-level function that returns a Data URL without immediately mutating store until the whole profile draft succeeds.
   - Commit nickname/gender/avatar together.
9. Update all avatar surfaces through `applyAvatar()`/`updateUI()`.
10. Close modal and restore focus.

Implementation caution:

- Existing `GameCenter.setAvatar()` mutates store immediately. For atomic save, consider adding lower-level helper functions:
  - `prepareUploadedAvatar(fileOrDataUrl)` returns descriptor/result.
  - `commitProfile({ nickname, gender, avatarDescriptor })` mutates store once.

---

## 4. UX, Accessibility, and Motion Requirements

### 4.1 Modal Semantics

The new centralized edit modal should use:

```html
<div id="profile-edit-modal"
     class="modal-overlay profile-edit-modal-overlay hidden"
     role="dialog"
     aria-modal="true"
     aria-labelledby="profile-edit-modal-title"
     aria-describedby="profile-edit-modal-description">
  <div class="modal-box profile-edit-modal-box">
    ...
  </div>
</div>
```

Required semantics:

- Modal container: `role="dialog"` and `aria-modal="true"`.
- Title: visible heading referenced by `aria-labelledby`.
- Short description/instructions referenced by `aria-describedby`.
- Close button with accessible name, e.g. `aria-label="Cerrar edición de perfil"`.
- Save button that communicates loading state and disabled state.
- File input with a visible or programmatic label.
- Avatar grid represented as a list/grid of buttons or radio inputs.

### 4.2 Focus Management

Required behavior:

- Store the trigger element before opening.
- Move initial focus into the modal.
- Trap Tab and Shift+Tab inside the modal.
- Close on Escape unless a blocking save is in progress.
- Restore focus to the opener on close.
- Prevent background interaction with `inert` and `aria-hidden`.
- Avoid page scroll jumps when opening.

Initial focus recommendation:

- If editing an existing profile: focus the first meaningful field, likely the nickname input or the close button depending on expected workflow.
- For a Netflix-style avatar picker where visual selection is primary: focus the currently selected avatar tile if the modal opens to avatar selection, or focus the nickname field if identity editing is primary.
- Do not autofocus the hidden file input.

Existing `ModalA11y` can be reused but should be extended with Escape handling and explicit initial focus support:

```js
window.ModalA11y.open(modalEl, triggerEl, { initialFocus: '#profile-edit-nickname' })
```

### 4.3 Keyboard Navigation for Avatar Grid

Two viable patterns:

#### Pattern A: Radio group

Best if exactly one avatar is selected.

```html
<fieldset>
  <legend>Elige un avatar</legend>
  <label>
    <input type="radio" name="profile-avatar" value="arcade/neon-cat">
    <img src="assets/avatar/arcade/neon-cat.avif" alt="Neon Cat">
  </label>
</fieldset>
```

Pros:

- Native semantics.
- Screen readers understand selected state.
- Keyboard support is mostly native.

Cons:

- Styling requires visually hidden inputs and careful focus styling.

#### Pattern B: Roving tabindex grid of buttons

Best for Netflix-like card/tile UX.

```html
<div role="grid" aria-label="Avatares disponibles">
  <button role="gridcell" aria-pressed="true" tabindex="0">...</button>
  <button role="gridcell" aria-pressed="false" tabindex="-1">...</button>
</div>
```

Required keyboard support:

- Arrow keys move between avatar tiles.
- Home/End move to first/last tile in a row or collection.
- Enter/Space select the focused avatar.
- Tab exits the grid to the next modal control.

Simpler recommendation:

- Use radio inputs for robust accessibility unless the Netflix-like grid absolutely requires roving arrow-key behavior.
- If using buttons, use `aria-pressed` or `aria-selected` consistently and implement full keyboard behavior.

### 4.4 Form Validation Accessibility

Nickname field should include:

- A visible `<label for="profile-edit-nickname">Nickname</label>`.
- `maxlength="15"` to match current constraints.
- `aria-describedby` pointing to helper text, character count, and error text.
- `aria-invalid="true"` when validation fails.
- Error text with `role="alert"` or an `aria-live="polite"` region.

Save button should:

- Stay enabled when possible and show validation errors on activation, or be disabled with visible explanation.
- Use `aria-busy="true"` on the form or modal section during save.
- Include status text such as “Guardando perfil…” in a live region.

### 4.5 Current Accessibility Risks to Avoid Carrying Forward

- The current avatar control is a label/file-input pattern, not a clear button. It is acceptable for file upload but no longer correct if the click opens a custom modal.
- The current identity modal does not centrally handle Escape close.
- The current invalid nickname flow shows a role-alert message but does not set `aria-invalid` on the input.
- The current character count is announced politely but may be noisy on every character; acceptable, but future copy should be concise.
- The current focus-on-input triggers smooth scrolling after 350 ms. This should be conditional or reduced for users with `prefers-reduced-motion`.

### 4.6 Motion and Interaction Polish (`emil-design-eng`)

The profile modal should feel fast, tactile, and coherent with the app’s neon/glass arcade aesthetic.

| Area | Current / Risk | Recommended Future Behavior | Why |
| --- | --- | --- | --- |
| Modal entrance | Existing `.modal-box` uses `translateY(16px) scale(0.98)` and opacity. | Keep centered modal origin; use opacity + subtle scale/translate, 180–240 ms, exit slightly faster. | Modal is not anchored to a trigger, so center-origin is correct; quick transitions make it responsive. |
| Reduced motion | Global reduced-motion rules shorten animations broadly. | Ensure new modal/avatar-grid transforms are disabled or reduced under `prefers-reduced-motion`. | Motion-sensitive users still need clear state changes without movement. |
| Avatar tile hover | New grid could overuse scale/glow. | Use subtle transform (`translateY(-2px)` or `scale(1.02)`) only under `(hover: hover) and (pointer: fine)`. | Avoid touch hover artifacts and preserve performance. |
| Avatar tile active press | Current buttons use small scale active states. | Add `transform: scale(0.97–0.98)` on pressable avatar tiles and Save/Cancel actions. | Immediate tactile feedback makes the UI feel like it listens. |
| Selection state | Risk of relying only on border color. | Use a checkmark/ring plus text or `aria-pressed`/radio checked state; animate border/shadow only. | Selection must be perceivable and accessible. |
| Upload preview | Existing inline preview mutates global UI before save. | Preview only inside modal; use a small opacity/blur crossfade when switching between preset/upload preview. | Keeps cancellation honest and makes source switching feel deliberate. |
| Saving state | Existing avatar upload has no integrated modal loading state. | Disable destructive/duplicate actions, show spinner/status, keep selected avatar visible with an overlay. | Users need confidence during Supabase sync. |
| Error state | Existing errors go to toast for avatar failures. | Show inline modal error plus toast if needed; keep focus near actionable recovery. | Toast alone is easy to miss and can be inaccessible. |

Performance guidance:

- Animate only `opacity` and `transform` for modal/tile interactions.
- Do not animate width, height, top, left, padding, or grid layout.
- Avoid heavy blur on large modal contents; existing overlay blur is already capped at 4px.
- Use CSS transitions for interruptible hover/selection states rather than keyframes.
- Revoke object URLs after upload preview replacement/close to prevent memory leaks.

### 4.7 Loading, Empty, Error, and Success States

The modal needs explicit states:

- **Loading avatar catalog**: skeleton tiles or concise “Cargando avatares…” status.
- **Empty `/assets/avatar` catalog**: fallback copy and upload CTA.
- **File invalid**: inline message for unsupported file type or too-large image.
- **Compressing/uploading**: modal-level `aria-busy="true"`, disabled Save, visible “Guardando…” copy.
- **Supabase Storage 403/RLS error**: explain fallback or failure clearly.
- **Offline/no session**: either allow local fallback or explain that cloud sync will happen later.
- **Success**: close modal, update all avatar surfaces, optionally show a non-critical toast/status.

---

## 5. Refactor Risk Map

### High-risk couplings

1. **Duplicate avatar change listeners**
   - Inline preview and delegated persistence both listen to `#avatar-upload-profile`.
   - Refactor must avoid leaving both active for a new modal file input unless intentionally scoped.

2. **Single-string avatar storage**
   - `store.userAvatar` currently conflates remote URL, Base64 Data URL, and future local asset path.
   - Supabase sync only accepts HTTP(S) as `avatar_url`.

3. **CSS background rendering**
   - Avatars are not `<img>` elements, so alt text is not available per avatar surface.
   - Works for decorative user avatar displays, but selection grid should use accessible labels.

4. **Sentinel stripping `userAvatar` from `game_data`**
   - If preset avatars are stored only in `store.userAvatar` and not in typed Supabase fields, they will not sync.

5. **Identity modal reuse**
   - Existing identity modal handles welcome and edit modes. Replacing it entirely may affect first-run onboarding.
   - The new profile edit modal should not accidentally break `openIdentityModal('welcome')` unless replacing the onboarding flow intentionally.

### Medium-risk couplings

1. **`profile-title` doubles as section heading and profile nickname display**
   - Changing modal structure should preserve `aria-labelledby="profile-title"` or provide a new stable heading.

2. **`#icon-pencil` sprite usage**
   - Removing inline pencil instances is safe only if no remaining `<use href="#icon-pencil">` references depend on it.
   - Do not remove the symbol unless a repo-wide search confirms no references remain.

3. **Cloud nickname hydration ignores gender**
   - Current `user_profiles` table syncs `nickname` separately but not `gender` separately.
   - If modal edits gender, consider syncing gender explicitly or relying on `game_data` merge.

4. **Object path cache behavior**
   - Upload always writes `${userId}/profile.jpg` with `upsert: true` and `cacheControl: '3600'`.
   - Users may see cached old avatars after upload unless URL cache busting or versioning is added.

---

## 6. Recommended Future Implementation Plan

### Phase 1: Preserve behavior, introduce modal shell

- Add a profile edit modal separate from the welcome identity modal.
- Change profile avatar/name edit affordances to open the new modal.
- Keep existing `GameCenter.setAvatar()` and `setIdentity()` for persistence.
- Move file input into the modal and remove direct profile-avatar label upload behavior.
- Remove or scope the inline raw preview listener so it does not globally mutate committed avatar surfaces before save.

### Phase 2: Add preset avatar manifest

- Create `/assets/avatar/` and a manifest.
- Render collections from manifest.
- Store preset selection as an approved ID in modal draft state.
- Resolve ID to local path through manifest at render time.

### Phase 3: Add typed avatar persistence

- Add client-side avatar descriptor with backwards compatibility for `store.userAvatar`.
- Add Supabase columns or a structured JSON field for typed avatar metadata.
- Update Sentinel upsert/hydration to handle `preset` and `upload` distinctly.
- Keep legacy `avatar_url` support for existing users.

### Phase 4: Polish accessibility and motion

- Extend `ModalA11y` with Escape and initial-focus options.
- Add robust keyboard behavior for avatar selection.
- Add inline save/error/live-region states.
- Add reduced-motion-specific styles for modal and avatar grid transitions.

---

## 7. Validation Checklist for the Future Refactor

When implementation begins, validate these cases:

- Open modal from avatar with mouse, keyboard, and touch.
- Tab stays trapped in modal.
- Escape closes modal and restores focus.
- Cancel discards nickname/avatar draft changes.
- Save commits nickname only.
- Save commits preset avatar only.
- Save commits uploaded avatar only.
- Save commits nickname + avatar together.
- Upload with active Supabase session writes to `avatars/${userId}/profile.jpg` and updates `user_profiles`.
- Upload without/expired Supabase session falls back or errors according to desired product behavior.
- Preset avatar syncs across sessions/devices.
- Legacy remote avatars still render.
- Legacy Base64 avatars still render locally.
- Reduced-motion users get no large transform animations.
- Screen reader announces title, description, errors, selected avatar, and saving state.

---

## 8. Bottom Line

The upcoming Netflix-style modal should be treated as a state architecture refactor, not just a UI restyle. The current implementation is functional but tightly coupled to direct DOM mutation and a single-string avatar model. The safest path is to introduce modal-local draft state first, then migrate avatar persistence to a typed descriptor that can represent Supabase uploads and curated `/assets/avatar/` presets without ambiguity.
