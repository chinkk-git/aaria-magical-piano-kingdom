'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

module.exports=async function runMagicStarAcceptance({browser,server,out}){
 const keys=['measure','loop','jump','practice','songSettings','centerStar'];
 const markers={measure:'#v21Measure',loop:'#v21Timeline',jump:'#v21JumpNow',practice:'#v21PracticePart',songSettings:'#v21SongName'};
 const spots={
  measure:{center:[1000,220],leftBoundary:[844,210],rightBoundary:[1080,220],outerRim:[1095,82],nearCenter:[912,350]},
  loop:{center:[710,290],leftBoundary:[635,280],rightBoundary:[835,355],outerRim:[625,305],nearCenter:[886,420]},
  jump:{center:[680,500],leftBoundary:[558,480],rightBoundary:[840,510],outerRim:[535,500],nearCenter:[864,510]},
  practice:{center:[700,720],leftBoundary:[590,700],rightBoundary:[850,625],outerRim:[600,770],nearCenter:[908,635]},
  songSettings:{center:[990,820],leftBoundary:[820,800],rightBoundary:[1090,800],outerRim:[1090,925],nearCenter:[906,650]}
 };
 const viewports=[
  {width:390,height:844,name:'android-portrait',side:'right'},
  {width:844,height:390,name:'android-landscape',side:'right'},
  {width:834,height:1194,name:'ipad-portrait',side:'left'},
  {width:1194,height:834,name:'ipad-landscape',side:'right'},
  {width:1440,height:900,name:'desktop',side:'right'}
 ];
 const shots=[],summary=[];
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
 async function open(page){if(await page.locator('.v21-star').getAttribute('aria-expanded')==='true')return;await page.locator('.v21-star').click();await page.waitForFunction(()=>{const w=document.querySelector('#v21Wheel');return w&&!w.hidden&&w.dataset.state==='open'})}
 async function segmentResult(page,key){
  await page.waitForFunction(()=>{const p=document.querySelector('.v21-practice-panel');return p&&!p.hidden});
  assert.ok(await page.locator(markers[key]).count(),key+' opened its existing handler');
  assert.deepEqual(await page.evaluate(()=>window.__magicStarCalls),[key],'exactly one existing handler fired for '+key);
  await page.locator('#v21WheelClose').click();await page.waitForFunction(()=>document.querySelector('#v21Wheel').hidden);await open(page);
 }
 async function tap(page,key,point,keyboard=false){
  await open(page);
  const xy=await page.locator('.v21-star-hit-overlay').evaluate((svg,arg)=>{const el=svg.querySelector('[data-key="'+arg.key+'"]'),p=svg.createSVGPoint();p.x=arg.point[0];p.y=arg.point[1];if(!el||!el.isPointInFill(p))return{inside:false};const q=p.matrixTransform(svg.getScreenCTM()),top=document.elementFromPoint(q.x,q.y);return{inside:true,x:q.x,y:q.y,topKey:top?.getAttribute('data-key')||top?.closest('[data-key]')?.getAttribute('data-key')||null}}, {key,point});
  assert.equal(xy.inside,true,key+' path contains its '+JSON.stringify(point)+' PNG coordinate');assert.equal(xy.topKey,key,'the SVG path is the unique top hit target');
  await page.evaluate(()=>{window.__magicStarCalls=[]});
  if(keyboard){await page.locator('.v21-wheel-hit[data-key="'+key+'"]').focus();await page.keyboard.press('Enter')}
  else await page.mouse.click(xy.x,xy.y);
  if(key==='centerStar'){
   await page.waitForFunction(()=>document.querySelector('.v21-star')?.getAttribute('aria-expanded')==='false'&&document.querySelector('#v21Wheel').hidden);
   assert.deepEqual(await page.evaluate(()=>window.__magicStarCalls),[],'center path only toggles the menu');await open(page);
  }else await segmentResult(page,key);
 }
 for(let vi=0;vi<viewports.length;vi++){
  const v=viewports[vi],{context,page}=await launchPage(v);
  const geometry=await page.evaluate(()=>{const im=document.querySelector('.v21-wheel-art'),svg=document.querySelector('.v21-star-hit-overlay'),a=im.getBoundingClientRect(),b=svg.getBoundingClientRect();return{src:im.getAttribute('src'),width:im.naturalWidth,height:im.naturalHeight,viewBox:svg.getAttribute('viewBox'),sameRect:['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.01),side:document.querySelector('.v21-star-assembly').dataset.side}});
  assert.ok(geometry.src.endsWith('/assets/v2.1-ui/magic-star-3d-jewel-wheel.png'));assert.equal(geometry.width,1536);assert.equal(geometry.height,1024);assert.equal(geometry.viewBox,'0 0 1536 1024');assert.equal(geometry.sameRect,true,'image and overlay share responsive bounds');assert.equal(geometry.side,v.side);
  if(vi===0)await screenshot(page,'magic-star-390x844-collapsed');await open(page);if(vi===0)await screenshot(page,'magic-star-390x844-expanded');
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
 const aligned=await resized.page.evaluate(()=>{const a=document.querySelector('.v21-wheel-art').getBoundingClientRect(),b=document.querySelector('.v21-star-hit-overlay').getBoundingClientRect();return['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.01)});assert.equal(aligned,true,'layers remain aligned after live resize');await tap(resized.page,'jump',spots.jump.center);summary.push({viewport:'live-resize',key:'jump',point:'center after resize',triggered:'jump',result:'PASS'});await resized.context.close();
 const videoContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'no-preference',serviceWorkers:'block',recordVideo:{dir:path.join(out,'recordings'),size:{width:390,height:844}}});
 const videoPage=await videoContext.newPage();await videoPage.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));await videoPage.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'domcontentloaded'});await videoPage.waitForFunction(()=>window.AariaV21Engine&&document.querySelector('.v21-star-hit-overlay'));await videoPage.evaluate(()=>{const g=document.querySelector('#release2InstallGate'),a=document.querySelector('#pianoApp');if(g)g.hidden=true;if(a){a.inert=false;a.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
 await open(videoPage);await videoPage.waitForTimeout(450);for(const key of ['measure','loop','jump','practice','songSettings']){await tap(videoPage,key,spots[key].center);await videoPage.waitForTimeout(120)}await tap(videoPage,'centerStar',[1036,510]);await videoPage.waitForTimeout(350);const tmp=await videoPage.video().path();await videoPage.close();await videoContext.close();const recording=path.join(out,'recordings','magic-star-six-region-interaction.webm');fs.copyFileSync(tmp,recording);
 const report={artwork:{path:'assets/v2.1-ui/magic-star-3d-jewel-wheel.png',sha256:'0804202d1082bc1cc732f70c8a8f28ae891be53db4b90dd75e7662a22172eede',dimensions:'1536x1024 RGBA'},checks:summary,viewports:viewports.map(v=>({width:v.width,height:v.height,name:v.name,side:v.side,emulated:true})),liveResize:'PASS — shared PNG/SVG bounds and Jump handler after 390x844 to 844x390 resize',screenshots:['screenshots/magic-star-390x844-collapsed.png','screenshots/magic-star-390x844-expanded.png'],recording:'recordings/magic-star-six-region-interaction.webm',physicalDevicesTested:false};
 fs.writeFileSync(path.join(out,'MAGIC_STAR_HIT_MAP.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'MAGIC_STAR_HIT_MAP.md'),'# Pixel-aligned Magic Star acceptance\n\n- Source PNG: 1536×1024 RGBA; SHA-256 `0804202d1082bc1cc732f70c8a8f28ae891be53db4b90dd75e7662a22172eede`.\n- PNG and SVG overlay share the original 1536×1024 viewBox, responsive bounds, and parent transform.\n- Five independent segment paths reuse the existing five action handlers; the central-star path reuses the existing expand/collapse logic.\n- At Android portrait, every segment was tapped at its visual center, both divider sides, outer rim, hub edge and by keyboard. Each tap invoked exactly one intended handler; the center path only expanded/collapsed.\n- Android landscape, iPad portrait/landscape, desktop, both star sides, and live portrait-to-landscape resize passed center routing and image/overlay alignment. All are Chromium emulation, not physical-device tests.\n- Expanded/collapsed screenshots and the six-region interaction recording are included.\n\n| Viewport | Region | Point | Trigger | Result |\n|---|---|---|---|---|\n'+summary.map(x=>'| '+x.viewport+' | '+x.key+' | '+x.point+' | '+x.triggered+' | '+x.result+' |').join('\n')+'\n');
 return {summary,shots,recording};
};
