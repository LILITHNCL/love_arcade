(function MAREJIG_audioModule(windowObject) {
    'use strict';

    var MAREJIG_audioState = { context: null, enabled: true, supported: true, unlocked: false, lastSelectAt: 0, lastSnapAt: 0 };

    function MAREJIG_getSettingsEnabled() {
        var storage = windowObject.MAREJIG_Storage;
        if (!storage || typeof storage.getSettings !== 'function') return true;
        return storage.getSettings().sound !== false;
    }

    function MAREJIG_init() {
        MAREJIG_audioState.supported = Boolean(windowObject.AudioContext || windowObject.webkitAudioContext);
        MAREJIG_audioState.enabled = MAREJIG_getSettingsEnabled();
        return MAREJIG_Audio;
    }

    function MAREJIG_unlock() {
        MAREJIG_audioState.enabled = MAREJIG_getSettingsEnabled();
        if (!MAREJIG_audioState.enabled || !MAREJIG_audioState.supported) return false;
        if (!MAREJIG_audioState.context) {
            var AudioCtor = windowObject.AudioContext || windowObject.webkitAudioContext;
            try { MAREJIG_audioState.context = new AudioCtor(); }
            catch (error) { MAREJIG_audioState.supported = false; return false; }
        }
        if (MAREJIG_audioState.context && MAREJIG_audioState.context.state === 'suspended' && MAREJIG_audioState.context.resume) {
            try { MAREJIG_audioState.context.resume(); } catch (error) { return false; }
        }
        MAREJIG_audioState.unlocked = true;
        return true;
    }

    function MAREJIG_setEnabled(enabled) {
        MAREJIG_audioState.enabled = enabled !== false;
        return MAREJIG_audioState.enabled;
    }

    function MAREJIG_playTone(frequency, start, duration, gainValue, type) {
        var context = MAREJIG_audioState.context;
        if (!context) return;
        var osc = context.createOscillator();
        var gain = context.createGain();
        var filter = context.createBiquadFilter ? context.createBiquadFilter() : null;
        osc.type = type || 'triangle';
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + Math.min(0.018, duration * 0.22));
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        if (filter) {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1800, start);
            filter.Q.setValueAtTime(0.4, start);
            osc.connect(filter);
            filter.connect(gain);
        } else osc.connect(gain);
        gain.connect(context.destination);
        osc.start(start);
        osc.stop(start + duration + 0.025);
    }

    function MAREJIG_canPlay(kind, throttleMs) {
        if (!MAREJIG_getSettingsEnabled()) return false;
        if (!MAREJIG_audioState.context && !MAREJIG_unlock()) return false;
        if (!MAREJIG_audioState.enabled || !MAREJIG_audioState.supported || !MAREJIG_audioState.context) return false;
        var now = Date.now();
        var key = kind === 'snap' ? 'lastSnapAt' : 'lastSelectAt';
        if (now - MAREJIG_audioState[key] < throttleMs) return false;
        MAREJIG_audioState[key] = now;
        return true;
    }

    function MAREJIG_playSelect() {
        if (!MAREJIG_canPlay('select', 80)) return false;
        var context = MAREJIG_audioState.context;
        var now = context.currentTime;
        MAREJIG_playTone(520, now, 0.052, 0.022, 'triangle');
        MAREJIG_playTone(880, now + 0.008, 0.038, 0.010, 'sine');
        return true;
    }

    function MAREJIG_playSnap() {
        if (!MAREJIG_canPlay('snap', 120)) return false;
        var context = MAREJIG_audioState.context;
        var now = context.currentTime;
        MAREJIG_playTone(392, now, 0.105, 0.024, 'triangle');
        MAREJIG_playTone(659, now + 0.045, 0.135, 0.020, 'sine');
        return true;
    }

    var MAREJIG_Audio = Object.freeze({ init: MAREJIG_init, unlock: MAREJIG_unlock, setEnabled: MAREJIG_setEnabled, playSelect: MAREJIG_playSelect, playSnap: MAREJIG_playSnap, state: MAREJIG_audioState });
    windowObject.MAREJIG_Audio = MAREJIG_Audio;
})(window);
