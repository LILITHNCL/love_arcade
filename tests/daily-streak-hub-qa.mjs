import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const hubSource = readFileSync(new URL('../js/streak-hub.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

class FakeElement {
  constructor() {
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.children = [];
    this.style = { setProperty: () => {} };
    this.classList = {
      add: () => {},
      remove: () => {}
    };
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  closest() {
    return this.numberWrap;
  }

  appendChild(child) {
    this.children.push(child);
  }

  addEventListener(type, callback) {
    if (type === 'animationend') this.onAnimationEnd = callback;
  }

  remove() {
    this.removed = true;
  }

  get offsetWidth() {
    return 1;
  }
}

function createHarness({ info, canClaim, withAudioContext = false }) {
  const flame = new FakeElement();
  const bigNumber = new FakeElement();
  const numberWrap = new FakeElement();
  const burst = new FakeElement();
  bigNumber.numberWrap = numberWrap;

  const elements = new Map([
    ['streak-flame', flame],
    ['streak-count-big', bigNumber],
    ['streak-coin-burst', burst]
  ]);
  const scheduled = [];
  const audioEvents = {
    frequencies: [],
    gains: [],
    resumeCalls: 0,
    starts: [],
    stops: []
  };
  class FakeAudioContext {
    constructor() {
      this.currentTime = 10;
      this.destination = { type: 'destination' };
      this.state = 'suspended';
    }

    resume() {
      audioEvents.resumeCalls += 1;
      return Promise.resolve();
    }

    createOscillator() {
      const oscillator = {
        connect: (target) => target,
        frequency: { value: 0 },
        start: (time) => audioEvents.starts.push(time),
        stop: (time) => audioEvents.stops.push(time),
        type: ''
      };
      audioEvents.frequencies.push(oscillator.frequency);
      return oscillator;
    }

    createGain() {
      const gain = {
        connect: (target) => target,
        gain: {
          exponentialRampToValueAtTime: (value, time) => audioEvents.gains.push(['ramp', value, time]),
          setValueAtTime: (value, time) => audioEvents.gains.push(['set', value, time])
        }
      };
      return gain;
    }
  }
  const context = {
    document: {
      addEventListener: () => {},
      createElement: () => new FakeElement(),
      getElementById: (id) => elements.get(id) || null
    },
    window: {
      GameCenter: {
        getStreakInfo: () => info,
        canClaimDaily: () => canClaim
      },
      setTimeout: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      ...(withAudioContext ? { AudioContext: FakeAudioContext } : {}),
      StreakHub: {}
    },
    navigator: {
      vibrate: () => { context.vibrated = true; },
      userActivation: { isActive: true, hasBeenActive: true }
    },
    Math,
    console
  };
  context.window.window = context.window;
  vm.runInNewContext(hubSource, context, { filename: 'js/streak-hub.js' });

  return { audioEvents, bigNumber, burst, context, flame, numberWrap, scheduled };
}

const stateCases = [
  [{ streak: 0, repairAvailable: false }, true, 'locked'],
  [{ streak: 4, repairAvailable: false }, true, 'available'],
  [{ streak: 4, repairAvailable: true }, true, 'repair'],
  [{ streak: 4, repairAvailable: false }, false, 'claimed']
];

for (const [info, canClaim, expectedState] of stateCases) {
  const harness = createHarness({ info, canClaim });
  harness.context.window.StreakHub.refresh();
  assert.equal(harness.flame.dataset.state, expectedState);
  assert.equal(harness.bigNumber.textContent, String(info.streak));
  assert.equal(
    harness.numberWrap.getAttribute('aria-label'),
    `Racha actual: ${info.streak} día${info.streak !== 1 ? 's' : ''}`
  );
}

const claimHarness = createHarness({
  info: { streak: 1, repairAvailable: false },
  canClaim: false
});
assert.equal(
  typeof claimHarness.context.window.StreakHub.playClaimAudio,
  'function',
  'The claim sequence must expose the synthesized-audio playback hook.'
);
claimHarness.context.window.StreakHub.playClaimSequence({ success: true });
assert.equal(claimHarness.flame.dataset.state, 'claiming');
assert.equal(claimHarness.scheduled.length, 1);
claimHarness.scheduled[0]();
assert.equal(claimHarness.flame.dataset.state, 'claimed');
assert.equal(claimHarness.burst.children.length, 8);
assert.equal(claimHarness.context.vibrated, true);
for (const coin of claimHarness.burst.children) coin.onAnimationEnd();
assert.ok(claimHarness.burst.children.every((coin) => coin.removed));

const audioHarness = createHarness({
  info: { streak: 1, repairAvailable: false },
  canClaim: false,
  withAudioContext: true
});
audioHarness.context.window.StreakHub.playClaimAudio();
assert.equal(audioHarness.audioEvents.resumeCalls, 1);
assert.deepEqual(audioHarness.audioEvents.frequencies.map(({ value }) => value), [660, 880, 1320]);
assert.deepEqual(audioHarness.audioEvents.starts.map((time) => Number(time.toFixed(2))), [10, 10.07, 10.14]);
assert.deepEqual(audioHarness.audioEvents.stops.map((time) => Number(time.toFixed(2))), [10.4, 10.47, 10.54]);
assert.equal(audioHarness.audioEvents.gains.length, 9);

assert.match(html, /<button type="button"\s+id="btn-daily"/);
assert.match(html, /aria-describedby="daily-msg daily-countdown streak-hub-copy"/);
assert.match(html, /id="daily-msg" class="daily-msg" role="status" aria-live="polite"/);
assert.match(html, /window\.StreakHub\?\.refresh\?\.\(\);/);
assert.match(appSource, /window\.StreakHub\?\.playClaimSequence\?\.\(result\);/);
assert.match(appSource, /setTimeout\(\(\) => \{ showStreakMilestoneModal\(\); \}, 600\);/);
assert.match(
  css,
  /\.player-hud::before\s*\{[\s\S]*?filter:\s*blur\(26px\);/,
  'The Player HUD gradient must use the desktop anti-banding blur.'
);
assert.match(
  css,
  /@media \(pointer: coarse\)[\s\S]*?\.player-hud::before\s*\{[\s\S]*?filter:\s*blur\(8px\);/,
  'Touch hardware must use the lower-cost Player HUD blur.'
);
assert.match(css, /\.player-hud\.motion-paused \.flame-layer/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.streak-flame \.flame-layer/);
assert.match(css, /\.streak-flame__svg\s*\{[\s\S]*?filter:\s*[\s\S]*?drop-shadow\(0 0 4px[\s\S]*?drop-shadow\(0 0 10px[\s\S]*?drop-shadow\(0 0 20px/);
assert.match(css, /\.streak-flame\s*\{[\s\S]*?contain:\s*layout;[\s\S]*?overflow:\s*visible;/);
assert.doesNotMatch(css, /\.streak-flame__glow\s*\{/);

console.log('Daily Streak Hub QA checks passed.');
