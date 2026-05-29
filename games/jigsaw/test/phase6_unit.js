const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadSandbox(files) {
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
    window: null,
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); },
      _store: store
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  files.forEach((file) => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  });
  return sandbox;
}

function sceneFixture(sandbox) {
  const level = { id: 'phase6', title: 'Phase 6', pack: 'Unit', difficulty: 'test', rewardCoins: 9, board: { cols: 12, rows: 9 }, targetPieceCount: 40, segmentPlan: [8, 8, 8, 8, 8] };
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  sandbox.MAREJIG_Scene.layoutScene(scene, 390, 844);
  return { level, puzzle, scene };
}

const files = [
  'MAREJIG_config.js',
  'MAREJIG_shapes.js',
  'MAREJIG_groups.js',
  'MAREJIG_segments.js',
  'MAREJIG_hints.js',
  'MAREJIG_generator.js',
  'MAREJIG_scene.js',
  'MAREJIG_storage.js',
  'MAREJIG_economy.js'
];

{
  const sandbox = loadSandbox(files);
  const { scene } = sceneFixture(sandbox);
  const hiddenPieceIds = Object.keys(scene.pieces).filter((pieceId) => !scene.pieces[pieceId].visible);
  assert(hiddenPieceIds.length > 0, 'fixture should include hidden future-segment pieces');
  const beforePositions = Object.fromEntries(Object.keys(scene.groups).map((groupId) => [groupId, { x: scene.groups[groupId].x, y: scene.groups[groupId].y }]));
  const result = sandbox.MAREJIG_Hints.showHint(scene, { reducedMotion: true });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(scene.progress.hintsUsed, 1, 'hint increments hintsUsed');
  assert(scene.ui.hint.pieceIds.every((pieceId) => scene.pieces[pieceId].visible), 'hint never chooses hidden pieces');
  assert(scene.ui.hint.pieceIds.every((pieceId) => !hiddenPieceIds.includes(pieceId)), 'hint does not reveal future segment pieces');
  Object.keys(beforePositions).forEach((groupId) => {
    assert.strictEqual(scene.groups[groupId].x, beforePositions[groupId].x, 'hint must not move group x');
    assert.strictEqual(scene.groups[groupId].y, beforePositions[groupId].y, 'hint must not move group y');
  });
  scene.progress.gamePhase = 'completed';
  const blocked = sandbox.MAREJIG_Hints.showHint(scene, {});
  assert.strictEqual(blocked.ok, false, 'hint is blocked when completed');
  assert.strictEqual(scene.progress.hintsUsed, 1, 'blocked hint does not increment');
}

{
  const sandbox = loadSandbox(files);
  const { level, puzzle, scene } = sceneFixture(sandbox);
  scene.progress.moves = 5;
  scene.progress.hintsUsed = 2;
  const save = {
    version: 1,
    levelId: level.id,
    puzzleSeed: puzzle.seed,
    generatorVersion: puzzle.generatorVersion,
    elapsedMs: 30000,
    moves: scene.progress.moves,
    hintsUsed: scene.progress.hintsUsed,
    currentSegmentIndex: scene.puzzle.segments.currentSegmentIndex,
    completedSegmentIds: [],
    revealedSegmentIds: ['s_0'],
    mainGroupId: scene.progress.mainGroupId,
    puzzleCompletedLocal: false,
    completionStarted: false,
    rewardReported: false,
    pieces: Object.keys(scene.pieces).map((pieceId) => ({ pieceId, groupId: scene.pieces[pieceId].groupId, revealed: scene.pieces[pieceId].visible, locked: false })),
    groups: Object.keys(scene.groups).map((groupId) => ({ groupId, pieceIds: scene.groups[groupId].pieceIds.slice(), x: scene.groups[groupId].x, y: scene.groups[groupId].y, zIndex: scene.groups[groupId].zIndex, lockedToBoard: false, visible: scene.groups[groupId].visible }))
  };
  assert.strictEqual(sandbox.MAREJIG_Storage.saveActiveSave(save), true);
  sandbox.MAREJIG_Storage.markLevelCompleted(level, { elapsedMs: 25000, moves: 4, hintsUsed: 1, rewardReported: true, rewardCoins: 9, rewardLevelId: 'level_phase6' });
  sandbox.MAREJIG_Storage.clearActiveSave();
  sandbox.MAREJIG_Storage.clearLevelProgress(level.id);
  const resetScene = sandbox.MAREJIG_Scene.createScene(level, sandbox.MAREJIG_Generator.generate(level), { drawable: null, failed: true });
  assert.strictEqual(sandbox.MAREJIG_Storage.getActiveSave(), null, 'reset clears active save');
  assert.strictEqual(resetScene.progress.moves, 0, 'reset starts moves at zero');
  assert.strictEqual(resetScene.progress.hintsUsed, 0, 'reset starts hints at zero');
  assert.strictEqual(sandbox.MAREJIG_Storage.isLevelCompleted(level.id), true, 'reset keeps completed levels');
  const calls = [];
  sandbox.GameCenter = { ['complete' + 'Level'](gameId, rewardLevelId, coins) { calls.push([gameId, rewardLevelId, coins]); } };
  const economy = sandbox.MAREJIG_Economy.reportLevelCompleted(level, { rewardReported: true });
  assert.strictEqual(economy.mode, 'already-reported', 'replay completion should not duplicate reward');
  assert.strictEqual(calls.length, 0, 'no duplicate GameCenter payment');
}

console.log('phase6 unit tests ok');
