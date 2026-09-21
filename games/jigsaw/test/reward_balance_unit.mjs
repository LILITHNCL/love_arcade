import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');

function loadSandbox(files) {
  const sandbox = { console, Date, Math, Set, Map, JSON, Object, Array, Number, String, Boolean, Promise, window: null };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(jsDir, file), 'utf8'), sandbox, { filename: file });
  return sandbox;
}

function makeLevel(catalog, difficulty, rewardCoins) {
  const config = catalog.getDifficultyConfig(difficulty);
  return {
    id: `${difficulty}_reward_fixture`, order: 999, title: difficulty, pack: 'Unit', difficulty,
    cloudinaryPublicId: `marejig/levels/${difficulty}-reward-fixture`, sourceFormat: 'avif', aspectRatio: '4:3',
    master: { width: 2400, height: 1800 }, board: { cols: config.board.cols, rows: config.board.rows },
    targetPieceCount: config.targetPieceCount, segmentPlan: config.segmentPlan.slice(), rewardCoins
  };
}

const catalogSandbox = loadSandbox(['MAREJIG_levels.js']);
const catalog = catalogSandbox.MAREJIG_LevelCatalog;
const expectedRewards = { easy: 75, standard: 125, hard: 200 };

for (const [difficulty, rewardCoins] of Object.entries(expectedRewards)) {
  assert.equal(catalog.getDifficultyConfig(difficulty).rewardCoins, rewardCoins, `${difficulty} config reward`);
  assert.equal(catalog.validateLevel(makeLevel(catalog, difficulty, rewardCoins)), true, `${difficulty} accepts balanced reward`);
}

assert.equal(catalog.validateLevel(makeLevel(catalog, 'easy', 74)), false, 'easy rejects non-balanced reward');
assert.equal(catalog.validateLevel(makeLevel(catalog, 'standard', 55)), false, 'standard rejects legacy 55 reward');
assert.equal(catalog.validateLevel(makeLevel(catalog, 'hard', 199)), false, 'hard rejects rewards below 200');
for (const level of catalog.levels) assert.equal(level.rewardCoins, expectedRewards[level.difficulty], `${level.id} derives reward from difficulty`);
const expectedIds = Array.from({ length: 11 }, (_, index) => `nivel_${String(index + 1).padStart(3, '0')}`);
const expectedOrders = Array.from({ length: 11 }, (_, index) => index + 1);
const expectedPublicIds = Array.from({ length: 11 }, (_, index) => `nivel${String(index + 1).padStart(3, '0')}`);
const expectedDifficulties = ['easy', 'easy', 'standard', 'standard', 'standard', 'hard', 'hard', 'hard', 'hard', 'hard', 'hard'];
assert.equal(catalog.levels.length, 11, 'production catalog has exactly 11 levels');
assert.deepEqual(Array.from(catalog.levels, (level) => level.id), expectedIds, 'production catalog has stable sequential ids');
assert.equal(new Set(Array.from(catalog.levels, (level) => level.id)).size, 11, 'production catalog ids are unique');
assert.deepEqual(Array.from(catalog.levels, (level) => level.order), expectedOrders, 'production catalog orders are 1 through 11');
assert.deepEqual(Array.from(catalog.levels, (level) => level.cloudinaryPublicId), expectedPublicIds, 'production catalog uses exact Cloudinary public ids');
assert.deepEqual(Array.from(catalog.levels, (level) => level.difficulty), expectedDifficulties, 'production catalog difficulty distribution is exact');
assert.equal(catalog.levels.every((level) => level.pack === 'Producción'), true, 'production catalog uses generic Producción pack');
assert.equal(catalog.levels.every((level) => !/^https?:\/\//.test(level.cloudinaryPublicId)), true, 'catalog public ids are not full URLs');
assert.deepEqual(catalog.levels.reduce((counts, level) => ({ ...counts, [level.difficulty]: counts[level.difficulty] + 1 }), { easy: 0, standard: 0, hard: 0 }), { easy: 2, standard: 3, hard: 6 }, 'catalog has 2 easy, 3 standard and 6 hard levels');
assert.deepEqual(Array.from(catalog.levels, (level) => [level.board.cols, level.board.rows, level.targetPieceCount]), [
  [12, 9, 24], [12, 9, 24],
  [12, 9, 32], [12, 9, 32], [12, 9, 32],
  [16, 12, 60], [16, 12, 60], [16, 12, 60], [16, 12, 60], [16, 12, 60], [16, 12, 60]
], 'production metadata derives exact boards and target piece counts');

const economySandbox = loadSandbox(['MAREJIG_economy.js']);
const calls = [];
economySandbox.GameCenter = { completeLevel(gameId, rewardLevelId, coins) { calls.push({ gameId, rewardLevelId, coins }); } };
const productionLevel = catalog.getById('nivel_003');
assert.equal(economySandbox.MAREJIG_Economy.reportLevelCompleted(productionLevel, {}).coins, 125, 'economy reports balanced reward');
assert.equal(economySandbox.MAREJIG_Economy.reportLevelCompleted(productionLevel, { rewardReported: true }).mode, 'already-reported');
assert.deepEqual(calls, [{ gameId: 'jigsaw', rewardLevelId: 'level_nivel_003', coins: 125 }], 'repeat completion does not call completeLevel again');

const sources = fs.readdirSync(jsDir).filter((file) => file.endsWith('.js')).map((file) => [file, fs.readFileSync(path.join(jsDir, file), 'utf8')]);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal((sources.find(([file]) => file === 'MAREJIG_economy.js')[1].match(/completeLevel\s*\(/g) || []).length, 1, 'economy owns the only completeLevel call');
sources.filter(([file]) => file !== 'MAREJIG_economy.js').forEach(([file, source]) => assert.doesNotMatch(source, /completeLevel\s*\(/, `${file} must not call completeLevel`));
const scriptSources = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map((match) => match[1]);
const bridgeIndex = scriptSources.indexOf('../../js/game-bridge.js');
assert.ok(bridgeIndex !== -1, 'Love Arcade game bridge is loaded');
assert.ok(bridgeIndex < scriptSources.indexOf('./js/MAREJIG_economy.js'), 'bridge loads before the economy');
assert.ok(bridgeIndex < scriptSources.indexOf('./js/MAREJIG_main.js'), 'bridge loads before game startup');
assert.equal(scriptSources.includes('../../js/app.js'), false, 'hub UI bootstrap is not loaded by Marejig');
assert.doesNotMatch(sources.map(([, source]) => source).join('\n'), /\b(?:addCoins|spendCoins|getBalance)\s*\(/, 'forbidden economy methods stay absent');
assert.doesNotMatch(sources.map(([, source]) => source).join('\n'), /window(?:Object)?\.(?:GameCenter|ECONOMY|THEMES)\s*=/, 'forbidden window assignments stay absent');
assert.doesNotMatch(sources.map(([, source]) => source).join('\n'), /\b(?:CONFIG|ECONOMY|THEMES)\s*=/, 'forbidden globals stay absent');

console.log('reward balance unit tests ok');
