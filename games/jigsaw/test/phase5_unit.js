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

{
  const sandbox = loadSandbox(['MAREJIG_storage.js']);
  sandbox.localStorage.setItem('MAREJIG_activeSave_v1', '{bad json');
  assert.doesNotThrow(() => sandbox.MAREJIG_Storage.getActiveSave());
  assert.strictEqual(sandbox.MAREJIG_Storage.getActiveSave(), null);
}

{
  const sandbox = loadSandbox(['MAREJIG_economy.js']);
  const level = { id: 'aurora', rewardCoins: 12.9 };
  assert.strictEqual(JSON.stringify(sandbox.MAREJIG_Economy.reportLevelCompleted(level, {})), JSON.stringify({
    ok: true,
    mode: 'standalone',
    coins: 12,
    rewardLevelId: 'level_aurora'
  }));
  const calls = [];
  sandbox.GameCenter = { ['complete' + 'Level'](gameId, rewardLevelId, coins) { calls.push({ gameId, rewardLevelId, coins }); } };
  assert.strictEqual(sandbox.MAREJIG_Economy.reportLevelCompleted(level, {}).mode, 'gamecenter');
  assert.deepStrictEqual(calls, [{ gameId: 'jigsaw', rewardLevelId: 'level_aurora', coins: 12 }]);
  assert.strictEqual(sandbox.MAREJIG_Economy.reportLevelCompleted(level, { rewardReported: true }).mode, 'already-reported');
  assert.strictEqual(calls.length, 1);
}

{
  const sandbox = loadSandbox([
    'MAREJIG_config.js',
    'MAREJIG_shapes.js',
    'MAREJIG_groups.js',
    'MAREJIG_segments.js',
    'MAREJIG_generator.js',
    'MAREJIG_scene.js',
    'MAREJIG_storage.js'
  ]);
  const level = { id: 'resume_test', title: 'Resume', pack: 'Unit', difficulty: 'test', rewardCoins: 5, board: { cols: 16, rows: 12 }, targetPieceCount: 60, segmentPlan: [10, 10, 12, 12, 16] };
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  const firstGroupId = Object.keys(scene.groups)[0];
  scene.groups[firstGroupId].x = 123;
  scene.groups[firstGroupId].y = 45;
  scene.progress.moves = 7;
  const save = {
    version: 1,
    levelId: level.id,
    puzzleSeed: puzzle.seed,
    generatorVersion: puzzle.generatorVersion,
    elapsedMs: 90000,
    moves: scene.progress.moves,
    hintsUsed: 0,
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
  const loaded = sandbox.MAREJIG_Storage.getActiveSave();
  const regenerated = sandbox.MAREJIG_Generator.generate(level);
  const resumedScene = sandbox.MAREJIG_Scene.createScene(level, regenerated, { drawable: null, failed: true });
  assert.strictEqual(sandbox.MAREJIG_Scene.applySave(resumedScene, loaded), true);
  assert.strictEqual(resumedScene.groups[firstGroupId].x, 123);
  assert.strictEqual(resumedScene.groups[firstGroupId].y, 45);
  assert.strictEqual(resumedScene.progress.moves, 7);
  assert.deepStrictEqual(Object.keys(resumedScene.groups).sort(), loaded.groups.map((group) => group.groupId).sort());
}

console.log('phase5 unit tests ok');
