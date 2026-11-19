'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const artifactDir=path.join(os.tmpdir(),'r2-listen-preference');fs.mkdirSync(artifactDir,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)})});
const score={id:'custom-listen-preference-check',title:'Listen Preference Check',total:1,barLengths:[8],bpm:72,events:[{bar:1,at:0,dur:1,midi:60,hand:'right',part:'piano-rh'},{bar:1,at:1,dur:1,midi:64,hand:'right',part:'piano-rh'}]};
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 try{
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PianoKingdomLibrary?.addSong);
  const assertSingleListenToggle=async()=>{
   assert.equal(await page.locator('button.listen-toggle').count(),1,'exactly one Listen toggle is rendered');
   assert.equal(await page.locator('#playbackModeControls button').filter({hasText:/\bListen\b/i}).count(),1,'only the toggle control is labelled Listen');
   assert.doesNotMatch(await page.locator('#secondaryModeButton').innerText(),/\bListen\b/i,'the song-play action is not a duplicate Listen control');
   assert.doesNotMatch(await page.locator('#secondaryModeButton').getAttribute('aria-label'),/\bListen\b/i,'the song-play action has no duplicate Listen accessibility label');
   assert.equal(await page.locator('#listenToggle').isVisible(),true,'Listen toggle is visible');
  };
  await assertSingleListenToggle();
  assert.match(await page.locator('#secondaryModeButton').innerText(),/Play Song/,'Hero retains a separate play-song action');
  assert.match(await page.locator('#secondaryModeButton').getAttribute('aria-label'),/Play song with sound/);
  assert.match(await page.locator('#primaryModeButton').innerText(),/Play Along/,'Play Along remains available');
  for(const selector of ['#pause','#speed','#loopRange','#bar'])assert.equal(await page.locator(selector).isVisible(),true,`essential control ${selector} remains visible`);

  await page.evaluate(song=>window.PianoKingdomLibrary.addSong(song,{select:true}),score);
  const initial=await page.evaluate(()=>({enabled:listenEnabled,mode,context:ctx,storage:localStorage.getItem('aaria-piano-listen-enabled-v1')}));
  assert.equal(initial.enabled,true,'Listen defaults on with no saved choice');assert.equal(initial.mode,'stop','default Listen does not start playback');assert.equal(initial.context,null,'default Listen does not create an audio context');assert.equal(initial.storage,null,'initial default does not overwrite an existing preference');
  const toggle=page.locator('#listenToggle');assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.match(await toggle.textContent(),/Listen On/);
  await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.match(await toggle.textContent(),/Listen Off/);assert.equal(await page.evaluate(()=>localStorage.getItem('aaria-piano-listen-enabled-v1')),'false');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PianoKingdomLibrary?.addSong);assert.equal(await page.locator('#listenToggle').getAttribute('aria-pressed'),'false','explicit off preference survives reload');
  await page.evaluate(song=>window.PianoKingdomLibrary.addSong(song,{select:true}),score);await page.locator('#secondaryModeButton').click();await page.waitForFunction(()=>mode==='listen'&&beat>.15,{timeout:3000});
  assert.equal(await page.evaluate(()=>ctx===null),true,'muted Listen playback stays silent');assert.equal(await page.evaluate(()=>voices.length),0,'muted playback schedules no notes');
  await page.locator('#pause').click();assert.equal(await page.evaluate(()=>localStorage.getItem('aaria-piano-listen-enabled-v1')),'false');await page.locator('#pause').click();assert.equal(await page.evaluate(()=>listenEnabled),false,'pause and resume retain off preference');
  await page.evaluate(()=>window.PianoKingdomLibrary.selectSong('cradle'));assert.equal(await page.evaluate(()=>listenEnabled),false,'song switching retains off preference');await page.evaluate(()=>document.querySelector('#restart').click());assert.equal(await page.evaluate(()=>listenEnabled),false,'restart retains off preference');
  await toggle.click();assert.equal(await page.evaluate(()=>listenEnabled),true);assert.equal(await page.evaluate(()=>mode),'stop','enabling Listen does not start playback');assert.equal(await page.evaluate(()=>ctx),null,'enabling Listen does not resume or create audio');
  await page.screenshot({path:path.join(artifactDir,'listen-on-390x844.png')});
  await page.setViewportSize({width:1440,height:900});await assertSingleListenToggle();
  for(const selector of ['#primaryModeButton','#pause','#secondaryModeButton','#speed','#loopRange','#bar'])assert.equal(await page.locator(selector).isVisible(),true,`desktop control ${selector} remains visible`);
  await page.screenshot({path:path.join(artifactDir,'listen-single-toggle-desktop-1440x900.png')});
  await page.setViewportSize({width:390,height:844});await assertSingleListenToggle();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PianoKingdomLibrary?.addSong);assert.equal(await page.locator('#listenToggle').getAttribute('aria-pressed'),'true','on preference survives reload');assert.equal(await page.evaluate(()=>mode),'stop');assert.equal(await page.evaluate(()=>ctx),null,'reload with Listen on remains subject to explicit audio gesture');
  await page.evaluate(song=>window.PianoKingdomLibrary.addSong(song,{select:true}),{...score,events:[score.events[0]]});await context.setOffline(true);await page.locator('#secondaryModeButton').click();await page.waitForFunction(()=>mode==='listen'&&voices.length>0,{timeout:3000});assert.ok(await page.evaluate(()=>ctx!==null),'sound starts after the user explicitly starts Listen');assert.ok(await page.evaluate(()=>voices.length>0),'enabled playback schedules audio notes offline');assert.deepEqual(await page.evaluate(()=>voices.map(o=>o.frequency.value.toFixed(1))),['261.6'],'one play-song action schedules exactly one C4 oscillator');
  await page.screenshot({path:path.join(artifactDir,'listen-playing-offline-390x844.png')});await page.locator('#pause').click();assert.equal(await page.evaluate(()=>listenEnabled),true);await page.locator('#pause').click();await page.evaluate(()=>window.PianoKingdomLibrary.selectSong('cradle'));assert.equal(await page.evaluate(()=>localStorage.getItem('aaria-piano-listen-enabled-v1')),'true','song switch, pause, resume and restart preserve on preference');
  assert.deepEqual(pageErrors,[],'no page runtime errors');console.log('Listen preference Chromium checks passed: default on without autoplay, persisted off/on across reloads, silent mode, explicit audio playback, pause/resume/restart/song switching, and offline operation. Screenshots are in /tmp/r2-listen-preference.');
 }finally{await context.close()}
 await browser.close();await new Promise(resolve=>server.close(resolve));
})().catch(async error=>{console.error(error);try{await browser?.close()}catch{}try{server.close()}catch{}process.exitCode=1});
