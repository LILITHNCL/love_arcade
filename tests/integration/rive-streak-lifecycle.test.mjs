import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../js/ui/streak-hub.js', import.meta.url), 'utf8');
// Eliminado: exigía una forma concreta del código fuente
assert.doesNotMatch(source, /stateMachines:/);
assert.doesNotMatch(source, /\.(?:play|pause)\(\[[^\]]+\]\)/);
assert.match(source, /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
assert.match(source, /advanceAndApply\(dt \* SLOW_RATE\)/);
assert.match(source, /rive\.cleanup\(\)/);

let lastIO = null;
let lastRO = null;
const scripts = [];
const listeners = new Map();
const rafs = new Map();
let nextRaf = 1;

const canvas = {};
const shell = {
    dataset: {},
    querySelector: () => canvas,
};

const document = {
    hidden: false,
    head: { appendChild: (script) => scripts.push(script) },
    createElement: () => ({ async: false, src: '', onload: null, onerror: null }),
    getElementById: (id) => id === 'streak-rive-shell' ? shell : null,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
};

class IntersectionObserverMock {
    constructor(cb, options) {
        this.cb = cb;
        this.options = options;
        this.observed = null;
        lastIO = this;
    }
    observe(el) { this.observed = el; }
    disconnect() { this.observed = null; }
}

class ResizeObserverMock {
    constructor(cb) { this.cb = cb; lastRO = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
}

const window = {
    devicePixelRatio: 3,
    requestAnimationFrame: (fn) => {
        const id = nextRaf++; 
        rafs.set(id, fn);
        return id;
    },
    cancelAnimationFrame: (id) => { rafs.delete(id); },
    GameCenter: {
        getStreakInfo: () => ({ streak: 7, canClaim: false }),
    },
};

const context = {
    window,
    document,
    IntersectionObserver: IntersectionObserverMock,
    ResizeObserver: ResizeObserverMock,
    console,
    Promise,
    Error,
    Math,
};

vm.runInNewContext(source, context, { filename: 'streak-hub.js' });
assert.ok(window.StreakHub);
assert.equal(window.StreakHub.init(), true);
assert.equal(lastIO.options.threshold[0], 0); assert.equal(lastIO.options.threshold[1], 0.25);
assert.equal(scripts.length, 0, 'runtime must stay unloaded outside viewport');

let cleanupCalls = 0;
let resizeDpr = null;
let advanceSeconds = null;
let drawCalls = 0;
let pauseCalls = 0;
let pauseArg = null;
let playCalls = 0;
let playArg = null;

const driver = {
    name: 'State Machine 1',
    advanceAndApply: (dt) => { advanceSeconds = dt; },
};

const mockRive = {
    RuntimeLoader: {
        setWasmUrl: (url) => assert.equal(url, '/assets/rive/runtime/2.44.0/rive.wasm'),
    },
    Rive: class {
        constructor(options) {
            assert.equal(options.stateMachine, 'State Machine 1');
            assert.equal(options.enableRiveAssetCDN, false);
            this.viewModelInstance = {
                number: (name) => name === 'streak' ? { value: 0 } : null,
            };
            this.animator = { stateMachines: [driver] };
            this.resizeDrawingSurfaceToCanvas = (dpr) => { resizeDpr = dpr; };
            this.pause = (names) => { pauseCalls += 1; pauseArg = names; };
            this.play = (names) => { playCalls += 1; playArg = names; };
            this.drawFrame = () => { drawCalls += 1; };
            this.cleanup = () => { cleanupCalls += 1; }; 
            Promise.resolve().then(() => { options.onLoad(); });
        }
    },
};

lastIO.cb([{ isIntersecting: true, intersectionRatio: 0.24 }]);
assert.equal(scripts.length, 0, '0.24 intersection must remain lazy');

lastIO.cb([{ isIntersecting: true, intersectionRatio: 0.25 }]);
assert.equal(scripts.length, 1, '0.25 intersection must load Rive exactly once');
window.rive = mockRive; scripts[0].onload();
await new Promise(r => setTimeout(r, 10));
await new Promise(r => setTimeout(r, 10));

await new Promise(r => setTimeout(r, 10));
assert.equal(resizeDpr, 2, 'DPR must be capped at 2');
assert.equal(playCalls, 0, 'claimed state must not resume the State Machine');
assert.equal(pauseCalls > 0, true);
assert.equal(pauseArg, 'State Machine 1');
assert.equal(playArg, null);
assert.equal(lastRO != null, true);

const firstId = [...rafs.keys()][0]; const firstFrame = rafs.get(firstId); rafs.delete(firstId);
firstFrame?.(1000);
const secondId = [...rafs.keys()][0]; const secondFrame = rafs.get(secondId); rafs.delete(secondId);
secondFrame?.(1016);
assert.equal(advanceSeconds, 0.012, 'claimed state must advance at 0.75x');
assert.equal(drawCalls > 0, true);

document.hidden = true;
listeners.get('visibilitychange')();
assert.equal(rafs.size, 0, 'hidden tab must stop the custom loop');

document.hidden = false;
listeners.get('visibilitychange')();
assert.equal(rafs.size > 0, true, 'visible tab must resume the claimed loop');

lastIO.cb([{ isIntersecting: false, intersectionRatio: 0 }]);
assert.equal(rafs.size, 0, 'leaving viewport must stop the custom loop');

window.StreakHub.destroy();
assert.equal(cleanupCalls, 1, 'destroy() must call r.cleanup()');
assert.equal(lastIO.observed, null);
assert.equal(lastRO.disconnected, true);
console.log('rive-streak-lifecycle: PASS');
