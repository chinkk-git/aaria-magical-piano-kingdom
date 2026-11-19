'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const artifactDir=path.join(os.tmpdir(),'r2-note-explosion');fs.mkdirSync(artifactDir,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)})});
const events=[
 {bar:1,at:0,dur:.65,midi:60,hand:'right'}, {bar:1,at:0,dur:.65,midi:61,hand:'left'},
 {bar:1,at:.12,dur:.5,midi:62,hand:'right'}, {bar:1,at:.24,dur:.5,midi:65,hand:'left'},
 {bar:1,at:.36,dur:.5,midi:64,hand:'right'}, {bar:1,at:.48,dur:.5,midi:63,hand:'left'},
 {bar:1,at:1.3,dur:.5,midi:67,hand:'right'}
];
const score={id:'custom-note-explosion-check',title:'Note Explosion Check',total:1,barLengths:[8],bpm:72,events};
let browser;
async function addScore(page){await page.evaluate(song=>window.PianoKingdomLibrary.addSong(song,{select:true}),score)}
async function playFromStart(page){await page.evaluate(()=>{mode='stop';pausedMode=null;seekAbsolute(0);startMode('listen')})}
async function assertImpactAlignment(page,detail){const key=await page.locator(`#keys [data-pitch="${detail.pitch}"]`).boundingBox(),canvas=await page.locator('#rain').boundingBox();assert.ok(key&&canvas,`key ${detail.pitch} and note highway are rendered`);assert.ok(Math.abs(detail.x-(key.x+key.width/2-canvas.x))<1,`pitch ${detail.pitch} impact is centered on its DOM piano key`);assert.ok(Math.abs(detail.y-(key.y-canvas.y))<1,`pitch ${detail.pitch} impact is at the keyboard hit line`)}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:artifactDir,size:{width:390,height:844}},serviceWorkers:'block',reducedMotion:'no-preference'});
 await context.addInitScript(()=>{window.__noteArrivals=[];window.addEventListener('piano-note-arrival',e=>window.__noteArrivals.push({...e.detail,time:performance.now()}))});
 const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PianoKingdomLibrary?.addSong);
  assert.equal(await page.locator('main').getAttribute('data-piano-layout'),'hero','test uses Magical Piano Hero');await addScore(page);
  await context.setOffline(true);const beforeBeat=await page.evaluate(()=>beat);await page.locator('#secondaryModeButton').click();await page.waitForFunction(()=>window.__noteArrivals.length>=2,{timeout:5000});
  const chord=await page.evaluate(()=>window.__noteArrivals.slice(0,2));assert.deepEqual(chord.map(e=>e.pitch),[60,61],'white and black chord notes both produce impact events');assert.deepEqual(chord.map(e=>e.color),['#d38aff','#67dafa'],'impact colors match right/left falling-note colors');assert.ok(chord.every(e=>e.visualOnly===true),'impact event explicitly does not measure playing accuracy');for(const d of chord)await assertImpactAlignment(page,d);
  await page.screenshot({path:path.join(artifactDir,'magical-note-explosion-390x844.png')});
  await page.waitForFunction(()=>window.__noteArrivals.length>=6,{timeout:5000});const fast=await page.evaluate(()=>window.__noteArrivals.slice(0,6));assert.equal(new Set(fast.map(e=>`${e.bar}:${e.at}:${e.pitch}`)).size,fast.length,'skipped frames do not duplicate note impact events');assert.ok(fast.some(e=>e.at===.12)&&fast.some(e=>e.at===.24)&&fast.some(e=>e.at===.36)&&fast.some(e=>e.at===.48),'consecutive fast notes are all detected');
  await page.waitForTimeout(180);const advancedBeat=await page.evaluate(()=>beat);assert.ok(advancedBeat>beforeBeat+.25&&advancedBeat<beforeBeat+1.2,'playback timeline advances normally while effects render');
  await page.locator('#pause').click();const pausedCount=await page.evaluate(()=>window.__noteArrivals.length);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__noteArrivals.length),pausedCount,'pause stops new effects');await page.locator('#pause').click();await page.waitForFunction(()=>window.__noteArrivals.some(e=>e.at===1.3),{timeout:2500});
  await page.locator('#restart').click();assert.equal(await page.evaluate(()=>[...noteFxStart].filter(t=>t>=0).length),0,'restart clears particles');assert.equal(await page.evaluate(()=>noteFlashEnd.some(t=>t>0)),false,'restart clears key flashes');
  await page.locator('#zoomKeys').click();assert.equal(await page.evaluate(()=>referenceWhiteKeys),8,'Zoom Keys changes the visible keyboard range');assert.equal(await page.locator('#keys .white').count(),8,'zoom visibly changes piano keys');await playFromStart(page);let count=await page.evaluate(()=>window.__noteArrivals.length);await page.waitForFunction(n=>window.__noteArrivals.length>=n+2,count,{timeout:5000});const zoomed=await page.evaluate(n=>window.__noteArrivals.slice(n,n+2),count);for(const d of zoomed)await assertImpactAlignment(page,d);await page.locator('#pause').click();
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:834,height:1194},{width:1194,height:834},{width:1440,height:900}]){await page.setViewportSize(viewport);await page.waitForTimeout(50);await playFromStart(page);count=await page.evaluate(()=>window.__noteArrivals.length);await page.waitForFunction(n=>window.__noteArrivals.length>=n+2,count,{timeout:5000});const pair=await page.evaluate(n=>window.__noteArrivals.slice(n,n+2),count);for(const d of pair)await assertImpactAlignment(page,d);await page.locator('#pause').click()}
  count=await page.evaluate(()=>window.__noteArrivals.length);await page.evaluate(()=>{mode='stop';pausedMode=null;seekAbsolute(0);startMode('listen')});await page.waitForFunction(n=>window.__noteArrivals.length>=n+2,count,{timeout:5000});const activeBeforeSwitch=await page.evaluate(()=>[...noteFxStart].filter(t=>t>=0).length);assert.ok(activeBeforeSwitch>0,'particles are active before interruption');await page.evaluate(()=>window.PianoKingdomLibrary.selectSong('cradle'));assert.equal(await page.evaluate(()=>[...noteFxStart].filter(t=>t>=0).length),0,'song change clears active particles');assert.equal(await page.evaluate(()=>noteFlashEnd.some(t=>t>0)),false,'song change clears keyboard flashes');
  assert.deepEqual(pageErrors,[],'no page runtime errors');console.log('Note Explosion Chromium checks passed: single/chord arrivals, white and black keys, fast notes without duplicates, matching colors, keyboard alignment, zoom, five portrait/landscape/desktop viewports, pause/resume/restart/song change, offline playback and unchanged timeline. Screenshot and video are in /tmp/r2-note-explosion.');
 }finally{await context.close()}
 const video=await page.video().path();fs.copyFileSync(video,path.join(artifactDir,'magical-note-explosion-390x844.webm'));
 const reduced=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});await reduced.addInitScript(()=>{window.__noteArrivals=[];window.addEventListener('piano-note-arrival',e=>window.__noteArrivals.push({...e.detail}))});const reducedPage=await reduced.newPage();
 try{await reducedPage.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});await reducedPage.waitForFunction(()=>window.PianoKingdomLibrary?.addSong);await addScore(reducedPage);await reducedPage.locator('#secondaryModeButton').click();await reducedPage.waitForFunction(()=>window.__noteArrivals.length>=2,{timeout:5000});assert.equal(await reducedPage.evaluate(()=>[...noteFxStart].filter(t=>t>=0).length),0,'reduced motion omits moving particles');assert.equal(await reducedPage.locator('#keys [data-pitch="60"]').evaluate(e=>e.classList.contains('impact-lit')),true,'reduced motion retains brief key indication');console.log('Reduced-motion check passed: no moving particles; key indication remains.')}finally{await reduced.close()}
})().catch(async error=>{console.error(error);try{await browser?.close()}catch{}try{server.close()}catch{}process.exitCode=1});
