#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');

function loadSandbox(files) {
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
    window: null
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(jsDir, file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox;
}

function assertLevelShape(level, index, catalog) {
  const errors = [];
  const allowed = new Set(catalog.allowedLevelKeys);
  for (const key of Object.keys(level)) {
    if (!allowed.has(key)) errors.push(`${level.id || `#${index}`}: campo inesperado ${key}`);
  }
  if (!catalog.validateLevel(level)) errors.push(`${level.id || `#${index}`}: validateLevel devolvió false`);
  if (level.aspectRatio !== '4:3') errors.push(`${level.id}: aspectRatio debe ser 4:3`);
  if (level.master?.width !== 2400 || level.master?.height !== 1800) errors.push(`${level.id}: master debe ser 2400×1800`);
  const expectedBoards = { easy: [12, 9], standard: [12, 9], hard: [16, 12] };
  const expectedBoard = expectedBoards[level.difficulty] || expectedBoards.standard;
  if (level.board?.cols !== expectedBoard[0] || level.board?.rows !== expectedBoard[1]) errors.push(`${level.id}: board debe ser ${expectedBoard[0]}×${expectedBoard[1]}`);
  if (level.board && level.board.cols / level.board.rows !== 4 / 3) errors.push(`${level.id}: board debe conservar 4:3`);
  if (level.sourceFormat !== 'avif') errors.push(`${level.id}: sourceFormat debe ser avif`);
  if (!level.cloudinaryPublicId || typeof level.cloudinaryPublicId !== 'string') errors.push(`${level.id}: cloudinaryPublicId vacío`);
  if (!Number.isInteger(level.rewardCoins) || level.rewardCoins <= 0) errors.push(`${level.id}: rewardCoins debe ser entero positivo`);
  const expectedRewards = { easy: 75, standard: 125, hard: 200 };
  const expectedReward = expectedRewards[level.difficulty];
  if (level.rewardCoins !== expectedReward) errors.push(`${level.id}: rewardCoins debe ser ${expectedReward} para dificultad ${level.difficulty}`);
  if (!catalog.getDifficulties().includes(level.difficulty)) errors.push(`${level.id}: difficulty no reconocida`);
  const segmentTotal = Array.isArray(level.segmentPlan) ? level.segmentPlan.reduce((sum, value) => sum + value, 0) : 0;
  if (segmentTotal !== level.targetPieceCount || !level.segmentPlan.every((value) => Number.isInteger(value) && value > 0)) {
    errors.push(`${level.id}: segmentPlan inválido`);
  }
  return errors;
}

function validatePuzzle(level, puzzle) {
  const errors = [];
  if (!puzzle || !puzzle.validation?.ok) errors.push(`${level.id}: puzzle inválido ${puzzle?.validation?.errors?.join('; ') || ''}`);
  if (puzzle.board.cols !== level.board.cols || puzzle.board.rows !== level.board.rows || puzzle.board.cellCount !== level.board.cols * level.board.rows) errors.push(`${level.id}: board generado inválido`);
  if (puzzle.board.cols / puzzle.board.rows !== 4 / 3) errors.push(`${level.id}: board generado no conserva 4:3`);
  if (!puzzle.validation.cellCoverageOk) errors.push(`${level.id}: cobertura de celdas inválida`);
  if (!puzzle.validation.adjacencyOk) errors.push(`${level.id}: adjacency inválida`);
  if (!puzzle.validation.segmentsOk) errors.push(`${level.id}: segmentos inválidos`);
  const ranges = { easy: [22, 28], standard: [28, 34], hard: [56, 64] };
  const [minPieces, maxPieces] = ranges[level.difficulty] || ranges.standard;
  if (puzzle.validation.pieceCount < minPieces || puzzle.validation.pieceCount > maxPieces) errors.push(`${level.id}: piece count ${puzzle.validation.pieceCount} fuera de ${minPieces}–${maxPieces}`);
  const variety = puzzle.validation.variety;
  if (level.difficulty === 'standard' && variety.nonRectangularPieceRatio < 0.55) errors.push(`${level.id}: nonRectangularPieceRatio insuficiente ${variety.nonRectangularPieceRatio}`);
  if (level.difficulty === 'standard' && variety.rectangularPieceRatio > 0.40) errors.push(`${level.id}: rectangularPieceRatio excesivo ${variety.rectangularPieceRatio}`);
  if (variety.monominoCount > 2) errors.push(`${level.id}: demasiados monominós ${variety.monominoCount}`);
  if (!puzzle.segments.items.s_0?.revealed) errors.push(`${level.id}: s_0 no revelado`);
  for (const segmentId of puzzle.segments.order) {
    const segmentSize = puzzle.segments.items[segmentId]?.pieceIds?.length || 0;
    if (!segmentSize) errors.push(`${level.id}: segmento vacío ${segmentId}`);
    if (level.difficulty === 'hard' && segmentSize > 10) errors.push(`${level.id}: hard revela más de 10 piezas en ${segmentId}`);
  }
  return errors;
}

const sandbox = loadSandbox([
  'MAREJIG_config.js',
  'MAREJIG_levels.js',
  'MAREJIG_shapes.js',
  'MAREJIG_groups.js',
  'MAREJIG_segments.js',
  'MAREJIG_generator.js'
]);

const catalog = sandbox.MAREJIG_LevelCatalog;
const errors = [];
const seenIds = new Set();
const seenOrders = new Set();

const expectedRewards = { easy: 75, standard: 125, hard: 200 };
for (const [difficulty, rewardCoins] of Object.entries(expectedRewards)) {
  if (catalog.getDifficultyConfig(difficulty).rewardCoins !== rewardCoins) {
    errors.push(`${difficulty}: difficultyConfig.rewardCoins debe ser ${rewardCoins}`);
  }
}

const standardConfig = catalog.getDifficultyConfig('standard');
const invalidStandardReward = {
  id: 'invalid_standard_reward', order: 999, title: 'Inválido', pack: 'Validator', difficulty: 'standard',
  cloudinaryPublicId: 'marejig/levels/invalid-standard-reward', sourceFormat: 'avif', aspectRatio: '4:3',
  master: { width: 2400, height: 1800 }, board: { cols: standardConfig.board.cols, rows: standardConfig.board.rows },
  targetPieceCount: standardConfig.targetPieceCount, segmentPlan: standardConfig.segmentPlan.slice(), rewardCoins: 55
};
if (catalog.validateLevel(invalidStandardReward)) errors.push('validateLevel debe rechazar standard con rewardCoins 55');

const catalogResult = catalog.validateCatalog();
if (!catalogResult.valid) errors.push(...catalogResult.errors);

catalog.levels.forEach((level, index) => {
  errors.push(...assertLevelShape(level, index, catalog));
  if (seenIds.has(level.id)) errors.push(`ID duplicado: ${level.id}`);
  seenIds.add(level.id);
  if (seenOrders.has(level.order)) errors.push(`order duplicado: ${level.order}`);
  seenOrders.add(level.order);
  const puzzle = sandbox.MAREJIG_Generator.generate(level);
  errors.push(...validatePuzzle(level, puzzle));
});

if (errors.length) {
  console.error(`validate-levels encontró ${errors.length} error(es):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`validate-levels ok: ${catalog.levels.length} niveles validados.`);
