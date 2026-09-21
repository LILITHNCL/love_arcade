// Este script clásico debe cargarse después de core/config.js y core/state-store.js,
// y antes de domain/game-center.js y app.js.
(function initLoveArcadeTheming() {
    const { THEMES } = window;
    const Store = window.LoveArcadeStore;

    function deriveThemeRoles(hex) {
        const match = typeof hex === 'string' && hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (!match) throw new TypeError(`Invalid theme accent: ${hex}`);

        const digits = match[1].length === 3 ? match[1].split('').map(channel => channel + channel).join('') : match[1];
        const accent = `#${digits.toUpperCase()}`;
        const rgb = [0, 2, 4].map(offset => parseInt(digits.slice(offset, offset + 2), 16) / 255);
        const linear = rgb.map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
        const luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);

        return {
            accent,
            accentHover: `color-mix(in srgb, ${accent} 82%, #ffffff 18%)`,
            accentDim: `color-mix(in srgb, ${accent} 72%, #0b0d14 28%)`,
            accentSoft: `color-mix(in srgb, ${accent} 28%, #0b0d14 72%)`,
            accentSoftStrong: `color-mix(in srgb, ${accent} 44%, #0b0d14 56%)`,
            accentBorder: `color-mix(in srgb, ${accent} 62%, #20263a 38%)`,
            accentGlow: `color-mix(in srgb, ${accent} 34%, #0a0d18 66%)`,
            surfaceNav: `color-mix(in srgb, ${accent} 8%, #050508 92%)`,
            onAccent: luminance > 0.7 ? '#0b0d14' : '#ffffff'
        };
    }

    function applyTheme(key) {
        const t = THEMES[key] || THEMES.violet;
        const root = document.documentElement;
        const roles = deriveThemeRoles(t.accent);
        root.style.setProperty('--accent', roles.accent);
        root.style.setProperty('--accent-hover', roles.accentHover);
        root.style.setProperty('--accent-glow', roles.accentGlow);
        root.style.setProperty('--accent-dim', roles.accentDim);
        root.style.setProperty('--accent-soft', roles.accentSoft);
        root.style.setProperty('--accent-soft-strong', roles.accentSoftStrong);
        root.style.setProperty('--accent-border', roles.accentBorder);
        root.style.setProperty('--surface-nav', roles.surfaceNav);
        root.style.setProperty('--on-accent', roles.onAccent);

        const bodyClasses = document.body.classList;
        const nextThemeClass = `theme-${key}`;
        const prevThemeClass = document.body.dataset.activeThemeClass;
        if (!prevThemeClass) {
            Array.from(bodyClasses).forEach((className) => {
                if (className.startsWith('theme-') && className !== nextThemeClass) bodyClasses.remove(className);
            });
        } else if (prevThemeClass !== nextThemeClass) {
            bodyClasses.remove(prevThemeClass);
        }
        if (!bodyClasses.contains(nextThemeClass)) bodyClasses.add(nextThemeClass);
        document.body.dataset.activeThemeClass = nextThemeClass;
        root.setAttribute('data-theme', key);

        const themeButtons = document.querySelectorAll('.theme-btn');
        const activeButton = document.querySelector(`.theme-btn[data-theme="${key}"]`);
        themeButtons.forEach(btn => {
            const isActive = btn.dataset.theme === key;
            if (!isActive && btn.classList.contains('theme-btn--active')) {
                btn.classList.remove('theme-btn--active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
        if (activeButton) {
            activeButton.classList.add('theme-btn--active');
            activeButton.setAttribute('aria-pressed', 'true');
        }
    }

    function setTheme(key) {
        if (!THEMES[key]) return;
        Store.getStore().theme = key;
        Store.save();
        applyTheme(key);
    }

    window.LoveArcadeTheming = { deriveThemeRoles, applyTheme, setTheme, getTheme: () => Store.getStore().theme || 'violet' };
})();
