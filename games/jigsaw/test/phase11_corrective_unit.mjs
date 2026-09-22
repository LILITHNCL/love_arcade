import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const js=path.join(root,'js');
const files=['MAREJIG_config.js','MAREJIG_levels.js','MAREJIG_shapes.js','MAREJIG_groups.js','MAREJIG_segments.js','MAREJIG_generator.js','MAREJIG_scene.js'];
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function load(list=files,extra={}){const x={console,Date,Math,Set,Map,JSON,Object,Array,Number,String,Boolean,window:null,...extra};x.window=x;vm.createContext(x);list.forEach(f=>vm.runInContext(fs.readFileSync(path.join(js,f),'utf8'),x,{filename:f}));return x;}
function fixture(levelId='nivel_003'){const x=load();const level=x.MAREJIG_LevelCatalog.getById(levelId);const puzzle=x.MAREJIG_Generator.generate(level);const scene=x.MAREJIG_Scene.createScene(level,puzzle,{drawable:null,failed:true});x.MAREJIG_Scene.layoutScene(scene,390,844);return{x,scene};}
function groups(scene){return Object.values(scene.groups).filter(g=>g.visible);}
function ratio(a,b){const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));const h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return w*h/Math.max(1,Math.min(a.width*a.height,b.width*b.height));}
{
 const css=read('css/marejig.css'), html=read('index.html'), main=read('js/MAREJIG_main.js');
 assert.match(css,/\.marejig-html\.marejig-is-playing,[\s\S]*overscroll-behavior:\s*none/); assert.match(css,/\.marejig-is-playing \.marejig-game-layout \{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*height:\s*100dvh/); assert.match(css,/\.marejig-is-playing \.marejig-canvas-wrap \{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*height:\s*100%/); assert.match(css,/\.marejig-is-playing \.marejig-canvas \{[\s\S]*position:\s*absolute;[\s\S]*width:\s*100%;[\s\S]*height:\s*100%/); assert.match(css,/\.marejig-is-playing \[hidden\][\s\S]*display:\s*none !important/); assert.match(css,/bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ 12px\)/); assert.match(css,/\.marejig-is-playing #marejig-screen-game \{[\s\S]*animation:\s*none;[\s\S]*transform:\s*none/); assert.match(main,/documentElement\.classList\.toggle\('marejig-is-playing'/); assert(html.indexOf('../../js/game-bridge.js') < html.indexOf('MAREJIG_economy.js')); assert(html.indexOf('../../js/game-bridge.js') < html.indexOf('MAREJIG_main.js')); assert.doesNotMatch(html, /\.\.\/\.\.\/js\/app\.js/);
}
{
 const {x,scene}=fixture(); assert.equal(JSON.stringify(scene.performance),JSON.stringify({isDragging:false,isPanning:false,isCameraAnimating:false})); assert(scene.board.width>=390*1.35); const s0=x.MAREJIG_Scene.getSegmentBounds(scene,'s_0'); assert(s0.width<scene.viewport.width*1.25); const main=groups(scene)[0]; scene.progress.mainGroupId=main.id; const next=scene.puzzle.segments.order[1]; x.MAREJIG_Segments.revealSegment(scene,next); const cluster=scene.ui.lastClusterBounds; assert(cluster&&cluster.width<scene.viewport.width*1.25); const dist=Math.hypot(cluster.x+cluster.width/2-(main.bounds.x+main.bounds.width/2),cluster.y+cluster.height/2-(main.bounds.y+main.bounds.height/2)); assert(dist<scene.viewport.height*.8); assert(scene.cameraTarget&&scene.cameraTarget.zoom===scene.camera.zoom);
}
{
 const {x,scene}=fixture(); const [a,b]=groups(scene); a.x+=b.bounds.x+b.bounds.width+1-a.bounds.x; a.y+=b.bounds.y-a.bounds.y; x.MAREJIG_Groups.recalculateGroupBounds(scene,a.id); const before={x:a.x,y:a.y}; assert.equal(x.MAREJIG_Scene.resolveGroupOverlap(scene,a.id),false,'edge touch does not move'); assert.deepEqual({x:a.x,y:a.y},before); a.x+=b.bounds.x-a.bounds.x; x.MAREJIG_Groups.recalculateGroupBounds(scene,a.id); const origin={x:a.bounds.x,y:a.bounds.y}; assert(x.MAREJIG_Scene.resolveGroupOverlap(scene,a.id)); assert(Math.hypot(a.bounds.x-origin.x,a.bounds.y-origin.y)<=121); assert(ratio(a.bounds,b.bounds)<.1);
}
{
 const renderer=read('js/MAREJIG_renderer.js'), input=read('js/MAREJIG_input.js'); assert.match(renderer,/Math\.max\(160, Math\.min\(220/); assert.match(renderer,/scene\.camera\.x = start\.x[\s\S]*scene\.camera\.y = start\.y/); assert.doesNotMatch(renderer,/scene\.camera\.zoom = start\.zoom/); assert.match(renderer,/markDirty\('camera-animation'\)/); assert.match(renderer,/cancelCameraAnimation/); assert.match(input,/cancelCameraAnimation\(\)/); assert.match(input,/pendingScreen[\s\S]*requestAnimationFrame\(MAREJIG_applyPendingMove\)/); const moveBody=input.slice(input.indexOf('function MAREJIG_applyPendingMove'),input.indexOf('function MAREJIG_onPointerDown')); assert.doesNotMatch(moveBody,/resolveGroupOverlap|findSnapCandidate|save/);
}
console.log('phase11 corrective unit tests ok');
