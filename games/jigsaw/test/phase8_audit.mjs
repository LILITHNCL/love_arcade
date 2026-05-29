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
    'MAREJIG_scene.js',
    'MAREJIG_hints.js'
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
  assert.match(html, /<a class="marejig-exit-link" href="\.\.\/\.\.\/index\.html"/, 'exit button points to Love Arcade root');
  const scriptSources = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map((match) => match[1]);
  assert.equal(scriptSources.at(-1), '../../js/app.js', 'Love Arcade app.js remains the final body script');
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
  const level = sandbox.MAREJIG_LevelCatalog.getById('raiden_shogun_001');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  sandbox.MAREJIG_Scene.layoutScene(scene, 390, 844);
  assert.equal(scene.board.sourceCellW, scene.imageMeta.width / 12, 'sourceCellW uses 12 columns');
  assert.equal(scene.board.sourceCellH, scene.imageMeta.height / 9, 'sourceCellH uses 9 rows');
  const firstSegmentId = scene.puzzle.segments.order[0];
  const secondSegmentId = scene.puzzle.segments.order[1];
  const hiddenSegmentId = scene.puzzle.segments.order[2];
  const hiddenPieceId = scene.puzzle.segments.items[hiddenSegmentId].pieceIds[0];
  const hiddenGroupId = scene.pieces[hiddenPieceId].groupId;
  assert.equal(sandbox.MAREJIG_Groups.findSnapCandidate(scene, hiddenGroupId), null, 'hidden pieces cannot snap');
  const revealedBeforeHint = scene.puzzle.segments.order.filter((segmentId) => scene.puzzle.segments.items[segmentId].revealed);
  const visibleBeforeHint = sandbox.MAREJIG_Scene.getVisiblePieceIds(scene).sort();
  const hint = sandbox.MAREJIG_Hints.showHint(scene, { reducedMotion: true });
  assert.equal(hint.ok, true, 'hint can target current visible segment');
  assert.deepEqual(sandbox.MAREJIG_Scene.getVisiblePieceIds(scene).sort(), visibleBeforeHint, 'hint does not move or reveal pieces');
  assert.deepEqual(scene.puzzle.segments.order.filter((segmentId) => scene.puzzle.segments.items[segmentId].revealed), revealedBeforeHint, 'hint does not reveal future segments');
  forceSegmentComplete(scene, firstSegmentId);
  const firstAdvance = sandbox.MAREJIG_Segments.advanceIfSegmentComplete(scene);
  assert.equal(firstAdvance.revealed, secondSegmentId, 'one completed segment reveals exactly the next segment');
  assert.equal(scene.puzzle.segments.currentSegmentIndex, 1, 'segment index advances by one');
  const secondAdvanceWithoutCompletion = sandbox.MAREJIG_Segments.advanceIfSegmentComplete(scene);
  assert.equal(secondAdvanceWithoutCompletion.completed, false, 'next segment does not auto-complete');
}

{
  const sandbox = loadGameplaySandbox({ Date });
  const level = sandbox.MAREJIG_LevelCatalog.getById('raiden_shogun_001');
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
  assert.match(inputSource, /gamePhase === 'completing' \|\| scene\.progress\.gamePhase === 'completed'/, 'input blocks during victory/completion');
  assert.match(groupsSource, /MAREJIG_getAdjacencyEdges\(scene, pieceId\)/, 'snap is based on adjacency edges');
  assert.match(groupsSource, /!neighborSegment \|\| !neighborSegment\.revealed/, 'snap ignores unrevealed future pieces');
  assert.match(segmentsSource, /if \(activeSegment\.completed\) return/, 'completed segments cannot fire twice');
}

console.log('phase8 audit tests ok');
