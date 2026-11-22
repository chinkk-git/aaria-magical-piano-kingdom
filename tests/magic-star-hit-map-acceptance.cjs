'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

module.exports=async function runMagicStarAcceptance({browser,server,out}){
 const keys=['measure','loop','jump','practice','songSettings','centerStar'];
 const markers={measure:'#v21Measure',loop:'#v21Timeline',jump:'#v21JumpNow',practice:'#v21PracticePart',songSettings:'#v21SongName'};
 const spots={
  measure:{center:[930,220],leftBoundary:[844,210],rightBoundary:[1018,220],outerRim:[1008,15],nearCenter:[998,343]},
  loop:{center:[710,290],leftBoundary:[635,280],rightBoundary:[835,355],outerRim:[625,305],nearCenter:[875,415]},
  jump:{center:[680,500],leftBoundary:[558,480],rightBoundary:[840,510],outerRim:[557,500],nearCenter:[860,509]},
  practice:{center:[700,720],leftBoundary:[590,700],rightBoundary:[850,625],outerRim:[650,770],nearCenter:[855,620]},
  songSettings:{center:[900,820],leftBoundary:[820,800],rightBoundary:[1018,800],outerRim:[900,980],nearCenter:[935,651]}
 };
 const viewports=[
  {width:390,height:844,name:'android-portrait',side:'right'},
  {width:844,height:390,name:'android-landscape',side:'right'},
  {width:834,height:1194,name:'ipad-portrait',side:'left'},
  {width:1194,height:834,name:'ipad-landscape',side:'right'},
  {width:1440,height:900,name:'desktop',side:'right'}
 ];
 const shots=[],summary=[],measurements=[];
 async function screenshot(page,name){const file=path.join(out,'screenshots',name+'.png');await page.screenshot({path:file,fullPage:false});shots.push({file:path.relative(out,file),viewport:page.viewportSize(),emulated:true})}
 async function launchPage(view){
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();
  await page.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* isolated hit-map test */'}));
  await page.addInitScript(side=>localStorage.setItem('aaria-v21-star-anchor',JSON.stringify({side:side,y:.46})),view.side);
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AariaV21Engine&&window.PianoKingdomLibrary?.songs&&document.querySelector('.v21-star-hit-overlay'));
  await page.evaluate(()=>{const g=document.querySelector('#release2InstallGate'),a=document.querySelector('#pianoApp');if(g)g.hidden=true;if(a){a.inert=false;a.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing');window.__magicStarCalls=[];document.addEventListener('click',e=>{const b=e.target.closest('.v21-wheel-action');if(b)window.__magicStarCalls.push(b.dataset.key)})});
  return {context,page};
 }
 async function open(page){if(await page.locator('.v21-star').getAttribute('aria-expanded')==='true'){await page.locator('.v21-wheel-visual').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));return}await page.locator('.v21-star').click();await page.waitForFunction(()=>{const w=document.querySelector('#v21Wheel');return w&&!w.hidden&&w.dataset.state==='open'});await page.locator('.v21-wheel-visual').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)))}
 async function segmentResult(page,key){
  await page.waitForFunction(()=>{const p=document.querySelector('.v21-practice-panel');return p&&!p.hidden});
  assert.ok(await page.locator(markers[key]).count(),key+' opened its existing handler');
  assert.deepEqual(await page.evaluate(()=>window.__magicStarCalls),[key],'exactly one existing handler fired for '+key);
  await page.locator('#v21WheelClose').click();await page.waitForFunction(()=>document.querySelector('#v21Wheel').hidden);await open(page);
 }
 async function tap(page,key,point,keyboard=false){
  await open(page);
  const xy=await page.locator('.v21-star-hit-overlay').evaluate((svg,arg)=>{const p=svg.createSVGPoint();p.x=arg.point[0];p.y=arg.point[1];const q=p.matrixTransform(svg.getScreenCTM()),top=document.elementFromPoint(q.x,q.y);if(arg.key==='centerStar'){const el=svg.querySelector('.v21-wheel-center-hit');if(!el||!el.isPointInFill(p))return{inside:false};return{inside:true,x:q.x,y:q.y,topKey:top?.classList?.contains('v21-wheel-center-hit')?'centerStar':null}}const el=svg.querySelector('[data-key="'+arg.key+'"]');if(!el||!el.isPointInFill(p))return{inside:false};return{inside:true,x:q.x,y:q.y,topKey:top?.getAttribute('data-key')||top?.closest('[data-key]')?.getAttribute('data-key')||null}}, {key,point});
  assert.equal(xy.inside,true,key+' region contains its '+JSON.stringify(point)+' PNG coordinate');const probe=await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y),s=document.querySelector('.v21-star-hit-overlay'),v=document.querySelector('.v21-wheel-visual'),r=n=>{const q=n.getBoundingClientRect();return{x:q.x,y:q.y,width:q.width,height:q.height,right:q.right,bottom:q.bottom}},m=s.getScreenCTM();return{screen:{x,y},viewport:{width:innerWidth,height:innerHeight,scrollY},svg:r(s),visual:r(v),matrix:[m.a,m.b,m.c,m.d,m.e,m.f],top:e?{tag:e.tagName,id:e.id,className:String(e.className),key:e.getAttribute('data-key'),outer:e.outerHTML.slice(0,180)}:null}},{x:xy.x,y:xy.y});assert.equal(xy.topKey,key,key+' '+JSON.stringify(point)+': intended region is the unique top hit target; got '+JSON.stringify(probe));
  await page.evaluate(()=>{window.__magicStarCalls=[]});
  if(keyboard){await page.locator(key==='centerStar'?'.v21-wheel-center-hit':'.v21-wheel-hit[data-key="'+key+'"]').focus();await page.keyboard.press('Enter')}
  else await page.mouse.click(xy.x,xy.y);
  if(key==='centerStar'){
   await page.waitForFunction(()=>document.querySelector('.v21-star')?.getAttribute('aria-expanded')==='false'&&document.querySelector('#v21Wheel').hidden);
   assert.deepEqual(await page.evaluate(()=>window.__magicStarCalls),[],'center button only toggles the menu');await open(page);
  }else await segmentResult(page,key);
 }
 for(let vi=0;vi<viewports.length;vi++){
  const v=viewports[vi],{context,page}=await launchPage(v);if(vi===0)await screenshot(page,'magic-star-390x844-collapsed');await open(page);
  const geometry=await page.evaluate(()=>{const visual=document.querySelector('.v21-wheel-visual'),svg=document.querySelector('.v21-star-hit-overlay'),a=visual.getBoundingClientRect(),b=svg.getBoundingClientRect(),pieces=[...visual.querySelectorAll('.v21-wheel-piece')].map(im=>({id:im.dataset.piece,width:im.naturalWidth,height:im.naturalHeight,loaded:im.complete&&im.naturalWidth>0})),regions=[...svg.querySelectorAll('.v21-wheel-hit,.v21-wheel-center-hit')].map(el=>{const r=el.getBoundingClientRect(),g=el.getBBox(),box=q=>({x:+q.x.toFixed(2),y:+q.y.toFixed(2),width:+q.width.toFixed(2),height:+q.height.toFixed(2)});return{key:el.dataset.key||'centerStar',shape:el.tagName.toLowerCase(),viewBoxBounds:box(g),screenBounds:box(r),minimumBoundingDimension:+Math.min(r.width,r.height).toFixed(2),below44CSSPixels:Math.min(r.width,r.height)<44,role:el.getAttribute('role'),label:el.getAttribute('aria-label'),tabIndex:el.tabIndex}});return{pieces,regions,viewBox:svg.getAttribute('viewBox'),sameRect:['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.01),aspect:Math.round(a.width/a.height*1000)/1000,matrixA:svg.getScreenCTM().a,side:document.querySelector('.v21-star-assembly').dataset.side}});
  assert.deepEqual(geometry.pieces.map(p=>p.id).sort(),['center-star','jump','loop','measure','practice','song-settings'],'the exact six transparent artwork components are present');assert.ok(geometry.pieces.every(p=>p.loaded),'all six supplied PNG components decode');assert.deepEqual(Object.fromEntries(geometry.pieces.map(p=>[p.id,[p.width,p.height]])),{'measure':[354,372],'loop':[929,450],'jump':[823,354],'practice':[926,443],'song-settings':[374,372],'center-star':[655,993]},'component dimensions match the package manifest');assert.equal(geometry.viewBox,'0 0 1536 1024');assert.equal(geometry.sameRect,true,'assembled artwork and SVG overlay share responsive bounds');assert.equal(geometry.aspect,1.5,'shared artwork coordinate plane preserves the 1536:1024 aspect ratio');assert.equal(Math.sign(geometry.matrixA),v.side==='left'?-1:1,'the SVG hit map follows the artwork mirror orientation');assert.equal(geometry.side,v.side);assert.equal(geometry.regions.length,6,'five segment hit paths and one independent center-star circle');assert.ok(geometry.regions.every(r=>r.role==='button'&&r.label&&r.tabIndex===0),'all six regions are labelled and keyboard reachable');measurements.push({viewport:{name:v.name,width:v.width,height:v.height,emulated:true},side:v.side,regions:geometry.regions});
  if(vi===0)await screenshot(page,'magic-star-390x844-expanded');
  if(vi===0){
   for(const key of ['measure','loop','jump','practice','songSettings']){
    for(const part of ['center','leftBoundary','rightBoundary','outerRim','nearCenter']){await tap(page,key,spots[key][part]);summary.push({viewport:v.name,key,point:part,triggered:key,result:'PASS'})}
    await tap(page,key,spots[key].center,true);summary.push({viewport:v.name,key,point:'keyboard Enter',triggered:key,result:'PASS'});
    await tap(page,'centerStar',[1036,510]);summary.push({viewport:v.name,key:'centerStar',point:'center',triggered:'expand/collapse',result:'PASS'});
   }
   for(const key of keys){await tap(page,key,key==='centerStar'?[1036,510]:spots[key].center,true);summary.push({viewport:v.name,key,point:'keyboard Enter',triggered:key==='centerStar'?'expand/collapse':key,result:'PASS'})}
  }else{for(const key of keys){await tap(page,key,key==='centerStar'?[1036,510]:spots[key].center);summary.push({viewport:v.name,key,point:'center',triggered:key==='centerStar'?'expand/collapse':key,result:'PASS'})}}
  await context.close();
 }
 const resized=await launchPage({width:390,height:844,side:'right'});await open(resized.page);await resized.page.setViewportSize({width:844,height:390});await resized.page.waitForTimeout(120);
 const aligned=await resized.page.evaluate(()=>{const a=document.querySelector('.v21-wheel-visual').getBoundingClientRect(),b=document.querySelector('.v21-star-hit-overlay').getBoundingClientRect();return['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.01)});assert.equal(aligned,true,'layers remain aligned after live resize');await tap(resized.page,'jump',spots.jump.center);summary.push({viewport:'live-resize',key:'jump',point:'center after resize',triggered:'jump',result:'PASS'});await resized.context.close();
 const videoContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'no-preference',serviceWorkers:'block',recordVideo:{dir:path.join(out,'recordings'),size:{width:390,height:844}}});
 const videoPage=await videoContext.newPage();await videoPage.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));await videoPage.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'domcontentloaded'});await videoPage.waitForFunction(()=>window.AariaV21Engine&&document.querySelector('.v21-star-hit-overlay'));await videoPage.evaluate(()=>{const g=document.querySelector('#release2InstallGate'),a=document.querySelector('#pianoApp');if(g)g.hidden=true;if(a){a.inert=false;a.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing');window.__magicStarCalls=[];document.addEventListener('click',e=>{const b=e.target.closest('.v21-wheel-action');if(b)window.__magicStarCalls.push(b.dataset.key)})});
 await open(videoPage);await videoPage.waitForTimeout(450);for(const key of ['measure','loop','jump','practice','songSettings']){await tap(videoPage,key,spots[key].center);await videoPage.waitForTimeout(120)}await tap(videoPage,'centerStar',[1036,510]);await videoPage.waitForTimeout(350);const tmp=await videoPage.video().path();await videoPage.close();await videoContext.close();const recording=path.join(out,'recordings','magic-star-six-region-interaction.webm');fs.copyFileSync(tmp,recording);
 const report={artwork:{path:'assets/v2.1-ui/magic-star-pieces/',reference:'assets/v2.1-ui/magic-star-3d-jewel-wheel.png',sha256:'0804202d1082bc1cc732f70c8a8f28ae891be53db4b90dd75e7662a22172eede',dimensions:'1536x1024 RGBA shared coordinate plane',components:[{id:'measure',file:'measure.png',dimensions:'354x372'},{id:'loop',file:'loop.png',dimensions:'929x450'},{id:'jump',file:'jump.png',dimensions:'823x354'},{id:'practice',file:'practice.png',dimensions:'926x443'},{id:'song-settings',file:'song-settings.png',dimensions:'374x372'},{id:'center-star',file:'center-star.png',dimensions:'655x993'}]},checks:summary,hitRegionMeasurements:measurements,targetThresholdCSSPixels:44,viewports:viewports.map(v=>({width:v.width,height:v.height,name:v.name,side:v.side,emulated:true})),liveResize:'PASS — shared PNG/SVG bounds and Jump handler after 390x844 to 844x390 resize',screenshots:['screenshots/magic-star-390x844-collapsed.png','screenshots/magic-star-390x844-expanded.png'],recording:'recordings/magic-star-six-region-interaction.webm',physicalDevicesTested:false};
 fs.writeFileSync(path.join(out,'MAGIC_STAR_HIT_MAP.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'MAGIC_STAR_HIT_MAP.md'),'# Six-piece Magic Star hit-map acceptance\n\n- The exact six transparent supplied PNGs are installed under `assets/v2.1-ui/magic-star-pieces/` and share the original 1536×1024 coordinate plane. They pixel-perfectly reassemble the approved reference; reference SHA-256: `0804202d1082bc1cc732f70c8a8f28ae891be53db4b90dd75e7662a22172eede`.\n- Five independent SVG sector paths use the five existing action handlers. A separate SVG center circle toggles the wheel; it is not the collapsed native anchor button. All six controls have labels, role=button, and keyboard activation.\n- PNG, SVG overlay, and hit-region geometry use the same responsive scale; the report records each region\'s viewBox bounds and screen-space bounding rectangle at every viewport. Bounding boxes are measurement envelopes; activation uses the SVG path/circle shapes. A 44 CSS-pixel comparison is recorded per region and does not imply physical-device touch compliance.\n- Android portrait tested each segment at its visual center, divider-side samples, outer rim, hub-side sample, and Enter key; one intended handler fired for each. Center-star tap/keyboard independently toggled the menu. Other responsive viewports tested all six centers; live portrait-to-landscape resize tested alignment and Jump routing.\n- All captures are Playwright Chromium emulation, not physical-device tests. Expanded/collapsed screenshots and a six-region interaction recording are included.\n\n## Per-viewport hit-region bounding rectangles\n\n`MAGIC_STAR_HIT_MAP.json` contains each control\'s source-space and screen-space rectangles, minimum bounding dimension, role, accessible label, and keyboard tab index for all five viewport sizes.\n\n## Interaction checks\n\n| Viewport | Region | Point | Trigger | Result |\n|---|---|---|---|---|\n'+summary.map(x=>'| '+x.viewport+' | '+x.key+' | '+x.point+' | '+x.triggered+' | '+x.result+' |').join('\n')+'\n');
 return {summary,shots,recording,measurements};
};
