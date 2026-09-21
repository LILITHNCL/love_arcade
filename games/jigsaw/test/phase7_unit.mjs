import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');

function loadSandbox(files, extra = {}) {
  const store = new Map();
  const sandbox = {
    console,
    Date,
    Math,
    Set,
    Map,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Promise,
    URL,
    window: null,
    navigator: { connection: { effectiveType: '4g', saveData: false } },
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); },
      _store: store
    },
    ...extra
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(jsDir, file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox;
}

function createFixtureLevel(index) {
  const packs = ['Océano', 'Bosque', 'Ciudad', 'Fantasía', 'Espacio', 'Postres', 'Mascotas', 'Arte'];
  const difficulties = ['easy', 'standard', 'hard'];
  const plans = { easy: [6, 6, 6, 6], standard: [8, 8, 8, 8], hard: [8, 8, 8, 8, 8, 10, 10] };
  const rewards = { easy: 75, standard: 125, hard: 200 };
  const targetCounts = { easy: 24, standard: 32, hard: 60 };
  const difficulty = difficulties[index % difficulties.length];
  const id = `fixture_${String(index + 1).padStart(3, '0')}`;
  return Object.freeze({
    id,
    order: index + 1,
    title: `Fixture ${index + 1}`,
    pack: packs[index % packs.length],
    difficulty,
    cloudinaryPublicId: `marejig/fixtures/${id}`,
    sourceFormat: 'avif',
    aspectRatio: '4:3',
    master: Object.freeze({ width: 2400, height: 1800 }),
    board: Object.freeze(difficulty === 'hard' ? { cols: 16, rows: 12 } : { cols: 12, rows: 9 }),
    targetPieceCount: targetCounts[difficulty],
    segmentPlan: plans[difficulty].slice(),
    rewardCoins: rewards[difficulty]
  });
}

function validatePuzzle(level, puzzle) {
  assert.equal(puzzle.board.cols, level.board.cols, `${level.id} cols`);
  assert.equal(puzzle.board.rows, level.board.rows, `${level.id} rows`);
  assert.equal(puzzle.board.cellCount, level.board.cols * level.board.rows, `${level.id} cell count`);
  assert.equal(puzzle.board.cols / puzzle.board.rows, 4 / 3, `${level.id} board ratio`);
  assert.ok(puzzle.validation.ok, `${level.id} puzzle validation: ${puzzle.validation.errors.join('; ')}`);
  assert.ok(puzzle.validation.cellCoverageOk, `${level.id} coverage`);
  assert.ok(puzzle.validation.adjacencyOk, `${level.id} adjacency`);
  assert.ok(puzzle.validation.segmentsOk, `${level.id} segments`);
  const ranges = { easy: [22, 28], standard: [28, 34], hard: [56, 64] };
  const [minPieces, maxPieces] = ranges[level.difficulty] || ranges.standard;
  assert.ok(puzzle.validation.pieceCount >= minPieces && puzzle.validation.pieceCount <= maxPieces, `${level.id} piece count`);
  assert.equal(puzzle.segments.items.s_0.revealed, true, `${level.id} s_0 revealed`);
  if (level.difficulty === 'standard') {
    assert.ok(puzzle.validation.variety.nonRectangularPieceRatio >= 0.55, `${level.id} non-rectangular variety`);
    assert.ok(puzzle.validation.variety.rectangularPieceRatio <= 0.40, `${level.id} rectangular cap`);
  }
  assert.ok(puzzle.validation.variety.monominoCount <= 2, `${level.id} monomino cap`);
  for (const segmentId of puzzle.segments.order) {
    assert.ok(puzzle.segments.items[segmentId].pieceIds.length > 0, `${level.id} ${segmentId} non-empty`);
    if (level.difficulty === 'hard') assert.ok(puzzle.segments.items[segmentId].pieceIds.length <= 10, `${level.id} ${segmentId} hard segment max 10`);
  }
}

{
  const sandbox = loadSandbox([
    'MAREJIG_config.js',
    'MAREJIG_levels.js',
    'MAREJIG_shapes.js',
    'MAREJIG_groups.js',
    'MAREJIG_segments.js',
    'MAREJIG_generator.js'
  ]);
  const levels = sandbox.MAREJIG_LevelCatalog.levels;
  assert.ok(levels.length >= 1, 'catalog has at least one level');
  const fixture = Array.from({ length: 200 }, (_, index) => createFixtureLevel(index));
  const startedAt = performance.now();
  for (const level of [...levels, ...fixture]) {
    const first = sandbox.MAREJIG_Generator.generate(level);
    const second = sandbox.MAREJIG_Generator.generate(level);
    validatePuzzle(level, first);
    assert.equal(first.seed, second.seed, `${level.id} deterministic seed`);
    assert.deepEqual(first.debug.targetSizes, second.debug.targetSizes, `${level.id} deterministic target sizes`);
  }
  const elapsedMs = performance.now() - startedAt;
  assert.ok(elapsedMs < 20000, `stress generation should be reasonable (${elapsedMs.toFixed(1)}ms)`);
}

