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
  if (level.board?.cols !== 12 || level.board?.rows !== 9) errors.push(`${level.id}: board debe ser 12×9`);
  if (level.sourceFormat !== 'avif') errors.push(`${level.id}: sourceFormat debe ser avif`);
  if (!level.cloudinaryPublicId || typeof level.cloudinaryPublicId !== 'string') errors.push(`${level.id}: cloudinaryPublicId vacío`);
  if (!Number.isInteger(level.rewardCoins) || level.rewardCoins <= 0) errors.push(`${level.id}: rewardCoins debe ser entero positivo`);
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
  if (puzzle.board.cols !== 12 || puzzle.board.rows !== 9 || puzzle.board.cellCount !== 108) errors.push(`${level.id}: board generado inválido`);
  if (!puzzle.validation.cellCoverageOk) errors.push(`${level.id}: cobertura de celdas inválida`);
  if (!puzzle.validation.adjacencyOk) errors.push(`${level.id}: adjacency inválida`);
  if (!puzzle.validation.segmentsOk) errors.push(`${level.id}: segmentos inválidos`);
  const ranges = { easy: [28, 34], standard: [36, 42], hard: [44, 50] };
  const [minPieces, maxPieces] = ranges[level.difficulty] || ranges.standard;
  if (puzzle.validation.pieceCount < minPieces || puzzle.validation.pieceCount > maxPieces) errors.push(`${level.id}: piece count ${puzzle.validation.pieceCount} fuera de ${minPieces}–${maxPieces}`);
  const variety = puzzle.validation.variety;
  if (level.difficulty === 'standard' && variety.nonRectangularPieceRatio < 0.55) errors.push(`${level.id}: nonRectangularPieceRatio insuficiente ${variety.nonRectangularPieceRatio}`);
  if (level.difficulty === 'standard' && variety.rectangularPieceRatio > 0.40) errors.push(`${level.id}: rectangularPieceRatio excesivo ${variety.rectangularPieceRatio}`);
  if (variety.monominoCount > 2) errors.push(`${level.id}: demasiados monominós ${variety.monominoCount}`);
  if (!puzzle.segments.items.s_0?.revealed) errors.push(`${level.id}: s_0 no revelado`);
  for (const segmentId of puzzle.segments.order) {
    if (!puzzle.segments.items[segmentId]?.pieceIds?.length) errors.push(`${level.id}: segmento vacío ${segmentId}`);
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
