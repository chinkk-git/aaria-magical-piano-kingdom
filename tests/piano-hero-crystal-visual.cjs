'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.RUNNER_TEMP||'/tmp','piano-hero-crystal-evidence'),sha=process.env.APP_SOURCE_SHA||process.env.GITHUB_SHA||'local';
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(route==='/'?'/index.html':route));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(b)})});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function snapshot(page,label,w,h,index){await page.setViewportSize({width:w,height:h});await wait(240);await page.screenshot({path:path.join(out,String(index).padStart(2,'0')+'-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+w+'x'+h+'.png')})}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const launchOptions={headless:true,args:['--no-sandbox']};if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launchOptions.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,recordVideo:{dir:out,size:{width:390,height:844}},reducedMotion:'no-preference'}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>{if(!r.url().startsWith('data:'))errors.push('request failed '+r.url()+' · '+r.failure()?.errorText)});
  await page.addInitScript(()=>{localStorage.setItem('aaria-piano-layout-v1','hero');window.__impactFrameCount=0;window.__frameSamples=[];window.__longTaskCount=0;window.addEventListener('piano-note-arrival',()=>window.__impactFrameCount++);let last=0;const sample=t=>{if(last)window.__frameSamples.push(t-last);last=t;requestAnimationFrame(sample)};requestAnimationFrame(sample);if('PerformanceObserver'in window){try{new PerformanceObserver(list=>window.__longTaskCount+=list.getEntries().length).observe({type:'longtask',buffered:true})}catch{}}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.PianoHeroVisual&&!!document.querySelector('#rain'),null,{timeout:20000});
  // Unlock only the legacy install dialog in the test harness; the screenshot
  // still shows the real running Piano Hero application and its live canvas.
  await page.evaluate(()=>{const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');if(gate)gate.hidden=true;if(app){app.inert=false;app.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
  await page.waitForFunction(()=>document.querySelector('#rain')?.width>0&&document.querySelector('#keys [data-pitch]'),null,{timeout:20000});
  await snapshot(page,'Ready idle',390,844,1);
  await page.locator('#v21Play').click();
  await page.waitForFunction(()=>window.__impactFrameCount>0,null,{timeout:15000});await wait(90);
  await snapshot(page,'Android note impact frame',390,844,2);
  await wait(1600);await snapshot(page,'Live notes portrait',390,844,9);
  const evidence=await page.evaluate(()=>{const samples=window.__frameSamples.filter(x=>x>0&&x<100).sort((a,b)=>a-b);return{impactCount:window.__impactFrameCount,frameIntervals:samples.length,frameGapP50Ms:+(samples[Math.floor(samples.length*.5)]||0).toFixed(2),frameGapP95Ms:+(samples[Math.floor(samples.length*.95)]||0).toFixed(2),longTaskCount:window.__longTaskCount,deviceScaleFactor:devicePixelRatio,viewport:`${innerWidth}x${innerHeight}`}});if(evidence.impactCount<1)throw Error('No real piano-note-arrival impact event was observed.');fs.writeFileSync(path.join(out,'android-emulation-performance.json'),JSON.stringify(evidence,null,2)+'\\n');
  await page.locator('#v21Play').click();if(await page.locator('#v21Play').innerText()!=='▶ Resume')throw Error('Pause did not switch the active playback control to Resume.');await wait(300);
  await snapshot(page,'Paused portrait',390,844,3);
  await page.locator('#v21Play').click();if(await page.locator('#v21Play').innerText()!=='⏸ Pause')throw Error('Resume did not restore the playback control.');await wait(300);
  for(const [label,w,h,i] of [['Phone landscape',844,390,4],['Tablet portrait',834,1194,5],['Tablet landscape',1194,834,6],['Laptop landscape',1440,900,7]])await snapshot(page,label,w,h,i);
  await page.emulateMedia({reducedMotion:'reduce'});await wait(350);
  const reduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);if(!reduced)throw Error('Reduced-motion media preference was not applied.');
  await snapshot(page,'Reduced motion',390,844,8);
  await page.close();
  const video=await page.video().path();fs.copyFileSync(video,path.join(out,'piano-hero-crystal-notes-live.webm'));
  await context.close();
  if(errors.length)throw Error('Browser reported errors: '+errors.join(' | '));
  fs.writeFileSync(path.join(out,'README.md'),'# Piano Hero crystal visual evidence\n\nCaptured from the running application in Chromium at source SHA `'+sha+'`. These are real app renders; the design concept was used as a reference only. The WebM shows the live renderer and controls. Android-touch emulation: 390×844 at device scale 2. Viewports: 390×844, 844×390, 834×1194, 1194×834, 1440×900. An actual piano-note-arrival impact event was observed and captured. Chromium Android-touch emulation reports animation-frame interval percentiles and long tasks in `android-emulation-performance.json`; this is an emulated browser run, not a physical-device benchmark. Reduced-motion preference was applied and verified.\n');
  const zip=path.join(process.env.GITHUB_WORKSPACE||process.cwd(),'piano-hero-crystal-visual-evidence.zip');execFileSync('python3',['-m','zipfile','-c',zip,out]);
  console.log('Captured actual Piano Hero screenshots and WebM at '+sha+'; evidence ZIP: '+zip);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