{
  const sandbox = loadSandbox(['MAREJIG_config.js', 'MAREJIG_cloudinary.js']);
  const level = createFixtureLevel(0);
  const urls = sandbox.MAREJIG_Cloudinary.buildAllUrls(level, { cloudName: 'marejig-prod' });
  assert.deepEqual(Object.keys(urls).sort(), ['fullMobile', 'fullPremium', 'thumbnail', 'thumbnailLarge', 'tiny'].sort());
  assert.match(urls.tiny, /\/marejig-prod\/image\/upload\/f_auto,q_auto:eco,w_32,h_24,c_fill,g_auto,ar_4:3\/marejig\/fixtures\/fixture_001$/);
  assert.match(urls.thumbnail, /f_auto,q_auto,w_480,h_360,c_fill,g_auto,ar_4:3/);
  assert.match(urls.thumbnailLarge, /f_auto,q_auto,w_640,h_480,c_fill,g_auto,ar_4:3/);
  assert.match(urls.fullMobile, /f_auto,q_auto:good,w_1600,h_1200,c_fit/);
  assert.match(urls.fullPremium, /f_auto,q_auto:best,w_2048,h_1536,c_fit/);
  const forced = sandbox.MAREJIG_Cloudinary.buildUrl(level, 'thumbnail', { cloudName: 'marejig-prod', forceAvifForTesting: true });
  assert.match(forced, /f_avif,q_auto/);
  const offline = await sandbox.MAREJIG_Cloudinary.validateUrl(urls.thumbnail, { offline: true });
  assert.equal(offline.skipped, true);
}

function makeElement(id = '') {
  return {
    id,
    type: '',
    className: '',
    hidden: false,
    value: '',
    attributes: {},
    children: [],
    eventHandlers: {},
    _textContent: '',
    _innerHTML: '',
    set textContent(value) { this._textContent = String(value); this.children = []; },
    get textContent() { return this._textContent; },
    set innerHTML(value) { this._innerHTML = String(value); },
    get innerHTML() { return this._innerHTML; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) {
      if (child && child.isFragment) {
        this.children.push(...child.children);
        child.children = [];
      } else {
        this.children.push(child);
      }
      return child;
    },
    addEventListener(type, handler) { this.eventHandlers[type] = handler; },
    querySelectorAll() { return []; },
    focus() {}
  };
}

function makeDocument() {
  const elements = new Map();
  for (const id of ['marejig-level-grid', 'marejig-empty-state', 'marejig-menu-sentinel']) {
    elements.set(id, makeElement(id));
  }
  return {
    elements,
    getElementById(id) { return elements.get(id) || null; },
    createElement(tag) { const el = makeElement(); el.tagName = tag.toUpperCase(); return el; },
    createDocumentFragment() { return { isFragment: true, children: [], appendChild(child) { this.children.push(child); return child; } }; },
    addEventListener() {}
  };
}

