(function () {
  'use strict';

  const SKIN_MANIFEST_PATH = 'assets/skins/manifest.json';
  const FALLBACK_SKIN_ID = 'arcade-default';
  const ICON_SPRITE_MOUNT_ID = 'skin-icon-sprite-mount';
  const SKIN_METRIC_KEY = 'love_arcade_skin_metric_v1';

  const BUILTIN_SKINS = {
    'arcade-default': {
      id: 'arcade-default',
      displayName: 'Arcade Default',
      version: '1.1.0',
      themeKey: 'violet',
      tokens: { accent: '#9b59ff', accentGlow: 'rgba(155, 89, 255, 0.4)', textMed: '#b4b4c8', textLow: '#6a6a82' },
      typography: {
        display: "'Exo 2', Arial, system-ui, sans-serif",
        body: "'DM Sans', Arial, system-ui, sans-serif",
        mono: "'JetBrains Mono', 'Courier New', monospace"
      },
      backgrounds: { home: '', cards: '' },
      icons: { sprite: '', aliases: {} },
      gameCards: {},
      effects: { particles: 'off', profile: 'balanced' },
      meta: { author: 'Love Arcade', license: 'internal' }
    },
    'hutao-ember': {
      id: 'hutao-ember',
      displayName: 'Hu Tao Ember',
      version: '1.1.0',
      themeKey: 'crimson',
      tokens: { accent: '#e35a5a', accentGlow: 'rgba(227,90,90,0.45)', textMed: '#f3d9d9', textLow: '#d6a6a6' },
      typography: {
        display: "'Exo 2', Arial, system-ui, sans-serif",
        body: "'DM Sans', Arial, system-ui, sans-serif",
        mono: "'JetBrains Mono', 'Courier New', monospace"
      },
      backgrounds: {
        home: 'assets/skins/hutao-ember/backgrounds/home-bg.svg',
        cards: 'assets/skins/hutao-ember/backgrounds/card-bg.svg'
      },
      icons: {
        sprite: 'assets/skins/hutao-ember/icons.svg',
        aliases: {
          check: 'icon-check-hutao',
          palette: 'icon-palette-hutao',
          moon: 'icon-moon-hutao',
          coin: 'icon-coin-hutao'
        }
      },
      gameCards: {
        'jungle-dash': 'assets/skins/hutao-ember/cards/jungle-dash.svg',
        'word-hunt': 'assets/skins/hutao-ember/cards/word-hunt.svg'
      },
      effects: { particles: 'embers', profile: 'balanced' },
      meta: { author: 'Love Arcade', license: 'fan-art-placeholder' }
    }
  };

  const runtime = {
    manifest: null,
    skinMap: { ...BUILTIN_SKINS },
    profile: 'balanced',
    activeSkinId: FALLBACK_SKIN_ID,
    iconAliasCache: new Map(),
    observer: null
  };

  function resolveProfile() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return 'lite';
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const small = window.innerWidth <= 480;
    if (coarse && small) return 'lite';
    if (coarse) return 'balanced';
    return 'full';
  }

  async function loadManifest() {
    try {
      const res = await fetch(SKIN_MANIFEST_PATH, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) { return null; }
  }

  function setCssVar(name, value) {
    if (!value) return;
    document.documentElement.style.setProperty(name, value);
  }


  function track(event, payload = {}) {
    try {
      window.GhostAnalytics?.track?.(event, { component: 'skin_system', ...payload });
    } catch (_) { /* noop */ }
  }

  function validateAliasCoverage(skin) {
    const required = runtime.manifest?.requiredIconAliases || [];
    if (!required.length) return;
    const missing = required.filter(a => !resolveSkinIconId(a, skin));
    if (missing.length) {
      track('missing_skin_icon_alias', { skinId: skin.id, missing: missing.join(',') });
      console.warn('[SkinManager] Missing icon aliases for skin', skin.id, missing);
    }
  }



  function markTransition(active) {
    document.documentElement.setAttribute('data-skin-transition', active ? '1' : '0');
  }

  function lockInteraction(active) {
    document.documentElement.setAttribute('data-skin-interaction-lock', active ? '1' : '0');
  }

  function trackUXMetric(type, payload = {}) {
    track('skin_ux_' + type, payload);
    try {
      const now = Date.now();
      const raw = localStorage.getItem(SKIN_METRIC_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      const data = { ...prev, ...payload, type, ts: now };
      localStorage.setItem(SKIN_METRIC_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function setLoading(isLoading) {
    document.documentElement.setAttribute('data-skin-loading', String(Boolean(isLoading)));
  }

  function notify(message) {
    const old = document.querySelector('.skin-apply-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'skin-apply-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  async function loadSkinFonts(skin) {
    const fonts = skin?.typography?.fontAssets || [];
    if (!fonts.length || !('FontFace' in window)) return;
    await Promise.all(fonts.map(async (f) => {
      try {
        const ff = new FontFace(f.family, `url(${f.url})`, { weight: f.weight || '400', style: f.style || 'normal', display: 'swap' });
        await ff.load();
        document.fonts.add(ff);
      } catch (err) {
        track('missing_skin_asset', { type: 'font', skinId: skin.id, path: f.url, error: String(err?.message || err) });
      }
    }));
  }

  function applyTokenLayer(skin) {
    const t = skin.tokens || {};
    setCssVar('--accent', t.accent);
    setCssVar('--accent-glow', t.accentGlow);
    setCssVar('--text-med', t.textMed);
    setCssVar('--text-low', t.textLow);
  }

  function applyTypographyLayer(skin) {
    const typo = skin.typography || {};
    setCssVar('--font-display', typo.display);
    setCssVar('--font-body', typo.body);
    setCssVar('--font-mono', typo.mono);
  }

  function applyClassLayer(skinId) {
    const body = document.body;
    if (!body) return;
    [...body.classList].forEach(c => c.startsWith('skin-') && body.classList.remove(c));
    body.classList.add(`skin-${skinId}`);
    document.documentElement.setAttribute('data-skin', skinId);
    document.documentElement.setAttribute('data-skin-profile', runtime.profile);
  }

  function mountSprite(svgText) {
    let mount = document.getElementById(ICON_SPRITE_MOUNT_ID);
    if (!mount) {
      mount = document.createElement('div');
      mount.id = ICON_SPRITE_MOUNT_ID;
      mount.setAttribute('aria-hidden', 'true');
      mount.style.display = 'none';
      document.body.prepend(mount);
    }
    mount.innerHTML = svgText;
    return mount.querySelector('svg');
  }

  async function loadSkinSprite(skin) {
    const spritePath = skin?.icons?.sprite;
    runtime.iconAliasCache.clear();
    if (!spritePath) return null;
    try {
      const res = await fetch(spritePath, { cache: 'force-cache' });
      if (!res.ok) return null;
      const text = await res.text();
      const svg = mountSprite(text);
      if (!svg) return null;
      svg.querySelectorAll('symbol[id]').forEach(sym => runtime.iconAliasCache.set(sym.id, true));
      return svg;
    } catch (err) {
      track('missing_skin_asset', { type: 'icon_sprite', skinId: skin?.id || 'unknown', path: spritePath, error: String(err?.message || err) });
      return null;
    }
  }

  function deriveAliasFromUse(useEl) {
    const explicit = useEl.closest('[data-skin-icon]')?.getAttribute('data-skin-icon');
    if (explicit) return explicit;
    const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || '';
    const id = href.replace(/^#/, '').trim();
    return id.startsWith('icon-') ? id.slice(5) : id;
  }

  function resolveSkinIconId(alias, skin) {
    const mapped = skin?.icons?.aliases?.[alias];
    if (mapped && runtime.iconAliasCache.has(mapped)) return mapped;
    const canonical = `icon-${alias}`;
    if (runtime.iconAliasCache.has(canonical)) return canonical;
    return null;
  }

  function refreshSkinIcons(skin) {
    const uses = document.querySelectorAll('svg use');
    uses.forEach(useEl => {
      if (!useEl.dataset.baseHref) {
        const baseHref = useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || '';
        useEl.dataset.baseHref = baseHref;
      }
      const alias = deriveAliasFromUse(useEl);
      const skinIconId = resolveSkinIconId(alias, skin);
      if (skinIconId) {
        useEl.setAttribute('href', `#${skinIconId}`);
        return;
      }
      useEl.setAttribute('href', useEl.dataset.baseHref);
    });
  }

  function applyAssetLayer(skin) {
    const bgHome = skin.backgrounds?.home;
    if (bgHome) setCssVar('--skin-bg-home', `url('${bgHome}')`);
    else setCssVar('--skin-bg-home', 'none');

    const bgCards = skin.backgrounds?.cards;
    if (bgCards) setCssVar('--skin-bg-cards', `url('${bgCards}')`);
    else setCssVar('--skin-bg-cards', 'none');

    document.querySelectorAll('[data-skin-bg]').forEach(el => {
      const key = el.getAttribute('data-skin-bg');
      if (key === 'home' && bgHome) el.style.backgroundImage = `var(--skin-bg-home)`;
      if (key === 'cards' && bgCards) el.style.backgroundImage = `var(--skin-bg-cards)`;
    });

    document.querySelectorAll('[data-skin-card-image]').forEach(el => {
      const gameId = el.getAttribute('data-skin-card-image');
      const src = skin.gameCards?.[gameId];
      if (!el.dataset.baseSkinSrc) {
        el.dataset.baseSkinSrc = el.tagName === 'IMG' ? (el.getAttribute('src') || '') : (el.style.backgroundImage || '');
      }
      if (!src) {
        if (el.tagName === 'IMG') el.setAttribute('src', el.dataset.baseSkinSrc);
        else el.style.backgroundImage = el.dataset.baseSkinSrc;
        return;
      }
      if (el.tagName === 'IMG') el.setAttribute('src', src);
      else el.style.backgroundImage = `url('${src}')`;
    });
  }


  function applyLayoutLayer(skin) {
    document.documentElement.setAttribute('data-skin-layout-hud', skin.layout?.hud || 'default');
    document.documentElement.setAttribute('data-skin-layout-cards', skin.layout?.cards || 'default');
    document.documentElement.setAttribute('data-skin-layout-nav', skin.layout?.nav || 'default');
    document.documentElement.setAttribute('data-skin-cta', skin.cta?.style || 'default');
    document.documentElement.setAttribute('data-skin-cta-radius', skin.cta?.radius || 'default');
  }

  function applySceneLayer(skin) {
    const scene = skin.scene || {};
    setCssVar('--skin-scene-overlay', scene.overlay ? `url('${scene.overlay}')` : 'none');
    setCssVar('--skin-vignette-opacity', typeof scene.vignette === 'number' ? String(scene.vignette) : '0');
    setCssVar('--skin-grain-opacity', typeof scene.grain === 'number' ? String(scene.grain) : '0');
  }

  function applyEffectsLayer(skin) {
    const effects = skin.effects || {};
    document.documentElement.setAttribute('data-skin-particles', effects.particles || 'off');
  }

  function getSkin(id) { return runtime.skinMap[id] || runtime.skinMap[FALLBACK_SKIN_ID]; }
  function listSkins() { return Object.values(runtime.skinMap); }


  function ensureObserver() {
    if (runtime.observer) return;
    runtime.observer = new MutationObserver(() => {
      const skin = getSkin(runtime.activeSkinId);
      refreshSkinIcons(skin);
    });
    runtime.observer.observe(document.body, { childList: true, subtree: true });
  }

  async function applySkin(skinId) {
    const skin = getSkin(skinId);
    const startTs = performance.now();
    setLoading(true);
    markTransition(true);
    lockInteraction(true);
    runtime.activeSkinId = skin.id;
    applyTokenLayer(skin);
    await loadSkinFonts(skin);
    applyTypographyLayer(skin);
    applyClassLayer(skin.id);
    applyAssetLayer(skin);
    applyLayoutLayer(skin);
    applySceneLayer(skin);
    applyEffectsLayer(skin);
    const t0 = performance.now();
    const sprite = await loadSkinSprite(skin);
    refreshSkinIcons(skin);
    validateAliasCoverage(skin);
    ensureObserver();
    const elapsed = Math.round(performance.now() - t0);
    track('skin_apply_success', { skinId: skin.id, hasSprite: Boolean(sprite), ms: elapsed });
    notify(`Skin aplicada: ${skin.displayName || skin.id}`);
    setTimeout(() => { markTransition(false); lockInteraction(false); }, 200);
    setLoading(false);
    trackUXMetric('apply_time', { skinId: skin.id, durationMs: Math.round(performance.now() - startTs) });
    trackUXMetric('adoption', { skinId: skin.id });
    return skin;
  }

  async function init() {
    runtime.profile = resolveProfile();
    runtime.manifest = await loadManifest();
    if (runtime.manifest?.skins) {
      runtime.manifest.skins.forEach(s => {
        if (!s.id) return;
        runtime.skinMap[s.id] = { ...runtime.skinMap[s.id], ...s };
      });
    }
  }

  window.SkinManager = { init, applySkin, getSkin, listSkins, resolveProfile, refreshSkinIcons };
})();
