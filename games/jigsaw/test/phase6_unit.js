const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function loadSandbox(files) { const store = new Map(); const sandbox = { console, Date, Math, Set, Map, JSON, Object, Array, Number, String, Boolean, window: null, localStorage: { getItem(k) { return store.has(k) ? store.get(k) : null; }, setItem(k,v) { store.set(k,String(v)); }, removeItem(k) { store.delete(k); }, _store: store } }; sandbox.window=sandbox; vm.createContext(sandbox); files.forEach((file)=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',file),'utf8'),sandbox,{filename:file})); return sandbox; }
const files=['MAREJIG_config.js','MAREJIG_shapes.js','MAREJIG_groups.js','MAREJIG_segments.js','MAREJIG_generator.js','MAREJIG_scene.js','MAREJIG_storage.js','MAREJIG_economy.js'];
function fixture(sandbox) { const level={id:'phase6',title:'Phase 6',pack:'Unit',difficulty:'test',rewardCoins:9,board:{cols:12,rows:9},targetPieceCount:40,segmentPlan:[8,8,8,8,8]}; const puzzle=sandbox.MAREJIG_Generator.generate(level); const scene=sandbox.MAREJIG_Scene.createScene(level,puzzle,{drawable:null,failed:true}); sandbox.MAREJIG_Scene.layoutScene(scene,390,844); return {level,puzzle,scene}; }
{
 const sandbox=loadSandbox(files); const {scene}=fixture(sandbox);
 assert.strictEqual(sandbox.MAREJIG_Hints, undefined, 'gameplay does not expose hints');
 assert.strictEqual(Object.prototype.hasOwnProperty.call(scene.progress,'hintsUsed'), false, 'new scenes do not track hint usage');
 assert(scene.world.width>scene.viewport.width && scene.world.height>scene.viewport.height, 'sandbox world exceeds viewport');
}
{
 const sandbox=loadSandbox(files); const {level,puzzle,scene}=fixture(sandbox);
 const legacySave={version:1,levelId:level.id,puzzleSeed:puzzle.seed,generatorVersion:puzzle.generatorVersion,elapsedMs:30000,moves:5,hintsUsed:2,currentSegmentIndex:0,completedSegmentIds:[],revealedSegmentIds:['s_0'],mainGroupId:null,puzzleCompletedLocal:false,completionStarted:false,rewardReported:false,pieces:Object.keys(scene.pieces).map((pieceId)=>({pieceId,groupId:scene.pieces[pieceId].groupId,revealed:scene.pieces[pieceId].visible,locked:false})),groups:Object.keys(scene.groups).map((groupId)=>({groupId,pieceIds:scene.groups[groupId].pieceIds.slice(),x:scene.groups[groupId].x,y:scene.groups[groupId].y,zIndex:scene.groups[groupId].zIndex,lockedToBoard:false,visible:scene.groups[groupId].visible}))};
 sandbox.localStorage.setItem('MAREJIG_activeSave_v1',JSON.stringify(legacySave)); assert(sandbox.MAREJIG_Storage.getActiveSave(), 'legacy saves with hintsUsed remain tolerated');
 sandbox.MAREJIG_Storage.saveActiveSave(legacySave); assert.strictEqual(sandbox.localStorage.getItem('MAREJIG_activeSave_v1').includes('hintsUsed'),false,'new compact saves omit hint usage');
 sandbox.MAREJIG_Storage.markLevelCompleted(level,{elapsedMs:25000,moves:4,hintsUsed:1,rewardReported:true,rewardCoins:9,rewardLevelId:'level_phase6'}); assert.strictEqual(sandbox.localStorage.getItem('MAREJIG_completedLevels_v1').includes('hintsUsed'),false,'new completion summaries omit hint usage');
}
console.log('phase6 unit tests ok');
