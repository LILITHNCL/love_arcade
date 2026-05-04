(function () {
  'use strict';

  const SKIN_MANIFEST_PATH = 'assets/skins/manifest.json';
  const FALLBACK_SKIN_ID = 'arcade-default';

  const BUILTIN_SKINS = {
    'arcade-default': {
      id: 'arcade-default',
      displayName: 'Arcade Default',
      version: '1.0.0',
      themeKey: 'violet',
      tokens: {
        accent: '#9b59ff',
        accentGlow: 'rgba(155, 89, 255, 0.4)',
        textMed: '#b4b4c8',
        textLow: '#6a6a82'
      },
      typography: {
        display: "'Exo 2', Arial, system-ui, sans-serif",
        body: "'DM Sans', Arial, system-ui, sans-serif",
        mono: "'JetBrains Mono', 'Courier New', monospace"
      },
      backgrounds: { home: '', cards: '' },
      icons: { sprite: '' },
      gameCards: {},
      effects: { particles: 'off', profile: 'balanced' },
      meta: { author: 'Love Arcade', license: 'internal' }
    },
    'hutao-ember': {
      id: 'hutao-ember',
      displayName: 'Hu Tao Ember',
      version: '1.0.0',
      themeKey: 'crimson',
      tokens: {
        accent: '#e35a5a',
        accentGlow: 'rgba(227,90,90,0.45)',
        textMed: '#f3d9d9',
        textLow: '#d6a6a6'
      },
      typography: {
        display: "'Exo 2', Arial, system-ui, sans-serif",
        body: "'DM Sans', Arial, system-ui, sans-serif",
        mono: "'JetBrains Mono', 'Courier New', monospace"
      },
      backgrounds: {
        home: 'assets/skins/hutao-ember/backgrounds/home-bg.webp',
        cards: 'assets/skins/hutao-ember/backgrounds/card-bg.webp'
      },
      icons: { sprite: 'assets/skins/hutao-ember/icons.svg' },
      gameCards: {
        'jungle-dash': 'assets/skins/hutao-ember/cards/jungle-dash.webp',
        'word-hunt': 'assets/skins/hutao-ember/cards/word-hunt.webp'
      },
      effects: { particles: 'embers', profile: 'balanced' },
      meta: { author: 'Love Arcade', license: 'fan-art-placeholder' }
    }
  };

  const runtime = {
    manifest: null,
    skinMap: { ...BUILTIN_SKINS },
    profile: 'balanced'
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
    } catch (_) {
      return null;
    }
  }

  function setCssVar(name, value) {
    if (!value) return;
    document.documentElement.style.setProperty(name, value);
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

  function applyAssetLayer(skin) {
    const bgHome = skin.backgrounds?.home;
    if (bgHome) setCssVar('--skin-bg-home', `url('${bgHome}')`);
    const bgCards = skin.backgrounds?.cards;
    if (bgCards) setCssVar('--skin-bg-cards', `url('${bgCards}')`);

    document.querySelectorAll('[data-skin-bg]').forEach(el => {
      const key = el.getAttribute('data-skin-bg');
      if (key === 'home' && bgHome) el.style.backgroundImage = `var(--skin-bg-home)`;
      if (key === 'cards' && bgCards) el.style.backgroundImage = `var(--skin-bg-cards)`;
    });

    document.querySelectorAll('[data-skin-card-image]').forEach(el => {
      const gameId = el.getAttribute('data-skin-card-image');
      const src = skin.gameCards?.[gameId];
      if (!src) return;
      if (el.tagName === 'IMG') el.setAttribute('src', src);
      else el.style.backgroundImage = `url('${src}')`;
    });
  }

  function applyEffectsLayer(skin) {
    const effects = skin.effects || {};
    document.documentElement.setAttribute('data-skin-particles', effects.particles || 'off');
  }

  function getSkin(id) {
    return runtime.skinMap[id] || runtime.skinMap[FALLBACK_SKIN_ID];
  }

  function listSkins() { return Object.values(runtime.skinMap); }

  function applySkin(skinId) {
    const skin = getSkin(skinId);
    applyTokenLayer(skin);
    applyTypographyLayer(skin);
    applyClassLayer(skin.id);
    applyAssetLayer(skin);
    applyEffectsLayer(skin);
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

  window.SkinManager = { init, applySkin, getSkin, listSkins, resolveProfile };
})();
