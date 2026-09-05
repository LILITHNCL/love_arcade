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

  function playClaimSequence(_result) {}

  window.StreakHub = {
    refresh,
    playClaimSequence
  };

  document.addEventListener('DOMContentLoaded', refresh);
})();
