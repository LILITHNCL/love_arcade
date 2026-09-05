(function StreakHubModule() {
  'use strict';

  /**
   * Traduce el estado de negocio existente a la representación visual del hub.
   * No crea timers: se invoca desde los puntos de refresco ya establecidos.
   */
  function _syncFlameState() {
    const flameEl = document.getElementById('streak-flame');
    const bigNumberEl = document.getElementById('streak-count-big');
    const numberWrapEl = bigNumberEl?.closest('.streak-hub-number');
    if (!flameEl) return;

    const info = window.GameCenter?.getStreakInfo?.();
    const can = window.GameCenter?.canClaimDaily?.();
    if (!info) return;

    let state;
    if (info.repairAvailable) {
      state = 'repair';
    } else if (info.streak === 0 && can) {
      state = 'locked';
    } else if (can) {
      state = 'available';
    } else {
      state = 'claimed';
    }

    flameEl.dataset.state = state;

    if (bigNumberEl) bigNumberEl.textContent = String(info.streak);
    if (numberWrapEl) {
      numberWrapEl.setAttribute(
        'aria-label',
        `Racha actual: ${info.streak} día${info.streak !== 1 ? 's' : ''}`
      );
    }
  }

  function refresh() {
    _syncFlameState();
  }

  function _spawnCoinBurst(count = 8) {
    const container = document.getElementById('streak-coin-burst');
    if (!container) return;

    for (let i = 0; i < count; i += 1) {
      const coin = document.createElement('span');
      coin.className = 'coin';

      // El burst sale hacia arriba con dispersión lateral, en dirección general
      // al saldo real que vive en la navbar.
      const angle = (Math.PI / 3) + (Math.random() * Math.PI / 3);
      const distance = 100 + (Math.random() * 70);
      const x = Math.cos(angle) * distance * (Math.random() < 0.5 ? -1 : 1);
      const y = -Math.abs(Math.sin(angle) * distance) - 60;
      coin.style.setProperty('--coin-x', `${x}px`);
      coin.style.setProperty('--coin-y', `${y}px`);
      coin.style.animationDelay = `${i * 22}ms`;
      coin.addEventListener('animationend', () => coin.remove(), { once: true });
      container.appendChild(coin);
    }
  }

  function _bumpStreakNumber() {
    const el = document.getElementById('streak-count-big');
    if (!el) return;

    el.classList.remove('is-bumping');
    // Fuerza el reinicio de la animación cuando se vuelve a reclamar.
    void el.offsetWidth;
    el.classList.add('is-bumping');
    el.addEventListener('animationend', () => el.classList.remove('is-bumping'), { once: true });
  }

  function playClaimSequence(result) {
    const flameEl = document.getElementById('streak-flame');
    if (!flameEl || !result?.success) {
      refresh();
      return;
    }

    flameEl.dataset.state = 'claiming';

    window.setTimeout(() => {
      refresh();
      _bumpStreakNumber();
      _spawnCoinBurst(8);
      window.StreakHub.playClaimAudio?.();

      if (navigator.vibrate && (navigator.userActivation?.isActive || navigator.userActivation?.hasBeenActive)) {
        navigator.vibrate([12, 30, 18]);
      }
    }, 480);
  }

  window.StreakHub = {
    refresh,
    playClaimSequence
  };

  document.addEventListener('DOMContentLoaded', refresh);
})();
