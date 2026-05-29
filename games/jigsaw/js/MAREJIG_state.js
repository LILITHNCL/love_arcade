(function MAREJIG_stateModule(windowObject) {
    'use strict';

    var MAREJIG_state = {
        currentScreen: 'menu',
        selectedLevelId: null,
        selectedRuntimeProfile: null,
        loading: false,
        lastError: null,
        loadedImageResult: null
    };

    function MAREJIG_getState() {
        return Object.assign({}, MAREJIG_state);
    }

    function MAREJIG_setState(patch) {
        MAREJIG_state = Object.assign({}, MAREJIG_state, patch || {});
        return MAREJIG_getState();
    }

    windowObject.MAREJIG_State = Object.freeze({
        getState: MAREJIG_getState,
        setState: MAREJIG_setState
    });
})(window);
