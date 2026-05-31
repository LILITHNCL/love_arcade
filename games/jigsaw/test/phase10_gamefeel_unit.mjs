import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = path.join(root, 'js');
const sceneFiles = ['MAREJIG_config.js', 'MAREJIG_levels.js', 'MAREJIG_shapes.js', 'MAREJIG_groups.js', 'MAREJIG_segments.js', 'MAREJIG_generator.js', 'MAREJIG_scene.js'];
function load(files, extra = {}) {
  const sandbox = { console, Date, Math, Set, Map, JSON, Object, Array, Number, String, Boolean, window: null, ...extra };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(jsDir, file), 'utf8'), sandbox, { filename: file }));
  return sandbox;
}
function fixture(extra = {}) {
  const sandbox = load(sceneFiles, extra);
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  sandbox.MAREJIG_Scene.layoutScene(scene, 390, 844);
  return { sandbox, scene };
}
function visibleGroups(scene) { return Object.values(scene.groups).filter((group) => group.visible); }
function overlapRatio(a, b) {
  const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return (w * h) / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
}

{
  const { sandbox, scene } = fixture();
  assert(scene.board.width > scene.viewport.width * 1.25, 'portrait solution width is larger than the viewport');
  assert(scene.board.cellSize >= 40, 'cellSize prioritizes touch comfort on 390×844');
  assert(scene.world.width > scene.viewport.width && scene.world.height > scene.viewport.height, 'camera can pan through a larger world');
  const s0Bounds = sandbox.MAREJIG_Scene.getSegmentBounds(scene, 's_0');
  const visibleCenter = { x: scene.camera.x + scene.viewport.width / 2, y: scene.camera.y + scene.viewport.height / 2 };
  assert(Math.abs((s0Bounds.x + s0Bounds.width / 2) - visibleCenter.x) < scene.viewport.width * 0.28, 's_0 spawns near the initial visible center');
  for (let i = 0; i < visibleGroups(scene).length; i += 1) {
    for (let j = i + 1; j < visibleGroups(scene).length; j += 1) {
      assert(overlapRatio(visibleGroups(scene)[i].bounds, visibleGroups(scene)[j].bounds) < 0.10, 'initial spawn avoids significant overlap');
    }
  }
}

{
  const { sandbox, scene } = fixture();
  const active = scene.puzzle.segments.items.s_0;
  const mainGroupId = scene.pieces[active.pieceIds[0]].groupId;
  scene.progress.mainGroupId = mainGroupId;
  const focusBefore = { ...scene.groups[mainGroupId].bounds };
  const nextId = scene.puzzle.segments.order[1];
  const revealed = sandbox.MAREJIG_Segments.revealSegment(scene, nextId);
  assert(revealed.length > 0 && revealed.length <= 10, 'new segment reveals a compact batch');
  const revealBounds = scene.ui.lastRevealBounds;
  assert(revealBounds, 'revealing a segment returns focus bounds');
  const distance = Math.hypot((revealBounds.x + revealBounds.width / 2) - (focusBefore.x + focusBefore.width / 2), (revealBounds.y + revealBounds.height / 2) - (focusBefore.y + focusBefore.height / 2));
  assert(distance < Math.max(scene.viewport.width, scene.viewport.height), 'new pieces spawn near the main group');
  assert(scene.cameraTarget && Number.isFinite(scene.cameraTarget.x), 'segment reveal computes a target camera');
}

{
  const { sandbox, scene } = fixture();
  const group = visibleGroups(scene)[0];
  group.x = -9999; group.y = 9999;
  sandbox.MAREJIG_Scene.clampGroupToWorld(scene, group);
  assert(group.bounds.x >= scene.world.x && group.bounds.y + group.bounds.height <= scene.world.y + scene.world.height, 'dragging outside clamps group inside world walls');
  const [a, b] = visibleGroups(scene).slice(0, 2);
  a.x += b.bounds.x - a.bounds.x; a.y += b.bounds.y - a.bounds.y;
  sandbox.MAREJIG_Groups.recalculateGroupBounds(scene, a.id);
  assert(sandbox.MAREJIG_Scene.resolveGroupOverlap(scene, a.id), 'overlapped passive group resolves to a nearby free position');
  assert(overlapRatio(a.bounds, b.bounds) < 0.10, 'resolved groups no longer have significant overlap');
}

{
  const { sandbox, scene } = fixture();
  const [a, b] = visibleGroups(scene).slice(0, 2);
  a.x += b.bounds.x + b.bounds.width + 2 - a.bounds.x;
  a.y += b.bounds.y - a.bounds.y;
  sandbox.MAREJIG_Groups.recalculateGroupBounds(scene, a.id);
  const contact = sandbox.MAREJIG_Scene.getIncorrectContact(scene, a.id);
  assert(contact, 'incorrect touching groups are detected');
  sandbox.MAREJIG_Scene.markInvalidContact(scene, contact.groupId, contact.targetGroupId, { durationMs: 200 });
  assert.equal(scene.feedback.invalidContact.groupId, a.id, 'invalidContact feedback stores the active group');
  sandbox.MAREJIG_Scene.clearInvalidContact(scene, a.id);
  assert.equal(scene.feedback.invalidContact, null, 'moving a group clears invalid feedback');
}

{
  const frames = [];
  const sandbox = load([...sceneFiles, 'MAREJIG_renderer.js'], {
    requestAnimationFrame(cb) { frames.push(cb); return frames.length; },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {},
    setTimeout(fn) { return fn(); },
    clearTimeout() {},
    devicePixelRatio: 1,
    matchMedia() { return { matches: true }; }
  });
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  const canvas = { width: 0, height: 0, clientWidth: 390, clientHeight: 844, getBoundingClientRect() { return { width: 390, height: 844 }; }, getContext() { return { save(){}, restore(){}, setTransform(){}, clearRect(){}, createLinearGradient(){ return { addColorStop(){} }; }, fillRect(){}, beginPath(){}, arc(){}, fill(){}, scale(){}, translate(){}, strokeRect(){}, setLineDash(){}, moveTo(){}, lineTo(){}, stroke(){}, rect(){}, clip(){}, drawImage(){}, fillText(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, set shadowColor(v){}, set shadowBlur(v){}, set shadowOffsetY(v){}, set textAlign(v){}, set font(v){}, set lineJoin(v){}, set lineCap(v){}, set globalAlpha(v){} }; } };
  sandbox.MAREJIG_Renderer.init(canvas);
  sandbox.MAREJIG_Renderer.setScene(scene);
  const before = { ...scene.camera };
  sandbox.MAREJIG_Renderer.animateCameraTo({ x: before.x + 25, y: before.y + 25, zoom: before.zoom }, 280);
  assert.equal(scene.camera.x, before.x + 25, 'reduced-motion camera animation jumps directly to target');
  assert(frames.length < 5, 'camera animation does not create a permanent render loop');
}

{
  const sandbox = load(['MAREJIG_audio.js'], {
    MAREJIG_Storage: { getSettings() { return { sound: false }; } },
    AudioContext: class { constructor() { throw new Error('should not be created while sound=false'); } }
  });
  sandbox.MAREJIG_Audio.init();
  assert.equal(sandbox.MAREJIG_Audio.playSelect(), false, 'audio respects sound=false without throwing');
  assert.equal(sandbox.MAREJIG_Audio.state.context, null, 'audio context is not created before an enabled interaction');
}

console.log('phase10 game feel unit tests ok');
