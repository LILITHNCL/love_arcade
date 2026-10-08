// Rive-backed daily streak visual lifecycle. T1 owns runtime/lifecycle only.
(function initStreakHub() {
    const RIVE_SRC = '/assets/rive/fire-streak.riv';
    const RIVE_RUNTIME_SRC = '/assets/rive/runtime/2.44.0/rive.js';
    const RIVE_WASM_SRC = '/assets/rive/runtime/2.44.0/rive.wasm';
    const STATE_MACHINE = 'State Machine 1';
    const SLOW_RATE = 0.75;
    const IO_OPTIONS = { threshold: [0, 0.25] };

    let shell = null;
    let canvas = null;
    let rive = null;
    let viewModelStreak = null;
    let slowDriver = null;
    let intersectionObserver = null;
    let resizeObserver = null;
    let resizeFrame = null;
    let slowFrame = null;
    let runtimePromise = null;
    let runtimeFailed = false;
    let visible = false;
    let inViewport = false;
    let destroyed = false;
    let state = 'claimed';

    const raf = (callback) => window.requestAnimationFrame(callback);
    const caf = (id) => window.cancelAnimationFrame(id);

    function getGameStreak() {
        return Number(window.GameCenter?.getStreakInfo?.()?.streak || 0);
    }

    function setShellState(nextState) {
        state = nextState === 'available' ? 'available' : 'claimed';
        if (shell) shell.dataset.state = state;
        const glowLayer = document.getElementById('player-hud-glow');
        if (glowLayer) glowLayer.dataset.state = state;
    }

    function getSlowDriver() {
        const animator = rive?.animator;
        const machines = animator?.stateMachines;
        const driver = machines?.find?.((machine) => machine?.name === STATE_MACHINE);
        if (!animator || !machines || !driver || typeof driver.advanceAndApply !== 'function' || typeof rive?.drawFrame !== 'function') {
            throw new Error('Rive 2.44.0: driver de State Machine no disponible');
        }
        return driver;
    }

    function resize() {
        if (!rive || destroyed || typeof rive.resizeDrawingSurfaceToCanvas !== 'function') return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        rive.resizeDrawingSurfaceToCanvas(dpr);
    }

    function scheduleResize() {
        if (resizeFrame !== null || destroyed) return;
        resizeFrame = raf(() => {
            resizeFrame = null;
            resize();
        });
    }

    function stopSlowLoop() {
        if (slowFrame !== null) {
            caf(slowFrame);
            slowFrame = null;
        }
    }

    function slowTick(timestamp) {
        if (destroyed || !visible || state !== 'claimed' || !rive || !slowDriver) {
            slowFrame = null;
            return;
        }
        const previous = slowTick.previousTimestamp;
        slowTick.previousTimestamp = timestamp;
        const dt = previous == null ? 0 : Math.min((timestamp - previous) / 1000, 0.1);
        slowDriver.advanceAndApply(dt * SLOW_RATE);
        rive.drawFrame();
        slowFrame = raf(slowTick);
    }

    function startSlowLoop() {
        stopSlowLoop();
        slowTick.previousTimestamp = null;
        if (visible && state === 'claimed' && slowDriver) slowFrame = raf(slowTick);
    }

    function pauseRive() {
        stopSlowLoop();
        if (rive?.pause) rive.pause(STATE_MACHINE);
    }

    function resumeRive() {
        if (!rive || !visible || destroyed) return;
        if (state === 'available') {
            if (rive.play) rive.play(STATE_MACHINE);
            return;
        }
        if (rive.pause) rive.pause(STATE_MACHINE);
        startSlowLoop();
    }

    function syncViewModel() {
        if (!rive) return;
        if (!viewModelStreak) {
            viewModelStreak = rive.viewModelInstance?.number?.('streak') || null;
        }
        if (viewModelStreak) viewModelStreak.value = getGameStreak();
    }

    function onRiveLoad() {
        if (destroyed || !rive) return;
        viewModelStreak = rive.viewModelInstance?.number?.('streak') || null;
        if (!viewModelStreak) throw new Error('Rive UserStreakVM.streak no disponible');
        viewModelStreak.value = getGameStreak();
        resize();
        slowDriver = getSlowDriver();
        resumeRive();
    }

    function onRiveLoadError(error) {
        runtimeFailed = true;
        stopSlowLoop();
        if (shell) shell.dataset.riveError = 'true';
        console.error('StreakHub: error cargando Rive', error);
    }

    function loadRuntime() {
        if (runtimePromise) return runtimePromise;
        if (window.rive?.Rive && window.rive?.RuntimeLoader) {
            runtimePromise = Promise.resolve(window.rive);
            return runtimePromise;
        }
        runtimePromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = RIVE_RUNTIME_SRC;
            script.async = true;
            script.onload = () => {
                if (!window.rive?.Rive || !window.rive?.RuntimeLoader) {
                    reject(new Error('Rive 2.44.0: runtime incompleto'));
                    return;
                }
                resolve(window.rive);
            };
            script.onerror = () => reject(new Error('No se pudo cargar Rive 2.44.0'));
            document.head.appendChild(script);
        }).catch((error) => {
            runtimeFailed = true;
            if (shell) shell.dataset.riveError = 'true';
            console.error('StreakHub: error cargando runtime', error);
            throw error;
        });
        return runtimePromise;
    }

    async function createRive() {
        if (destroyed || rive || runtimeFailed || !visible || !canvas) return;
        try {
            const runtime = await loadRuntime();
            if (destroyed || !visible || rive) return;
            runtime.RuntimeLoader.setWasmUrl(RIVE_WASM_SRC);
            rive = new runtime.Rive({
                src: RIVE_SRC,
                canvas,
                autoplay: true,
                artboard: 'streak',
                stateMachine: STATE_MACHINE,
                autoBind: true,
                enableRiveAssetCDN: false,
                onLoad: onRiveLoad,
                onLoadError: onRiveLoadError
            });
        } catch (error) {
            onRiveLoadError(error);
        }
    }

    function setVisible(nextVisible) {
        inViewport = Boolean(nextVisible);
        visible = inViewport && !document.hidden && !destroyed;
        if (!visible) {
            pauseRive();
            return;
        }
        if (!rive) {
            createRive();
            return;
        }
        resumeRive();
    }

    function onIntersection(entries) {
        const entry = entries[0];
        setVisible(Boolean(entry?.isIntersecting) && entry.intersectionRatio >= 0.25);
    }

    function onVisibilityChange() {
        visible = inViewport && !document.hidden && !destroyed;
        if (!visible) {
            pauseRive();
            return;
        }
        if (!rive) {
            createRive();
            return;
        }
        resumeRive();
    }

    function init() {
        if (destroyed) destroyed = false;
        shell = document.getElementById('streak-rive-shell');
        canvas = shell?.querySelector?.('canvas') || document.getElementById('streak-rive-canvas');
        if (!shell || !canvas) return false;

        setShellState('claimed');
        intersectionObserver?.disconnect?.();
        resizeObserver?.disconnect?.();
        intersectionObserver = new IntersectionObserver(onIntersection, IO_OPTIONS);
        intersectionObserver.observe(shell);
        resizeObserver = new ResizeObserver(scheduleResize);
        resizeObserver.observe(shell);
        document.addEventListener('visibilitychange', onVisibilityChange);
        setVisible(false);
        return true;
    }

    function refresh() {
        if (destroyed) return;
        const info = window.GameCenter?.getStreakInfo?.();
        const available = Boolean(info?.canClaim || (info?.repairAvailable && info?.canAffordRepair));
        setShellState(available ? 'available' : 'claimed');
        syncViewModel();
        resumeRive();
    }

    function setState(nextState) {
        if (destroyed) return;
        setShellState(nextState);
        resumeRive();
    }

    function claim() {
        return window.GameCenter?.claimDaily?.();
    }

    function playClaimSequence(result) {
        if (!result?.success || !rive || destroyed) return;
        rive.play?.('Pop');
    }

    function destroy() {
        destroyed = true;
        visible = false;
        inViewport = false;
        stopSlowLoop();
        if (resizeFrame !== null) {
            caf(resizeFrame);
            resizeFrame = null;
        }
        intersectionObserver?.disconnect?.();
        resizeObserver?.disconnect?.();
        intersectionObserver = null;
        resizeObserver = null;
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (rive?.cleanup) rive.cleanup();
        rive = null;
        viewModelStreak = null;
        slowDriver = null;
        canvas = null;
        shell = null;
        slowTick.previousTimestamp = null;
    }

    window.StreakHub = { init, refresh, setState, claim, playClaimSequence, destroy };
})();
