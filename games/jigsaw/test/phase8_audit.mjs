import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

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
    window: null,
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

function loadGameplaySandbox(extra = {}) {
  return loadSandbox([
    'MAREJIG_config.js',
    'MAREJIG_levels.js',
    'MAREJIG_shapes.js',
    'MAREJIG_groups.js',
    'MAREJIG_segments.js',
    'MAREJIG_generator.js',
    'MAREJIG_scene.js'
  ], extra);
}

function forceSegmentComplete(scene, segmentId) {
  const segment = scene.puzzle.segments.items[segmentId];
  const mainGroupId = scene.pieces[segment.pieceIds[0]].groupId;
  scene.groups[mainGroupId].pieceIds = segment.pieceIds.slice();
  scene.groups[mainGroupId].visible = true;
  scene.progress.mainGroupId = mainGroupId;
  segment.pieceIds.forEach((pieceId) => {
    scene.pieces[pieceId].groupId = mainGroupId;
    scene.pieces[pieceId].visible = true;
  });
}

{
  const html = read('index.html');
  assert.match(html, /<a class="marejig-exit-link" href="\.\.\/\.\.\/"/, 'exit button points to the same Love Arcade root URL used by other games');
  const scriptSources = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map((match) => match[1]);
  const bridgeIndex = scriptSources.indexOf('../../js/game-bridge.js');
  assert.ok(bridgeIndex !== -1, 'Love Arcade game bridge is loaded');
  assert.ok(bridgeIndex < scriptSources.indexOf('./js/MAREJIG_economy.js'), 'bridge loads before the economy');
  assert.ok(bridgeIndex < scriptSources.indexOf('./js/MAREJIG_main.js'), 'bridge loads before game startup');
  assert.equal(scriptSources.includes('../../js/app.js'), false, 'hub UI bootstrap is not loaded by Marejig');
  assert.equal([...html.matchAll(/role="dialog"/g)].length, [...html.matchAll(/aria-modal="true"/g)].length, 'dialogs are modal and labelled');
  assert.match(html, /id="marejig-confirm-reset-modal"[\s\S]*aria-describedby="marejig-confirm-reset-copy"/, 'destructive reset has explicit confirmation copy');
  assert.match(html, /id="marejig-level-grid"[\s\S]*aria-label="Lista de niveles pendientes"/, 'pending level grid is labelled for keyboard/screen reader navigation');
}

{
  const jsFiles = fs.readdirSync(jsDir).filter((file) => file.endsWith('.js'));
  const forbiddenGlobals = /\b(?:var|let|const)\s+(?:CONFIG|ECONOMY|THEMES)\b|window\.(?:GameCenter|ECONOMY|THEMES)\s*=/;
  const forbiddenEconomyCalls = /addCoins|spendCoins|getBalance/;
  for (const file of jsFiles) {
    const source = fs.readFileSync(path.join(jsDir, file), 'utf8');
    assert.equal(forbiddenGlobals.test(source), false, `${file} must not declare/assign forbidden globals`);
    assert.equal(forbiddenEconomyCalls.test(source), false, `${file} must not use forbidden economy APIs`);
    if (source.includes('completeLevel')) assert.equal(file, 'MAREJIG_economy.js', 'completeLevel only appears in economy adapter');
  }
}

