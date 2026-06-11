import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = path.join(root, 'js');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function load(files, extra = {}) {
  const sandbox = { console, Date, Math, Set, Map, JSON, Object, Array, Number, String, Boolean, window: null, ...extra };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(jsDir, file), 'utf8'), sandbox, { filename: file }));
  return sandbox;
}

function fixture(width = 390, height = 844) {
  const sandbox = load(['MAREJIG_config.js', 'MAREJIG_levels.js', 'MAREJIG_shapes.js', 'MAREJIG_groups.js', 'MAREJIG_segments.js', 'MAREJIG_generator.js', 'MAREJIG_scene.js']);
  const level = sandbox.MAREJIG_LevelCatalog.getById('nivel_003');
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  const scene = sandbox.MAREJIG_Scene.createScene(level, puzzle, { drawable: null, failed: true });
  sandbox.MAREJIG_Scene.layoutScene(scene, width, height);
  const allPieceIds = Object.keys(scene.pieces);
  const mainGroupId = scene.pieces[allPieceIds[0]].groupId;
  scene.groups[mainGroupId].pieceIds = allPieceIds.slice();
  scene.groups[mainGroupId].visible = true;
  scene.groups[mainGroupId].positioned = true;
  scene.groups[mainGroupId].x = scene.board.x;
  scene.groups[mainGroupId].y = scene.board.y;
  scene.progress.mainGroupId = mainGroupId;
  scene.progress.puzzleCompletedLocal = true;
  allPieceIds.forEach((pieceId) => {
    scene.pieces[pieceId].groupId = mainGroupId;
    scene.pieces[pieceId].visible = true;
  });
  sandbox.MAREJIG_Groups.recalculateGroupBounds(scene, mainGroupId);
  return { sandbox, scene };
}

{
  const { sandbox, scene } = fixture(390, 844);
  const bounds = sandbox.MAREJIG_Scene.getCompletedPuzzleBounds(scene);
  const target = sandbox.MAREJIG_Scene.computeShowcaseCamera(scene, bounds);
  const left = (bounds.x - target.x) * target.zoom;
  const right = (bounds.x + bounds.width - target.x) * target.zoom;
  const top = (bounds.y - target.y) * target.zoom;
  const bottom = (bounds.y + bounds.height - target.y) * target.zoom;
  assert(left >= 23 && right <= scene.viewport.width - 23, 'portrait showcase keeps comfortable horizontal margin');
  assert(top >= 23 && bottom <= scene.viewport.height - 23, 'portrait showcase keeps full image visible vertically');
  assert(right - left > scene.viewport.width * 0.70, 'portrait showcase image is not diminished');
}

{
  const { sandbox, scene } = fixture(844, 390);
  const bounds = sandbox.MAREJIG_Scene.getCompletedPuzzleBounds(scene);
  const target = sandbox.MAREJIG_Scene.computeShowcaseCamera(scene, bounds);
  const shownHeight = bounds.height * target.zoom;
  assert(shownHeight <= scene.viewport.height - 48, 'landscape showcase leaves top and bottom margin');
  assert(shownHeight >= scene.viewport.height * 0.58, 'landscape showcase prioritizes appreciable height');
}

{
  const { sandbox, scene } = fixture();
  const showcase = sandbox.MAREJIG_Scene.startCompletionShowcase(scene, { reducedMotion: false });
  assert.equal(scene.progress.gamePhase, 'showcase', 'showcase is an explicit post-completion phase');
  assert.equal(scene.performance.isDragging, false, 'dragging is cancelled during showcase');
  assert.equal(scene.performance.isPanning, false, 'panning is cancelled during showcase');
  assert.equal(showcase.durationMs, 8000, 'production showcase lasts about eight seconds');
  assert(showcase.cameraDurationMs >= 900 && showcase.cameraDurationMs <= 1400, 'camera duration is premium but controlled');
  assert(showcase.particles.length <= 28, 'showcase particle count stays capped');
  sandbox.MAREJIG_Scene.finishCompletionShowcase(scene);
  assert.equal(scene.feedback.completionShowcase, null, 'showcase feedback is cleaned after completion');
}

{
  const { sandbox, scene } = fixture();
  const showcase = sandbox.MAREJIG_Scene.startCompletionShowcase(scene, { reducedMotion: true });
  assert(showcase.durationMs >= 2500 && showcase.durationMs <= 3500, 'reduced motion shortens the overall showcase');
  assert(showcase.cameraDurationMs <= 200, 'reduced motion camera is near-instant');
  assert.equal(showcase.particles.length, 0, 'reduced motion skips animated particles');
}

{
  const input = read('js/MAREJIG_input.js');
  const main = read('js/MAREJIG_main.js');
  const renderer = read('js/MAREJIG_renderer.js');
  const sceneSource = read('js/MAREJIG_scene.js');
  const css = read('css/marejig.css');
  assert.match(input, /gamePhase !== 'playing'/, 'pointer input is blocked outside playing, including showcase');
  assert.match(main, /gamePhase === 'showcase'/, 'pause/options are blocked during showcase');
  assert.match(main, /completionStarted && \(scene\.progress\.gamePhase === 'completing' \|\| scene\.progress\.gamePhase === 'showcase' \|\| scene\.progress\.gamePhase === 'victory'\)/, 'completionStarted prevents duplicate showcase or victory');
  assert.match(renderer, /animateCompletionShowcase/, 'renderer owns event-driven showcase animation');
  assert.match(renderer, /showcaseRafId = 0/, 'showcase render loop is stopped explicitly');
  assert.match(sceneSource, /particleCount \|\| 24/, 'particles are created once from config');
  assert.doesNotMatch(css, /backdrop-filter|filter\s*:\s*blur/i, 'showcase CSS avoids glass and blur filters');
  assert.doesNotMatch(css, /animation[^;]*infinite/i, 'showcase CSS avoids infinite animations');
}

console.log('completion showcase unit tests ok');
