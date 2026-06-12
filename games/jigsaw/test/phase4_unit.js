const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {}, console, Date, Math, Set, Map };
sandbox.window = sandbox;
vm.createContext(sandbox);
['MAREJIG_groups.js', 'MAREJIG_segments.js'].forEach((file) => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
});

function makeScene() {
  const pieces = {
    p_001: { id: 'p_001', cells: [{ x: 0, y: 0 }], solution: { gridX: 0, gridY: 0 }, bounds: { w: 1, h: 1 }, segmentId: 's_0', groupId: 'g_001', revealed: true, visible: true },
    p_002: { id: 'p_002', cells: [{ x: 0, y: 0 }], solution: { gridX: 1, gridY: 0 }, bounds: { w: 1, h: 1 }, segmentId: 's_0', groupId: 'g_002', revealed: true, visible: true },
    p_003: { id: 'p_003', cells: [{ x: 0, y: 0 }], solution: { gridX: 3, gridY: 0 }, bounds: { w: 1, h: 1 }, segmentId: 's_1', groupId: 'g_003', revealed: false, visible: false }
  };
  return {
    puzzle: {
      seed: 123,
      pieces: JSON.parse(JSON.stringify(pieces)),
      groups: {
        g_001: { id: 'g_001', pieceIds: ['p_001'], anchorPieceId: 'p_001', x: 0, y: 0, visible: true },
        g_002: { id: 'g_002', pieceIds: ['p_002'], anchorPieceId: 'p_002', x: 0, y: 0, visible: true },
        g_003: { id: 'g_003', pieceIds: ['p_003'], anchorPieceId: 'p_003', x: 0, y: 0, visible: false }
      },
      adjacency: [{ id: 'e_1', a: 'p_001', b: 'p_002', sharedSides: [{}] }],
      segments: { currentSegmentIndex: 0, order: ['s_0', 's_1', 's_2'], items: {
        s_0: { id: 's_0', pieceIds: ['p_001', 'p_002'], revealed: true, completed: false },
        s_1: { id: 's_1', pieceIds: ['p_003'], revealed: false, completed: false },
        s_2: { id: 's_2', pieceIds: [], revealed: false, completed: false }
      } }
    },
    pieces: JSON.parse(JSON.stringify(pieces)),
    groups: {
      g_001: { id: 'g_001', pieceIds: ['p_001'], anchorPieceId: 'p_001', x: 52, y: 50, visible: true, zIndex: 1 },
      g_002: { id: 'g_002', pieceIds: ['p_002'], anchorPieceId: 'p_002', x: 80, y: 50, visible: true, zIndex: 2 },
      g_003: { id: 'g_003', pieceIds: ['p_003'], anchorPieceId: 'p_003', x: 120, y: 50, visible: false, zIndex: 3 }
    },
    board: { cellSize: 30 },
    staging: { pieceScale: 30, x: 0, y: 100, width: 300, height: 120 },
    camera: { zoom: 1 },
    progress: { mainGroupId: null, nextZIndex: 10, status: 'Jugando', puzzleCompletedLocal: false },
    ui: { activeSegmentId: 's_0', dirty: false }
  };
}

{
  const scene = makeScene();
  const candidate = sandbox.MAREJIG_Groups.findSnapCandidate(scene, 'g_001', { isTouch: false });
  assert(candidate, 'neighbor pieces should snap');
  assert.strictEqual(candidate.targetGroupId, 'g_002');
}

{
  const scene = makeScene();
  scene.puzzle.adjacency = [];
  assert.strictEqual(sandbox.MAREJIG_Groups.findSnapCandidate(scene, 'g_001', { isTouch: false }), null, 'non-neighbors should not snap');
}

{
  const scene = makeScene();
  scene.puzzle.adjacency.push({ id: 'e_hidden', a: 'p_001', b: 'p_003', sharedSides: [{}] });
  assert.strictEqual(sandbox.MAREJIG_Groups.findSnapCandidate(scene, 'g_001', { isTouch: true }).targetGroupId, 'g_002', 'hidden neighbor should not be candidate');
}

{
  const scene = makeScene();
  scene.pieces.p_002.groupId = 'g_001';
  scene.groups.g_001.pieceIds.push('p_002');
  delete scene.groups.g_002;
  assert.strictEqual(sandbox.MAREJIG_Groups.findSnapCandidate(scene, 'g_001', { isTouch: false }), null, 'same group should not snap');
}

{
  const scene = makeScene();
  const merged = sandbox.MAREJIG_Groups.mergeSceneGroups(scene, 'g_001', 'g_002', { dx: 0, dy: 0 });
  assert(merged);
  assert.strictEqual(scene.groups.g_001, undefined);
  assert.deepStrictEqual(scene.groups.g_002.pieceIds.sort(), ['p_001', 'p_002']);
  assert.strictEqual(scene.pieces.p_001.groupId, 'g_002');
  assert.strictEqual(scene.puzzle.pieces.p_001.groupId, 'g_002');
}

{
  const scene = makeScene();
  sandbox.MAREJIG_Groups.mergeSceneGroups(scene, 'g_001', 'g_002', { dx: 0, dy: 0 });
  const result = sandbox.MAREJIG_Segments.advanceIfSegmentComplete(scene);
  assert.strictEqual(result.completed, true);
  assert.strictEqual(result.revealed, 's_1');
  assert.strictEqual(scene.puzzle.segments.items.s_1.revealed, true);
  assert.strictEqual(scene.puzzle.segments.items.s_2.revealed, false);
}

console.log('phase4 unit tests ok');