{
  const sandbox = loadSandbox(['MAREJIG_storage.js']);
  const allowed = new Set([
    'MAREJIG_completedLevels_v1',
    'MAREJIG_levelProgress_v1',
    'MAREJIG_activeSave_v1',
    'MAREJIG_settings_v1'
  ]);
  assert.deepEqual(new Set(Object.values(sandbox.MAREJIG_Storage.keys)), allowed, 'storage exposes only allowed MAREJIG keys');
  sandbox.localStorage.setItem('MAREJIG_activeSave_v1', '{bad json');
  assert.equal(sandbox.MAREJIG_Storage.getActiveSave(), null, 'corrupt active save is ignored safely');
  sandbox.MAREJIG_Storage.saveSettings({ haptics: false });
  sandbox.MAREJIG_Storage.saveLevelProgress('audit_level', { totalPieceCount: 40, placedPieceCount: 8 });
  sandbox.MAREJIG_Storage.markLevelCompleted({ id: 'audit_level', rewardCoins: 5 }, { rewardReported: false, rewardCoins: 5 });
  for (const key of sandbox.localStorage._store.keys()) {
    assert.ok(allowed.has(key), `unexpected storage key ${key}`);
    assert.ok(key.startsWith('MAREJIG_'), `storage key must be namespaced: ${key}`);
    assert.doesNotMatch(sandbox.localStorage._store.get(key), /data:image|base64|blob:|Blob\(|ImageBitmap|thumbnail|canvas/i, `visual payload must not be stored in ${key}`);
  }
  sandbox.MAREJIG_Storage.clearActiveSave();
  assert.equal(sandbox.MAREJIG_Storage.getActiveSave(), null, 'active save clears cleanly');
}

{
  const sandbox = loadSandbox(['MAREJIG_economy.js']);
  const calls = [];
  const level = { id: 'reward_audit', rewardCoins: 11.9 };
  assert.equal(sandbox.MAREJIG_Economy.reportLevelCompleted(level, {}).mode, 'standalone', 'standalone works without GameCenter');
  sandbox.GameCenter = { completeLevel(gameId, rewardLevelId, coins) { calls.push({ gameId, rewardLevelId, coins }); } };
  assert.equal(sandbox.MAREJIG_Economy.reportLevelCompleted(level, {}).mode, 'gamecenter', 'GameCenter mock receives reward');
  assert.deepEqual(calls, [{ gameId: 'jigsaw', rewardLevelId: 'level_reward_audit', coins: 11 }], 'GameCenter receives exactly one normalized call');
  assert.equal(sandbox.MAREJIG_Economy.reportLevelCompleted(level, { rewardReported: true }).mode, 'already-reported', 'repeat completion is idempotent');
  assert.equal(sandbox.MAREJIG_Economy.reportLevelCompleted(level, { rewardReported: true }).mode, 'already-reported', 'reload after victory does not duplicate reward');
  assert.equal(calls.length, 1, 'repeat/reload did not pay again');
}

{
  const menuSource = read('js/MAREJIG_menu.js');
  const loaderSource = read('js/MAREJIG_imageLoader.js');
  const rendererSource = read('js/MAREJIG_renderer.js');
  const mainSource = read('js/MAREJIG_main.js');
  assert.equal(menuSource.includes('buildFullUrl'), false, 'menu never requests full Cloudinary images');
  assert.match(menuSource, /data-marejig-src/, 'thumbnails remain lazy via data-marejig-src');
  assert.match(mainSource, /releaseFullImage\(releaseLevelId\)/, 'full image cache releases on return to menu');
  assert.equal((loaderSource.match(/new Image\b/g) || []).length, 1, 'image loader has a single image element path, not per-piece images');
  assert.match(rendererSource, /Math\.min\(windowObject\.devicePixelRatio \|\| 1, MAREJIG_Config\.canvas\.maxDpr\)/, 'canvas DPR is capped');
  assert.match(rendererSource, /if \(MAREJIG_rendererState\.rafId\) return;/, 'renderer coalesces dirty frames');
  assert.match(rendererSource, /if \(scene\.ui\.dirty === false\) return;/, 'renderer skips clean frames');
  assert.equal(/function\s+MAREJIG_drawGrid|drawGrid|boardOutline|piece\.outline\.segments\.forEach\(function MAREJIG_boardOutline/.test(rendererSource), false, 'renderer does not draw a visible board grid');
}

{
  const sandbox = loadGameplaySandbox({ Date });
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  assert.equal(sandbox.MAREJIG_Hints, undefined, 'hints are not exposed during gameplay');
  assert.equal(Object.prototype.hasOwnProperty.call(scene.progress, 'hintsUsed'), false, 'new scenes do not track hints');
}

{
  const sandbox = loadGameplaySandbox({ Date });
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  const lastIndex = scene.puzzle.segments.order.length - 1;
  const lastSegmentId = scene.puzzle.segments.order[lastIndex];
  scene.puzzle.segments.currentSegmentIndex = lastIndex;
  scene.puzzle.segments.items[lastSegmentId].revealed = true;
  forceSegmentComplete(scene, lastSegmentId);
  const victory = sandbox.MAREJIG_Segments.advanceIfSegmentComplete(scene);
  assert.equal(victory.puzzleComplete, true, 'last segment produces local victory once');
  const duplicateVictory = sandbox.MAREJIG_Segments.advanceIfSegmentComplete(scene);
  assert.equal(duplicateVictory.puzzleComplete, false, 'completed last segment does not fire victory twice');
}

{
  const inputSource = read('js/MAREJIG_input.js');
  const groupsSource = read('js/MAREJIG_groups.js');
  const segmentsSource = read('js/MAREJIG_segments.js');
  assert.match(inputSource, /pointercancel: MAREJIG_onPointerCancel/, 'pointercancel is wired');
  assert.match(inputSource, /MAREJIG_resetState\(true\)/, 'pointer cancel/up paths reset input state');
  assert.match(inputSource, /gamePhase !== 'playing'/, 'input blocks during victory/completion');
  assert.match(groupsSource, /MAREJIG_getAdjacencyEdges\(scene, pieceId\)/, 'snap is based on adjacency edges');
  assert.match(groupsSource, /!neighborSegment \|\| !neighborSegment\.revealed/, 'snap ignores unrevealed future pieces');
  assert.match(segmentsSource, /if \(activeSegment\.completed\) return/, 'completed segments cannot fire twice');
}

{
  const sandbox = loadGameplaySandbox({ Date });
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  assert.equal(level.difficulty, 'easy', 'Nivel 003 uses easy difficulty');
  assert.ok(puzzle.validation.pieceCount >= 22 && puzzle.validation.pieceCount <= 28, 'Nivel 003 easy puzzle uses 22–28 piece range');
  assert.equal(puzzle.validation.ok, true, `Nivel 003 puzzle validates: ${puzzle.validation.errors.join('; ')}`);
}

{
  const sandbox = loadGameplaySandbox({ Date });
  const easy = sandbox.MAREJIG_LevelCatalog.getDifficultyConfig('easy');
  const standard = sandbox.MAREJIG_LevelCatalog.getDifficultyConfig('standard');
  const hard = sandbox.MAREJIG_LevelCatalog.getDifficultyConfig('hard');
  assert.deepEqual([easy.board.cols, easy.board.rows, easy.targetPieceCount, ...easy.segmentPlan], [12, 9, 24, 6, 6, 6, 6], 'easy uses 12×9, 24 target pieces and four segments of six');
  assert.equal(easy.rewardCoins, 200, 'easy awards 200 coins');
  assert.deepEqual([standard.board.cols, standard.board.rows, standard.targetPieceCount, ...standard.segmentPlan], [12, 9, 32, 8, 8, 8, 8], 'standard uses 12×9, 32 target pieces and four segments of eight');
  assert.deepEqual([hard.board.cols, hard.board.rows, hard.targetPieceCount], [16, 12, 60], 'hard uses 16×12 and 60 target pieces');
  assert.equal(hard.board.cols / hard.board.rows, 4 / 3, 'hard board keeps 4:3');
  assert.equal(Math.max(...hard.segmentPlan) <= 10, true, 'hard segment plan reveals at most 10 pieces per segment');
  const hardLevel = {
    id: 'hard_fixture', order: 99, title: 'Hard Fixture', pack: 'Tests', difficulty: 'hard', cloudinaryPublicId: 'fixture/hard',
    sourceFormat: 'avif', aspectRatio: '4:3', master: { width: 2400, height: 1800 }, board: { cols: hard.board.cols, rows: hard.board.rows },
    targetPieceCount: hard.targetPieceCount, segmentPlan: hard.segmentPlan.slice(), rewardCoins: 200
  };
  assert.equal(sandbox.MAREJIG_LevelCatalog.validateLevel(hardLevel), true, 'future hard levels validate with 60 pieces');
  const hardPuzzle = sandbox.MAREJIG_Generator.generate(hardLevel);
  assert.equal(hardPuzzle.validation.ok, true, `hard puzzle validates: ${hardPuzzle.validation.errors.join('; ')}`);
  assert.ok(hardPuzzle.validation.pieceCount >= 56 && hardPuzzle.validation.pieceCount <= 64, 'hard puzzle uses 56–64 piece range');
  assert.equal(hardPuzzle.board.cols, 16, 'hard puzzle board has 16 columns');
  assert.equal(hardPuzzle.board.rows, 12, 'hard puzzle board has 12 rows');
  assert.equal(hardPuzzle.board.cols / hardPuzzle.board.rows, 4 / 3, 'hard generated board keeps 4:3');
  assert.equal(Math.max(...hardPuzzle.segments.order.map((segmentId) => hardPuzzle.segments.items[segmentId].pieceIds.length)) <= 10, true, 'hard generated segments reveal at most 10 pieces');
}

{
  const sandbox = loadGameplaySandbox({ Date });
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  sandbox.MAREJIG_Scene.layoutScene(scene, 390, 844);
  const groupId = sandbox.MAREJIG_Scene.getVisiblePieceIds(scene).map((pieceId) => scene.pieces[pieceId].groupId)[0];
  const group = scene.groups[groupId];
  group.x += 37;
  group.y += 29;
  const before = { id: group.id, x: group.x, y: group.y, segment: scene.ui.activeSegmentId, seed: scene.puzzle.seed };
  sandbox.MAREJIG_Scene.layoutScene(scene, 844, 390);
  const after = scene.groups[groupId];
  assert.equal(after.id, before.id, 'resize keeps groupId stable');
  assert.equal(scene.ui.activeSegmentId, before.segment, 'resize keeps active segment stable');
  assert.equal(scene.puzzle.seed, before.seed, 'resize does not regenerate puzzle');
  assert.equal(after.x, before.x, 'resize preserves absolute group world x');
  assert.equal(after.y, before.y, 'resize preserves absolute group world y');
  assert.ok(after.bounds.x + after.bounds.width >= scene.world.x && after.bounds.y + after.bounds.height >= scene.world.y, 'moved group remains recoverably inside the world after resize');
}

{
  const sandbox = loadGameplaySandbox({ Date });
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  sandbox.MAREJIG_Scene.layoutScene(scene, 390, 844);
  const groupId = sandbox.MAREJIG_Scene.getVisiblePieceIds(scene).map((pieceId) => scene.pieces[pieceId].groupId)[0];
  scene.groups[groupId].x = -5000;
  scene.groups[groupId].y = -5000;
  sandbox.MAREJIG_Scene.ensureVisibleGroups(scene);
  assert.ok(scene.groups[groupId].bounds.x + scene.groups[groupId].bounds.width >= scene.world.safePadding * 0.4, 'ensureVisibleGroups recovers a group outside the world');
  assert.ok(scene.world.width > scene.viewport.width && scene.world.height > scene.viewport.height, 'sandbox world is larger than viewport');
}

{
  const html = read('index.html');
  const gameMarkup = html.replace(/[\s\S]*<section class="marejig-screen" id="marejig-screen-game"/, '').replace(/<section class="marejig-screen" id="marejig-screen-error"[\s\S]*/, '');
  assert.doesNotMatch(gameMarkup, />[^<]*(Tiempo|Movs|conectadas|Board|Seed|Generador|Imagen runtime|RC Fase|Piezas)[^<]*</, 'normal gameplay markup avoids stats, technical labels and pieces panel copy');
  assert.match(gameMarkup, /marejig-game-overlay/, 'gameplay uses a floating controls overlay');
  assert.doesNotMatch(gameMarkup, /id="marejig-hint-button"/, 'hint control is absent');
  assert.match(html, /class="marejig-level-details marejig-debug-only"[^>]*hidden/, 'technical details are hidden debug-only markup');
  assert.match(html, /class="marejig-ready-overlay marejig-debug-only"[^>]*hidden/, 'debug overlay is hidden by default');
  const mainSource = read('js/MAREJIG_main.js');
  assert.match(mainSource, /searchParams\.get\('debug'\) === '1'/, 'debug panel can be enabled by ?debug=1');
  assert.match(mainSource, /MAREJIG_Config\.debug\.enabled/, 'debug panel can be enabled by config flag');
}

{
  const sandbox = loadSandbox(['MAREJIG_shapes.js']);
  const outline = sandbox.MAREJIG_Shapes.buildCellsOutline([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  const segments = outline.segments.map((segment) => `${segment.x1},${segment.y1}>${segment.x2},${segment.y2}`);
  assert.equal(outline.segments.length, 6, 'two merged adjacent cells have only external perimeter segments');
  assert.equal(segments.includes('1,0>1,1') || segments.includes('1,1>1,0'), false, 'shared internal edge is absent from group outline');
}

{
  const sandbox = loadSandbox(['MAREJIG_shapes.js', 'MAREJIG_groups.js']);
  const scene = {
    board: { cellSize: 40 },
    staging: { pieceScale: 40 },
    puzzle: { pieces: {
      p_001: { id: 'p_001', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], solution: { gridX: 0, gridY: 0 }, bounds: { w: 2, h: 2 }, segmentId: 's_0' },
      p_002: { id: 'p_002', cells: [{ x: 0, y: 0 }], solution: { gridX: 4, gridY: 0 }, bounds: { w: 1, h: 1 }, segmentId: 's_0' }
    } },
    pieces: {
      p_001: { id: 'p_001', visible: true, groupId: 'g_001' },
      p_002: { id: 'p_002', visible: false, groupId: 'g_002' }
    },
    groups: {
      g_001: { id: 'g_001', pieceIds: ['p_001'], anchorPieceId: 'p_001', x: 10, y: 10, zIndex: 2, visible: true, lockedToBoard: false },
      g_002: { id: 'g_002', pieceIds: ['p_002'], anchorPieceId: 'p_002', x: 10, y: 10, zIndex: 10, visible: true, lockedToBoard: false }
    }
  };
  assert.equal(sandbox.MAREJIG_Groups.hitTest(scene, { x: 20, y: 20 }).pieceId, 'p_001', 'point inside visible L piece selects it');
  assert.equal(sandbox.MAREJIG_Groups.hitTest(scene, { x: 62, y: 22 }), null, 'point in L-piece hole does not select by large bounds');
  assert.equal(sandbox.MAREJIG_Groups.hitTest(scene, { x: 172, y: 22 }), null, 'hidden piece is never selected');
  assert.equal(sandbox.MAREJIG_Groups.getTouchPadding(scene) <= Math.min(8, scene.board.cellSize * 0.18), true, 'touch fallback padding is capped');
}

{
  const inputSource = read('js/MAREJIG_input.js');
  const moveBody = inputSource.slice(inputSource.indexOf('function MAREJIG_onPointerMove'), inputSource.indexOf('function MAREJIG_tryHaptic'));
  assert.doesNotMatch(moveBody, /Storage|saveActiveSave|saveLevelProgress|advanceIfSegmentComplete|Economy|findSnapCandidate|recalculateGroupBounds|getGroupOutline|buildCellsOutline/, 'pointermove avoids storage, segments, economy, snap and outline/bounds recalculation');
  assert.match(moveBody, /requestAnimationFrame\(MAREJIG_applyPendingMove\)/, 'pointermove coalesces drag updates with RAF');
}

console.log('phase8 audit tests ok');
