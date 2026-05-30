import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const jsDir=path.join(root,'js');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function load(files,extra={}){ const sandbox={console,Date,Math,Set,Map,JSON,Object,Array,Number,String,Boolean,window:null,...extra}; sandbox.window=sandbox; vm.createContext(sandbox); files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(jsDir,f),'utf8'),sandbox,{filename:f})); return sandbox; }
const files=['MAREJIG_config.js','MAREJIG_levels.js','MAREJIG_shapes.js','MAREJIG_groups.js','MAREJIG_segments.js','MAREJIG_generator.js','MAREJIG_scene.js'];
function fixture(extra={}){ const sandbox=load(files,extra); const level=sandbox.MAREJIG_LevelCatalog.getById('raiden_shogun_001'); const puzzle=sandbox.MAREJIG_Generator.generate(level); const scene=sandbox.MAREJIG_Scene.createScene(level,puzzle,{drawable:null,failed:true}); sandbox.MAREJIG_Scene.layoutScene(scene,390,844); return {sandbox,scene}; }
{
 const html=read('index.html'); const renderer=read('js/MAREJIG_renderer.js'); const input=read('js/MAREJIG_input.js');
 assert.doesNotMatch(html,/marejig-hint-button|MAREJIG_hints\.js|>Pistas?</,'DOM and scripts omit hints');
 assert.doesNotMatch(renderer,/drawBoardPreview|drawHintGhost|drawStaging|globalAlpha\s*=\s*0\.11/,'renderer omits guide preview, hint ghost and staging');
 assert.doesNotMatch(renderer,/forEach\(function MAREJIG_drawCellImage|sourceCellW[\s\S]*drawImage\(/,'renderer does not paint image cell by cell');
 assert.match(renderer,/MAREJIG_traceGroupCells[\s\S]*context\.clip\(\)[\s\S]*context\.drawImage/,'group image is painted once under a union clip');
 assert.match(renderer,/MAREJIG_strokeOuterOutline/,'renderer strokes only external group outline');
 assert.match(input,/MAREJIG_Scene\.screenToWorld\(scene, screen\)/,'hit testing converts screen coordinates to world coordinates');
}
{
 const {sandbox,scene}=fixture();
 assert(scene.world.width>=scene.viewport.width*1.8 && scene.world.height>=scene.viewport.height*1.5,'world exceeds viewport recommendations');
 const ids=sandbox.MAREJIG_Scene.getVisiblePieceIds(scene).map(id=>scene.pieces[id].groupId); const positions=ids.map(id=>scene.groups[id]).map(g=>[Math.round(g.x),Math.round(g.y)]);
 assert(new Set(positions.map(p=>p.join(','))).size===positions.length,'initial pieces do not overlap at identical positions');
 assert(new Set(positions.map(p=>Math.round(p[1]/30))).size>1,'initial pieces are naturally spread over multiple rows');
 const group=scene.groups[ids[0]]; group.x=-9999; group.y=99999; sandbox.MAREJIG_Scene.clampGroupToWorld(scene,group);
 assert(group.bounds.x+group.bounds.width>=scene.world.safePadding*.4 && group.bounds.y<=scene.world.height,'group clamp keeps pieces recoverable in world');
 const stable=scene.groups[ids[1]]; const before={x:stable.x,y:stable.y}; sandbox.MAREJIG_Scene.layoutScene(scene,844,390); assert.deepEqual({x:stable.x,y:stable.y},before,'resize preserves group absolute world position');
 const cameraBefore=scene.camera.x; scene.camera.x+=500; sandbox.MAREJIG_Scene.clampCamera(scene); assert.notEqual(scene.camera.x,cameraBefore,'camera can pan within bounded world');
}
{
 const queue=[]; const {sandbox,scene}=fixture({requestAnimationFrame(cb){queue.push(cb);return queue.length;},cancelAnimationFrame(){},navigator:{}}); vm.runInContext(fs.readFileSync(path.join(jsDir,'MAREJIG_input.js'),'utf8'),sandbox,{filename:'MAREJIG_input.js'});
 const handlers={}; const canvas={style:{},getBoundingClientRect(){return {left:0,top:0};},addEventListener(name,fn){handlers[name]=fn;},removeEventListener(){},setPointerCapture(){}}; const renderer={markDirty(){}}; sandbox.MAREJIG_Input.attach(canvas,scene,renderer,{});
 handlers.pointerdown({pointerId:1,clientX:1,clientY:1,preventDefault(){}}); assert.equal(sandbox.MAREJIG_Input.state.mode,'panning','pointerdown on empty background starts pan'); sandbox.MAREJIG_Input.cancelInteraction();
 const group=Object.values(scene.groups).find(g=>g.visible); const screen=sandbox.MAREJIG_Scene.worldToScreen(scene,{x:group.bounds.x+2,y:group.bounds.y+2}); handlers.pointerdown({pointerId:2,clientX:screen.x,clientY:screen.y,preventDefault(){}}); assert.equal(sandbox.MAREJIG_Input.state.mode,'dragging','pointerdown on visible piece starts group drag');
}
{
 const sandbox=load(['MAREJIG_shapes.js']); const outline=sandbox.MAREJIG_Shapes.buildCellsOutline([{x:0,y:0},{x:1,y:0}]); assert.equal(outline.segments.length,6,'merged outline omits shared edge');
 const {scene}=fixture(); assert.equal(Object.keys(scene.puzzle.pieces).length>=22,true,'fixture has segmented pieces');
 const hardSandbox=load(files); const hard={id:'hard_fixture',title:'Hard',pack:'Unit',difficulty:'hard',rewardCoins:80,board:{cols:16,rows:12},targetPieceCount:60,segmentPlan:[8,8,8,8,8,10,10]}; const puzzle=hardSandbox.MAREJIG_Generator.generate(hard); assert.equal(Object.keys(puzzle.pieces).length,60,'hard keeps 60 pieces'); assert(Math.max(...puzzle.segments.order.map(id=>puzzle.segments.items[id].pieceIds.length))<=10,'hard reveals no more than 10 pieces per segment');
}
console.log('phase9 sandbox unit tests ok');
