'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(process.cwd(),'magic-star-phase1-evidence');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('not found: '+pathname);return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)});});
const viewports=[
 {name:'motorola-edge-50-fusion-portrait-emulated',width:412,height:915,mobile:true},
 {name:'motorola-edge-50-fusion-landscape-emulated',width:915,height:412,mobile:true},
 {name:'iphone-portrait-emulated',width:390,height:844,mobile:true},
 {name:'iphone-landscape-emulated',width:844,height:390,mobile:true},
 {name:'ipad-portrait-834x1194-emulated',width:834,height:1194,mobile:true},
 {name:'ipad-landscape-1194x834-emulated',width:1194,height:834,mobile:true},
 {name:'desktop-1440x900',width:1440,height:900,mobile:false}
],groups={music:['measure','loop','jump','practice','makeMusic'],navigation:['songs','home','pianoMode','settings','updateApp']},
titles={measure:'Measure',loop:'Loop',jump:'Jump',practice:'Practice',makeMusic:'Make Music',songs:'My Songs',home:'Home',pianoMode:'Piano Mode',settings:'Settings',updateApp:'Update App'};
const shots=[];let browser;
function overlap(a,b){return Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const origin='http://127.0.0.1:'+server.address().port;
 for(let i=0;i<viewports.length;i++){
  const vp=viewports[i],record=i===0||i===1,videoDir=path.join(out,'video-temp');fs.mkdirSync(videoDir,{recursive:true});
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1,isMobile:vp.mobile,hasTouch:vp.mobile,reducedMotion:'no-preference',serviceWorkers:'block',...(record?{recordVideo:{dir:videoDir,size:{width:vp.width,height:vp.height}}}:{})});
  await context.addInitScript(side=>{localStorage.setItem('aaria-piano-custom-songs-v1',JSON.stringify([{id:'phase1-fixture',title:'Owner review fixture',events:[{bar:1,at:0,dur:2,midi:60}],total:1,barLengths:[8],bpm:80,imported:true}]));localStorage.setItem('aaria-v21-star-anchor',JSON.stringify({side,y:.32}))},i%2?'right':'left');
  const page=await context.newPage(),errors=[],failedAssets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>{if(/v2\.1-magic-wheel/.test(r.url()))failedAssets.push(r.url())});
  page.on('response',r=>{if(/v2\.1-magic-wheel/.test(r.url())&&r.status()>=400)failedAssets.push(r.url()+' ['+r.status()+']')});
  await page.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* Magic Star visual acceptance fixture */'}));
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.v21-dock',{timeout:15000});await page.waitForFunction(()=>window.AariaV21Engine);
  await page.evaluate(()=>{const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');if(gate)gate.hidden=true;if(app){app.inert=false;app.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.v21-dock button').count(),3,'fixed toolbar has only Play/Pause, Sound and Zoom buttons');
  assert.equal(await page.locator('.v21-dock input[type=range]').count(),1,'Speed remains the fourth fixed playback control');
  const star=page.locator('.v21-star'),assembly=page.locator('.v21-star-assembly'),dock=page.locator('.v21-dock'),keys=page.locator('#keys');
  assert.equal(await star.count(),1,'one Magic Star is the assembly hub');
  const keyBox=await keys.boundingBox(),dockBox=await dock.boundingBox();
  assert.ok(keyBox&&keyBox.width>0&&keyBox.height>0,'piano keyboard is visible');
  assert.ok(dockBox&&dockBox.y>=0&&dockBox.y+dockBox.height<=vp.height+1,'fixed toolbar remains in safe viewport');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
  const base=vp.name;
  async function capture(state){const file=path.join(out,base+'__'+state+'.png');await page.screenshot({path:file,fullPage:false});shots.push({file,label:base+' · '+state.replaceAll('-',' '),width:vp.width,height:vp.height})}
  await page.waitForTimeout(420);await capture('01-closed');
  const sourceRoutes=fs.readFileSync(path.join(root,'v2.1-ui.js'),'utf8');
  for(const route of [/\['measure','loop','jump','practice'\]\.includes\(key\)/,/key==='makeMusic'[\s\S]*?openNewSong/,/key==='songs'[\s\S]*?openSongs/,/key==='home'/,/key==='pianoMode'/,/key==='settings'/,/key==='updateApp'[\s\S]*?checkAppUpdate/])assert.match(sourceRoutes,route,'preserved action route '+route);
  for(const [key,label] of Object.entries(titles)){assert.match(sourceRoutes,new RegExp(key),'existing action route remains in source: '+key);assert.equal(await page.locator('.v21-wheel-action[data-key="'+key+'"]').getAttribute('aria-label'),label,'action label remains mapped: '+key)}
  const before=await star.boundingBox();assert.ok(before,'floating star has visible geometry');
  async function checkGroup(expected){
   const visible=page.locator('.v21-wheel-actions:not([hidden]) .v21-wheel-action');
   const actual=await visible.evaluateAll(bs=>bs.map(b=>b.dataset.key));
   assert.deepEqual(actual,groups[expected],expected+' group exposes exactly its five mapped actions');
   const state=await page.evaluate(()=>window.AariaV21UI.getState());assert.equal(state.group,expected,'group state matches visible group');
   const center=await star.boundingBox(),assemblyRect=await assembly.boundingBox();assert.ok(center&&assemblyRect,'star and assembly are visible');
   assert.ok(Math.abs(center.x+center.width/2-assemblyRect.x)<1.5&&Math.abs(center.y+center.height/2-assemblyRect.y)<1.5,'Magic Star is the exact shared wheel pivot');
   assert.equal(await page.locator('.v21-wheel-action:visible').count(),5,'five interactive buttons in visible group');
   const shape=await page.evaluate(()=>{const a=document.querySelector('.v21-star-assembly'),img=document.querySelector('.v21-wheel-art'),s=document.querySelector('.v21-star').getBoundingClientRect(),r=parseFloat(a.style.getPropertyValue('--wheel-radius'));const o=getComputedStyle(img).transformOrigin.split(' ').map(parseFloat);return{center:{x:s.left+s.width/2,y:s.top+s.height/2},radius:r,side:a.dataset.side,origin:o,art:{w:img.clientWidth,h:img.clientHeight}}});
   assert.ok(shape.radius>=80,'wheel retains enough scale for distinct touch targets');assert.ok(Math.abs(shape.origin[0]-shape.art.w*.2)<1&&Math.abs(shape.origin[1]-shape.art.h*.5)<1,'shell transform origin equals the supplied star pivot');
   const left=shape.side==='left'?shape.center.x:shape.center.x-shape.radius,right=shape.side==='left'?shape.center.x+shape.radius:shape.center.x;
   assert.ok(left>=-1&&right<=vp.width+1,'180° artwork remains horizontally in bounds');
   assert.ok(shape.center.y-shape.radius>=-1&&shape.center.y+shape.radius<=dockBox.y+1,'wheel stays clear of fixed toolbar');
   assert.ok(shape.center.y+shape.radius<=keyBox.y+1,'wheel stays above piano keys');
   const targets=await visible.evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{key:b.dataset.key,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}));
   for(const t of targets){assert.ok(t.x>=0&&t.y>=0&&t.right<=vp.width+1&&t.bottom<=vp.height+1,'action is not clipped: '+t.key);assert.ok(t.width>=44&&t.height>=44,'action has 44px minimum target: '+t.key)}
   for(let a=0;a<targets.length;a++)for(let b=a+1;b<targets.length;b++){const dx=targets[a].x+targets[a].width/2-(targets[b].x+targets[b].width/2),dy=targets[a].y+targets[a].height/2-(targets[b].y+targets[b].height/2);assert.ok(Math.hypot(dx,dy)>=44,'circular touch targets do not intersect: '+targets[a].key+' / '+targets[b].key)}
   const labels=await page.locator('.v21-wheel-actions:not([hidden]) .v21-action-label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{key:e.dataset.key,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,text:e.textContent.trim(),opacity:getComputedStyle(e).opacity}}));
   for(const l of labels){assert.equal(l.text,titles[l.key],'label stays complete');assert.ok(l.x>=0&&l.y>=0&&l.right<=vp.width+1&&l.bottom<=vp.height+1,'label is within screen: '+l.key);assert.ok(Number(l.opacity)>.8,'label visible after transition: '+l.key)}
   for(let a=0;a<labels.length;a++)for(let b=a+1;b<labels.length;b++)assert.ok(!overlap(labels[a],labels[b]),'labels do not collide: '+labels[a].key+' / '+labels[b].key);
   assert.ok(await page.locator('.v21-wheel-art').evaluate(e=>e.complete&&e.naturalWidth===600),'five-action adapted source-geometry wheel SVG loaded');
   const images=await page.locator('.v21-star-art,.v21-action-art,.v21-adapted-base').evaluateAll(es=>es.map(e=>({src:e.getAttribute('src'),ok:e.complete&&e.naturalWidth>0})));
   assert.ok(images.length>=7&&images.every(i=>i.ok),'original and adapted star/action art loaded');
   if(failedAssets.length)throw Error('Wheel asset failures: '+failedAssets.join(' | '));
   return{center:shape.center,radius:shape.radius,side:shape.side};
  }
  const video=record?page.video():null;
  if(i===0){
   await star.click();await page.waitForTimeout(25);await capture('open-frame-025ms');await page.waitForTimeout(70);await capture('open-frame-095ms');await page.waitForTimeout(100);await capture('open-frame-195ms');await page.waitForTimeout(130);await capture('open-frame-325ms');await page.waitForTimeout(120);
  }else{await star.click();await page.waitForTimeout(430)}
  await checkGroup('music');await capture('02-music-expanded');
  const musicCenter=await star.boundingBox();
  const selectedMusic=page.locator('.v21-wheel-actions:not([hidden]) .v21-wheel-action[data-key="measure"]');
  await selectedMusic.hover();await page.mouse.down();await page.waitForTimeout(25);assert.match(await selectedMusic.evaluate(e=>getComputedStyle(e).filter),/brightness\(1\.3\)/,'Music action has a visible pressed state');await capture('04-music-action-pressed');await page.mouse.move(vp.width-2,vp.height-2);await page.mouse.up();
  await star.click();await page.waitForTimeout(210);await checkGroup('navigation');await capture('03-navigation-expanded');
  const selectedNav=page.locator('.v21-wheel-actions:not([hidden]) .v21-wheel-action[data-key="updateApp"]');
  await selectedNav.hover();await page.mouse.down();await page.waitForTimeout(25);assert.match(await selectedNav.evaluate(e=>getComputedStyle(e).filter),/brightness\(1\.3\)/,'Navigation action has a visible pressed state');await capture('05-navigation-action-pressed');await page.mouse.move(vp.width-2,vp.height-2);await page.mouse.up();
  await star.click();await page.waitForTimeout(210);await checkGroup('music');
  const musicAfter=await star.boundingBox();assert.ok(Math.abs(musicCenter.x-musicAfter.x)<1&&Math.abs(musicCenter.y-musicAfter.y)<1,'group switching leaves star fixed');
  if(i===0){
   await page.keyboard.press('Escape');await page.waitForTimeout(30);await capture('close-frame-030ms');await page.waitForTimeout(80);await capture('close-frame-110ms');await page.waitForTimeout(100);await capture('close-frame-210ms');await page.waitForTimeout(180);await capture('close-frame-390ms');
   assert.equal(await page.locator('.v21-wheel').isVisible(),false,'Escape closes wheel into same star');
  }else{await page.keyboard.press('Escape');await page.waitForTimeout(420);assert.equal(await page.locator('.v21-wheel').isVisible(),false,'wheel closes after group switching')}
  assert.equal(await page.locator('.v21-practice-panel').isVisible(),false,'wheel-only test leaves secondary panels untouched');
  if(errors.length)throw Error('Runtime errors: '+errors.join(' | '));if(failedAssets.length)throw Error('Wheel asset errors: '+failedAssets.join(' | '));
  if(record){await context.close();const videoPath=await video.path();fs.renameSync(videoPath,path.join(out,i===0?'magic-star-open-close-group-switching-portrait.webm':'magic-star-open-close-group-switching-landscape.webm'))}else await context.close();
  console.log('PASS '+vp.name+' '+vp.width+'x'+vp.height+' — wheel geometry, actions, collisions, labels, safe viewport, gameplay and fixed controls');
 }
 const reduced=await browser.newPage({viewport:{width:390,height:844}});await reduced.emulateMedia({reducedMotion:'reduce'});
 const reducedErrors=[];reduced.on('pageerror',e=>reducedErrors.push(e.message));await reduced.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* fixture */'}));await reduced.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});await reduced.waitForSelector('.v21-star-assembly');
 await reduced.evaluate(()=>{const g=document.querySelector('#release2InstallGate'),a=document.querySelector('#pianoApp');if(g)g.hidden=true;if(a){a.inert=false;a.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
 const reducedMs=await reduced.locator('.v21-wheel-art').evaluate(e=>parseFloat(getComputedStyle(e).transitionDuration)*1000);assert.ok(reducedMs<=1.1,'reduced motion limits wheel transition to 1ms');
 await reduced.locator('.v21-star').click();await reduced.waitForTimeout(15);assert.equal(await reduced.locator('.v21-wheel-actions:not([hidden]) .v21-wheel-action').count(),5,'reduced-motion wheel remains interactive');await reduced.keyboard.press('Escape');await reduced.waitForTimeout(10);assert.equal(reducedErrors.length,0,'reduced-motion path has no runtime error');await reduced.close();
 for(const [src,name] of [[path.join(root,'tests/visual-fixtures/original-art-direction.jpg'),'original-art-direction-reference.jpg'],[path.join(root,'tests/visual-fixtures/rejected-portrait.jpg'),'owner-rejected-portrait.jpg'],[path.join(root,'tests/visual-fixtures/rejected-landscape.jpg'),'owner-rejected-landscape.jpg']])fs.copyFileSync(src,path.join(out,name));
 const compare=path.join(out,'original-rejected-corrected-comparison.html');
 const compareHtml='<!doctype html><meta charset="utf-8"><title>Original · rejected · corrected</title><style>body{margin:0;padding:18px;background:#130c25;color:white;font:700 18px system-ui}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{padding:10px;background:#251541;border:1px solid #f2d47c;border-radius:12px}.card h2{font-size:15px}.card img{width:100%;height:560px;object-fit:contain;background:#0c0716}.card small{display:block;color:#ffe7a5;margin-top:8px}</style><h1>Magic Star Phase 1 — visual comparison · viewport-emulated running app</h1><section class="grid"><article class="card"><h2>Original supplied dimensional reference</h2><img src="'+pathToFileURL(path.join(root,'tests/visual-fixtures/original-art-direction.jpg')).href+'"><small>Owner-provided art reference; not claimed as a runtime asset.</small></article><article class="card"><h2>Rejected implementation · owner screenshot</h2><img src="'+pathToFileURL(path.join(root,'tests/visual-fixtures/rejected-portrait.jpg')).href+'"><small>Owner-provided rejected portrait capture.</small></article><article class="card"><h2>Corrected implementation · actual running app</h2><img src="'+pathToFileURL(shots.find(s=>s.label.startsWith('motorola-edge-50-fusion-portrait-emulated · 02 music expanded')).file).href+'"><small>Exact tested commit; real app in Chromium emulation.</small></article></section>';
 fs.writeFileSync(compare,compareHtml);const comparePage=await browser.newPage({viewport:{width:1800,height:720}});await comparePage.goto(pathToFileURL(compare).href);await comparePage.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));await comparePage.screenshot({path:path.join(out,'original-rejected-corrected-comparison.png'),fullPage:true});await comparePage.close();
 const contact=path.join(out,'contact-sheet.html');
 const html='<!doctype html><meta charset="utf-8"><title>Magic Star Phase 1 contact sheet</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#120b25;color:#fff;font:700 18px system-ui}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{padding:10px;border:1px solid #e9c46a;border-radius:12px;background:#261548}.card h2{font-size:15px;margin:0 0 8px}.card img{display:block;width:100%;height:240px;object-fit:contain;background:#100b20;border-radius:8px}.card small{display:block;margin-top:6px;color:#ffe8aa}</style><h1>Magic Star — Phase 1 responsive evidence</h1><section class="grid">'+shots.map(s=>'<article class="card"><h2>'+s.label.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</h2><img src="'+pathToFileURL(s.file).href+'"><small>'+s.width+' × '+s.height+' CSS px · Chromium emulated</small></article>').join('')+'</section>';
 fs.writeFileSync(contact,html);const sheet=await browser.newPage({viewport:{width:1800,height:2600}});await sheet.goto(pathToFileURL(contact).href);await sheet.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));await sheet.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});await sheet.close();
 const sha=process.env.APP_SOURCE_SHA||'unknown';
 const manifest={project:'Aaria’s Magical Piano Kingdom',phase:'Phase 1 — Magic Star 3D wheel correction',commit_sha:sha,physical_device_testing:false,viewports:viewports.map(({name,width,height})=>({name,width,height,mode:'Chromium viewport emulation'})),screenshots:shots.map(s=>({file:path.basename(s.file),label:s.label,width:s.width,height:s.height})),recordings:['magic-star-open-close-group-switching-portrait.webm','magic-star-open-close-group-switching-landscape.webm'],animation_frames:['open-frame-025ms','open-frame-095ms','open-frame-195ms','open-frame-325ms','close-frame-030ms','close-frame-110ms','close-frame-210ms','close-frame-390ms'],comparison:'original-rejected-corrected-comparison.png',focused_checks:['One assembly and one supplied star use the same pivot','Five actions in Music and five in Navigation','Group switching preserves star position','44px targets, collisions, labels and safe viewport bounds','Wheel clears keyboard and fixed toolbar','Four playback controls remain intact','Reduced motion uses minimal transition','Assets decode and runtime errors are absent'],known_limitations:['Viewports are Chromium emulations; no physical device tested.','Supplied packages contain SVG/PNG, not native 3D models, and a four-action source wheel only.','Make Music, fifth-segment geometry and Navigation action artwork are provisional adaptations based on supplied materials.','Secondary panels and unrelated Release 2 features were not redesigned or accepted.'],owner_visual_approval:'PENDING'};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(out,'SCREENSHOT_MANIFEST.md'),'# Screenshot manifest\n\nExact commit: `'+sha+'`\n\n'+shots.map(s=>'- `'+path.basename(s.file)+'` — '+s.width+' × '+s.height+' CSS px; Chromium viewport emulation.').join('\n')+'\n\nComparison: `original-rejected-corrected-comparison.png`. Animation frames are included as individual PNGs; see manifest.json.\n');
 for(const [name,pathName] of [['MAGIC_STAR_PHASE1_ASSET_MAPPING.md','MAGIC_STAR_PHASE1_ASSET_MAPPING.md'],['PHASE1_VISUAL_CORRECTIONS.md','PHASE1_VISUAL_CORRECTIONS.md']])fs.copyFileSync(path.join(root,'docs/v2.1',pathName),path.join(out,name));
 fs.writeFileSync(path.join(out,'PHASE1_TEST_RESULTS.md'),['# Phase 1 focused test results','','Exact commit: '+sha,'','- Seven emulated responsive viewports; closed, both groups and pressed-action states.','- Shared anchor, 44px touch targets, target/label overlap, viewport, key and toolbar geometry.','- Interactions: open, close, Music ↔ Navigation; reduced-motion mode.','- Four fixed playback controls remain. Art assets load and the page reports no wheel-related errors.','','Focused Phase 1 only; no owner visual approval, physical-device testing, or Release 2 regression suite.'].join('\n'));
 fs.writeFileSync(path.join(out,'PHASE1_KNOWN_LIMITATIONS.md'),['# Phase 1 known limitations','','- Seven responsive sizes are Chromium emulations, not physical-device tests.','- Packages contain vector/raster artwork but no native 3D model or supplied five-action wheel.','- The fifth Music segment, Make Music icon, Navigation icons and group labels are documented adaptations.','- The adaptation follows the source artwork but is not an exact supplied five-action original.','- Secondary panels and unrelated features remain outside this visual approval iteration.','- Owner visual approval is pending; no merge or deployment occurred.'].join('\n'));
 const zip=path.join(process.cwd(),'AARIA_MAGIC_STAR_PHASE1_CORRECTED_OWNER_REVIEW.zip');execFileSync('zip',['-qr',zip,path.basename(out)],{cwd:process.cwd()});
 console.log('PASS focused wheel tests; viewports='+viewports.length+'; screenshots='+shots.length+'; ZIP='+zip+'; exact_commit='+sha);
 await browser.close();server.close();
})().catch(async e=>{console.error(e.stack||e);try{await browser?.close()}catch{}try{server.close()}catch{}process.exitCode=1});
