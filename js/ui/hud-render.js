// Este script clásico debe cargarse después de game-center.js y coin-display.js,
// y antes de app.js. Centraliza el renderizado del HUD sin exponer el store.
(function initLoveArcadeHudRender() {
    const Store = window.LoveArcadeStore;
    const { animateValue, formatCoinsNavbar } = window.LoveArcadeCoinDisplay;
    const Avatar = window.LoveArcadeAvatar;
    const Identity = window.LoveArcadeIdentity;
    const MoonBlessing = window.LoveArcadeMoonBlessing;
    const GameCenterModule = window.LoveArcadeGameCenter;
    let displayedCoins = Store.getStore().coins;
    let deferredUIFrame = null;

    function showStorageToast(message, type = 'warning') {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast--visible'));
        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 400);
        }, 5200);
    }

    function applyAvatar(scope) {
        if (!Store.getStore().userAvatar) return;
        const avatarSelector = '#user-avatar-display, #hud-avatar-display, #profile-avatar-display, .hud-avatar';
        const avatars = scope
            ? new Set([document.getElementById('user-avatar-display'), ...scope.querySelectorAll('#hud-avatar-display, #profile-avatar-display, .hud-avatar')])
            : document.querySelectorAll(avatarSelector);
        avatars.forEach(el => {
            if (!el) return;
            el.style.backgroundImage = `url('${Store.getStore().userAvatar}')`;
            const icon = el.querySelector('i, svg');
            if (icon) icon.style.display = 'none';
        });
    }

    function applyIdentity() {
        const suffixEl = document.getElementById('pref-suffix');
        const nicknameEl = document.getElementById('display-nickname');
        const profileNameEl = document.getElementById('profile-title');
        if (suffixEl) suffixEl.textContent = Store.getStore().gender || '@';
        if (nicknameEl) nicknameEl.textContent = Store.getStore().nickname || '';
        if (profileNameEl) profileNameEl.textContent = Store.getStore().nickname || 'Love Arcade';
    }

    function updateDailyButton(scope) {
        const root = scope || document;
        const btn = root.querySelector('#btn-daily');
        if (!btn) return;
        const can = window.GameCenter.canClaimDaily();
        const info = window.GameCenter.getStreakInfo();
        const repairMode = Boolean(info.repairAvailable);
        const enabled = repairMode ? Boolean(info.canAffordRepair) : can;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.5';
        btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
        btn.dataset.mode = repairMode ? 'repair' : 'claim';
        btn.setAttribute('aria-label', repairMode ? 'Reparar racha diaria' : 'Reclamar bono diario');

        const ctaTextEl = root.querySelector('#hud-daily-cta-text');
        if (ctaTextEl) ctaTextEl.textContent = repairMode ? 'Reparar racha' : 'Toca para reclamar';
        const msg = root.querySelector('#daily-msg');
        if (msg && repairMode && !info.canAffordRepair) {
            msg.textContent = 'Consigue las monedas que faltan jugando en el Arcade.';
            msg.style.color = '#facc15';
            msg.style.opacity = '1';
        }
        const rewardEl = root.querySelector('#hud-reward-amount');
        if (!rewardEl) return;
        if (repairMode) rewardEl.textContent = `${info.repairCost} 🪙`;
        else if (!can) rewardEl.textContent = `×${info.streak}`;
        else {
            const moonStatus = window.GameCenter.getMoonBlessingStatus();
            rewardEl.textContent = `+${info.nextReward + (moonStatus.active ? 90 : 0)}`;
        }
    }

    function updateMoonBlessingUI(scope) {
        const status = window.GameCenter.getMoonBlessingStatus();
        const moonBadges = scope
            ? new Set([...document.querySelectorAll('.navbar .moon-blessing-badge'), ...scope.querySelectorAll('.moon-blessing-badge')])
            : document.querySelectorAll('.moon-blessing-badge');
        moonBadges.forEach(badge => {
            badge.classList.toggle('hidden', !status.active);
            if (status.active) badge.title = `Bendición Lunar activa hasta ${status.expiresAt}`;
        });
        const root = scope || document;
        const moonBtn = root.querySelector('#btn-moon-blessing');
        if (!moonBtn) return;
        const statusEl = root.querySelector('#moon-blessing-status');
        if (status.active) {
            moonBtn.textContent = 'Extender Bendición (+7 días)';
            if (statusEl) statusEl.textContent = `Activa hasta ${status.expiresAt}`;
        } else {
            moonBtn.textContent = 'Activar Bendición Lunar (100 monedas)';
            if (statusEl) statusEl.textContent = 'Inactiva';
        }
    }

    function updateUI({ scope } = {}) {
        const coins = Store.getStore().coins;
        const navbarDisplays = Array.from(document.querySelectorAll('.navbar .coin-display'));
        const displayRoot = scope || document;
        const otherDisplays = Array.from(displayRoot.querySelectorAll('.coin-display'))
            .filter(el => !el.matches('.navbar .coin-display') && !el.closest('.view-section.hidden'));
        if (displayedCoins === coins) {
            navbarDisplays.forEach(el => {
                el.textContent = formatCoinsNavbar(coins);
                el.closest('.coin-badge')?.setAttribute('title', `${coins} monedas`);
            });
            otherDisplays.forEach(el => { el.textContent = coins; });
        } else {
            animateValue([...navbarDisplays, ...otherDisplays], displayedCoins, coins, 650, (value) => { displayedCoins = value; });
            if (navbarDisplays.length) {
                setTimeout(() => navbarDisplays.forEach(el => { el.textContent = formatCoinsNavbar(Store.getStore().coins); }), 700);
            }
        }
        applyAvatar(scope);
        updateDailyButton(scope);
        updateMoonBlessingUI(scope);
    }

    function setDailyMessage(message, success = false) {
        const msg = document.getElementById('daily-msg');
        if (!msg) return;
        msg.textContent = message;
        msg.style.color = success ? '#4ade80' : '#facc15';
        msg.style.opacity = '1';
        setTimeout(() => { msg.style.opacity = '0'; }, 3500);
    }

    function showDailyRepairModal() {
        const modal = document.getElementById('daily-repair-modal');
        const messageEl = document.getElementById('daily-repair-message');
        const confirmBtn = document.getElementById('btn-daily-repair-confirm');
        const cancelBtn = document.getElementById('btn-daily-repair-cancel');
        const info = window.GameCenter.getStreakInfo();
        if (!modal || !messageEl || !confirmBtn || !cancelBtn || !info.repairAvailable) return;
        messageEl.textContent = `¿Quieres usar ${info.repairCost} monedas para rescatar tu racha de ${info.streak} día${info.streak !== 1 ? 's' : ''}? 🪙✨`;
        modal.classList.remove('hidden');
        modal.classList.add('daily-repair-overlay--visible');
        confirmBtn.disabled = !info.canAffordRepair;
        confirmBtn.focus();
        const close = () => {
            modal.classList.add('hidden');
            modal.classList.remove('daily-repair-overlay--visible');
            document.getElementById('btn-daily')?.focus();
        };
        cancelBtn.onclick = close;
        confirmBtn.onclick = () => {
            confirmBtn.disabled = true;
            const result = window.GameCenter.repairDailyStreak();
            close();
            setDailyMessage(result.message, result.success);
            updateUI();
            updateDailyButton();
            window.updateStreakBar?.();
        };
    }

    function revealUI() {
        requestAnimationFrame(() => {
            document.querySelectorAll('.coin-badge').forEach(el => el.classList.add('coin-badge--visible'));
            document.querySelectorAll('.hud-avatar-wrap').forEach(el => el.classList.add('is-ready'));
            document.querySelectorAll('.player-hud').forEach(el => el.classList.add('is-ready'));
        });
    }

    function syncInitialCoinDisplay() {
        displayedCoins = Store.getStore().coins;
        document.querySelectorAll('.navbar .coin-display').forEach(el => { el.textContent = formatCoinsNavbar(displayedCoins); });
        document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => { el.textContent = displayedCoins; });
    }

    function scheduleUIUpdate() {
        if (deferredUIFrame !== null) return;
        deferredUIFrame = requestAnimationFrame(() => {
            deferredUIFrame = null;
            updateUI();
        });
    }

    Store.setStorageToastHandler(showStorageToast);
    Store.subscribe((_state, { source, notifyUI = true } = {}) => {
        if (source === 'save' && notifyUI) scheduleUIUpdate();
    });
    GameCenterModule.setUIRefreshHandler((scope) => {
        displayedCoins = Store.getStore().coins;
        updateUI({ scope });
    });
    Avatar.setUIRefreshHandler(applyAvatar);
    Identity.setUIRefreshHandler(applyIdentity);
    MoonBlessing.setUIRefreshHandler(updateMoonBlessingUI);

    window.LoveArcadeHUD = {
        applyAvatar, applyIdentity, revealUI, setDailyMessage, showDailyRepairModal,
        syncInitialCoinDisplay, updateDailyButton, updateMoonBlessingUI, updateUI
    };
    window.revealUI = revealUI;
})();
