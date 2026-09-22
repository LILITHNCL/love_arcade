// Este script clásico debe cargarse después de core/config.js y antes de app.js.
(function initLoveArcadeThemeGrid() {
    function renderThemeGrid() {
        const grid = document.getElementById('theme-grid');
        if (!grid) return;

        const fragment = document.createDocumentFragment();
        Object.entries(window.THEMES).forEach(([key, theme]) => {
            const button = document.createElement('button');
            button.className = 'theme-btn';
            button.type = 'button';
            button.dataset.theme = key;
            button.setAttribute('aria-pressed', 'false');

            const swatch = document.createElement('span');
            swatch.className = 'theme-swatch';
            swatch.style.setProperty('--theme-swatch-color', theme.accent);
            const name = document.createElement('span');
            name.className = 'theme-name';
            name.textContent = theme.name;
            const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            check.classList.add('icon', 'theme-check');
            check.setAttribute('width', '12');
            check.setAttribute('height', '12');
            check.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#icon-check');
            check.append(use);
            button.append(swatch, name, check);
            fragment.append(button);
        });
        grid.replaceChildren(fragment);
    }

    document.getElementById('theme-grid')?.addEventListener('click', (event) => {
        const button = event.target.closest('.theme-btn');
        if (button) window.GameCenter?.setTheme?.(button.dataset.theme);
    });

    window.LoveArcadeThemeGrid = { renderThemeGrid };
})();
