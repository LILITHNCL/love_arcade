// Este script clásico debe cargarse después de core/state-store.js y antes de app.js.
(function initLoveArcadeIdentity() {
    const Store = window.LoveArcadeStore;
    let refreshUI = () => {};
    const VALID_GENDERS = ['o', 'a', '@'];

    function setIdentity(nickname, gender) {
        const store = Store.getStore();
        store.nickname = String(nickname).trim().slice(0, 15);
        store.gender = VALID_GENDERS.includes(gender) ? gender : '@';
        Store.save();
        refreshUI();
    }

    function getIdentity() {
        const store = Store.getStore();
        return { nickname: store.nickname || '', gender: store.gender || '@' };
    }

    function hasIdentity() {
        return Boolean(Store.getStore().nickname?.trim());
    }

    window.LoveArcadeIdentity = {
        setIdentity,
        getIdentity,
        hasIdentity,
        setUIRefreshHandler: (handler) => { refreshUI = typeof handler === 'function' ? handler : () => {}; }
    };
})();