{
  const document = makeDocument();
  const calls = { tiny: 0, thumbnail: 0, full: 0, starts: [] };
  const observers = [];
  const fixture = Array.from({ length: 200 }, (_, index) => createFixtureLevel(index));
  const completed = new Set(['fixture_001', 'fixture_002', 'fixture_050']);
  const sandbox = loadSandbox(['MAREJIG_config.js', 'MAREJIG_menu.js'], {
    document,
    IntersectionObserver: function IntersectionObserver(callback) { this._observed = []; this.observe = (target) => { this._observed.push(target); }; this.unobserve = function unobserve() {}; this.disconnect = function disconnect() {}; this._callback = callback; observers.push(this); },
    MAREJIG_LevelCatalog: {
      getOrdered: () => fixture.slice()
    },
    MAREJIG_Storage: {
      getActiveSave: () => null,
      isLevelCompleted: (id) => completed.has(id),
      clearActiveSave() {},
      clearLevelProgress() {},
      getLevelProgress: () => null
    },
    MAREJIG_Cloudinary: {
      buildTinyPlaceholderUrl(level) { calls.tiny += 1; return `tiny:${level.id}`; },
      buildThumbnailUrl(level) { calls.thumbnail += 1; return `thumb:${level.id}`; },
      buildFullUrl(level) { calls.full += 1; return `full:${level.id}`; }
    },
    MAREJIG_Main: { startLevel(id) { calls.starts.push(id); } }
  });
  sandbox.MAREJIG_Menu.mountPendingLevels();
  const grid = document.getElementById('marejig-level-grid');
  assert.equal(sandbox.MAREJIG_Menu.getVisibleLevelCount(), 197, 'completed levels filtered before render');
  assert.equal(sandbox.MAREJIG_Menu.getRenderedCount(), 12, 'only initial batch rendered');
  assert.equal(grid.children.length, 12, 'only initial cards are nodes');
  assert.equal(calls.full, 0, 'no full images requested from menu');
  assert.match(grid.children[0].innerHTML, /class="marejig-action-arrow" aria-hidden="true"><svg[^>]*focusable="false"/, 'menu action uses a hidden inline SVG arrow');
  assert.equal(document.getElementById('marejig-empty-state').hidden, true, 'completed catalog stays hidden while pending levels remain');
  assert.equal(document.getElementById('marejig-load-more'), null, 'menu does not require a visible load-more button');
  const sentinel = document.getElementById('marejig-menu-sentinel');
  const paginationObserver = observers.find((observer) => observer._observed.includes(sentinel));
  assert.ok(paginationObserver, 'internal invisible sentinel is observed for incremental rendering');
  assert.doesNotThrow(() => paginationObserver._callback([{ target: sentinel, isIntersecting: true }]), 'sentinel pagination works without a load-more button');
  assert.equal(grid.children.length, 24, 'sentinel appends one batch, not all 200');
  completed.add(grid.children[0].attributes['data-marejig-level-id']);
  sandbox.MAREJIG_Menu.refreshAfterCompletion();
  assert.equal(sandbox.MAREJIG_Menu.getVisibleLevelCount(), 196, 'completed card disappears after refresh');
  assert.equal(calls.full, 0, 'still no full images after refresh');
  fixture.forEach((level) => completed.add(level.id));
  sandbox.MAREJIG_Menu.refreshAfterCompletion();
  assert.equal(sandbox.MAREJIG_Menu.getVisibleLevelCount(), 0, 'no pending cards remain after completing the full catalog');
  assert.equal(document.getElementById('marejig-empty-state').hidden, false, 'completed catalog renders only after every available level is complete');
}

{
  const sandbox = loadSandbox(['MAREJIG_economy.js']);
  const calls = [];
  sandbox.GameCenter = { completeLevel(gameId, rewardLevelId, coins) { calls.push({ gameId, rewardLevelId, coins }); } };
  const levels = [createFixtureLevel(0), createFixtureLevel(1), createFixtureLevel(2)];
  for (const level of levels) {
    const result = sandbox.MAREJIG_Economy.reportLevelCompleted(level, {});
    assert.equal(result.mode, 'gamecenter');
    assert.ok(Number.isInteger(result.coins) && result.coins > 0);
  }
  const duplicate = sandbox.MAREJIG_Economy.reportLevelCompleted(levels[0], { rewardReported: true });
  assert.equal(duplicate.mode, 'already-reported');
  assert.equal(calls.length, 3, 'repeat completion does not pay again');
}

{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scriptSources = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map((match) => match[1]);
  const bridgeIndex = scriptSources.indexOf('../../js/game-bridge.js');
  assert.ok(bridgeIndex !== -1, 'Love Arcade game bridge is loaded');
  assert.ok(bridgeIndex < scriptSources.indexOf('./js/MAREJIG_economy.js'), 'bridge loads before the economy');
  assert.ok(bridgeIndex < scriptSources.indexOf('./js/MAREJIG_main.js'), 'bridge loads before game startup');
  assert.equal(scriptSources.includes('../../js/app.js'), false, 'hub UI bootstrap is not loaded by Marejig');
  const css = fs.readFileSync(path.join(root, 'css', 'marejig.css'), 'utf8');
  const selectors = [...css.matchAll(/(^|})\s*([^@{}][^{]+)\s*\{/g)].map((match) => match[2].trim()).filter((selector) => { const cleaned = selector.replace(/^}+/, '').trim(); return !cleaned.startsWith('from') && !cleaned.startsWith('to') && !cleaned.startsWith('@'); }).map((selector) => selector.replace(/^}+/, '').trim());
  for (const selector of selectors) {
    assert.ok(selector.split(',').every((part) => part.trim().startsWith('.marejig-') || part.trim().startsWith('html .marejig-')), `CSS selector must stay namespaced: ${selector}`);
  }
}

console.log('phase7 unit tests ok');
