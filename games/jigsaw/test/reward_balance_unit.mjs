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
assert.equal(catalog.getById('raiden_shogun_001').rewardCoins, 125, 'Raiden Shogun standard reward is 125');

const economySandbox = loadSandbox(['MAREJIG_economy.js']);
const calls = [];
economySandbox.GameCenter = { completeLevel(gameId, rewardLevelId, coins) { calls.push({ gameId, rewardLevelId, coins }); } };
const raiden = catalog.getById('raiden_shogun_001');
assert.equal(economySandbox.MAREJIG_Economy.reportLevelCompleted(raiden, {}).coins, 125, 'economy reports balanced reward');
assert.equal(economySandbox.MAREJIG_Economy.reportLevelCompleted(raiden, { rewardReported: true }).mode, 'already-reported');
assert.deepEqual(calls, [{ gameId: 'jigsaw', rewardLevelId: 'level_raiden_shogun_001', coins: 125 }], 'repeat completion does not call completeLevel again');

const sources = fs.readdirSync(jsDir).filter((file) => file.endsWith('.js')).map((file) => [file, fs.readFileSync(path.join(jsDir, file), 'utf8')]);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal((sources.find(([file]) => file === 'MAREJIG_economy.js')[1].match(/completeLevel\s*\(/g) || []).length, 1, 'economy owns the only completeLevel call');
sources.filter(([file]) => file !== 'MAREJIG_economy.js').forEach(([file, source]) => assert.doesNotMatch(source, /completeLevel\s*\(/, `${file} must not call completeLevel`));
assert.equal([...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].at(-1)[1], '../../js/app.js', 'Love Arcade app.js stays last');
assert.doesNotMatch(sources.map(([, source]) => source).join('\n'), /\b(?:addCoins|spendCoins|getBalance)\s*\(/, 'forbidden economy methods stay absent');
assert.doesNotMatch(sources.map(([, source]) => source).join('\n'), /window(?:Object)?\.(?:GameCenter|ECONOMY|THEMES)\s*=/, 'forbidden window assignments stay absent');
assert.doesNotMatch(sources.map(([, source]) => source).join('\n'), /\b(?:CONFIG|ECONOMY|THEMES)\s*=/, 'forbidden globals stay absent');

console.log('reward balance unit tests ok');
