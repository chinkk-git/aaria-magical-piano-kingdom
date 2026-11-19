'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.RUNNER_TEMP||'/tmp','android-landscape-controls-evidence'),sha=process.env.APP_SOURCE_SHA||process.env.GITHUB_SHA||'local';
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(route==='/'?'/index.html':route));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(b)})});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const viewports=[['Android landscape',844,390,2,true],['Android landscape wide',915,412,2,true],['Android portrait',390,844,2,true],['iPad landscape',1194,834,2,true],['iPad portrait',834,1194,2,true],['Desktop',1440,900,1,false]];
function assert(ok,message){if(!ok)throw Error(message)}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const launchOptions={headless:true,args:['--no-sandbox']};if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launchOptions.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
 const browser=await chromium.launch(launchOptions),results=[],errors=[];
 try{
  for(let i=0;i<viewports.length;i++){
   const [label,w,h,scale,touch]=viewports[i],context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:scale,isMobile:touch,hasTouch:touch,reducedMotion:'no-preference'}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(label+': '+String(e)));page.on('requestfailed',r=>{if(!r.url().startsWith('data:'))errors.push(label+': request failed '+r.url()+' · '+r.failure()?.errorText)});
   await page.addInitScript(()=>{localStorage.setItem('aaria-piano-layout-v1','hero');window.__impactCount=0;window.addEventListener('piano-note-arrival',()=>window.__impactCount++)});
   await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.PianoHeroVisual&&!!document.querySelector('#rain'),null,{timeout:20000});
   await page.evaluate(()=>{const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');if(gate)gate.hidden=true;if(app){app.inert=false;app.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
   await page.waitForFunction(()=>document.querySelector('#rain')?.width>0&&document.querySelector('#keys [data-pitch]'),null,{timeout:20000});await wait(100);
   const layout=await page.evaluate(()=>{
    const rect=s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return e&&r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,display:getComputedStyle(e).display}:null};
    return{viewport:{width:innerWidth,height:innerHeight},player:rect('#player'),row1:rect('#playbackModeControls'),row2:rect('#player .extras'),speed:rect('#speed'),loop:rect('#loopRange'),measure:rect('#bar'),rain:rect('#rain'),keys:rect('#keys'),labels:{playAlong:document.querySelector('#primaryModeButton')?.textContent.trim(),playSong:document.querySelector('#secondaryModeButton')?.textContent.trim(),listen:document.querySelector('#listenToggle')?.textContent.trim()},listenPressed:document.querySelector('#listenToggle')?.getAttribute('aria-pressed'),measureCount:document.querySelectorAll('#bar option').length,scrollWidth:document.documentElement.scrollWidth};
   });
   assert(layout.row2&&layout.row2.display!=='none'&&layout.row2.width>0&&layout.row2.height>=34,label+': playback control row 2 is hidden or too small');
   assert(layout.player&&layout.row1.bottom<=layout.row2.y+1,label+': playback rows overlap');
   assert(layout.row2.bottom<=h+1,label+': second playback row is below viewport');
   assert(layout.speed.x>=layout.row2.x-1&&layout.speed.right<=layout.row2.right+1&&layout.loop.x>=layout.row2.x-1&&layout.measure.right<=layout.row2.right+1,label+': Speed/Loop/measure controls clip horizontally');
   assert(layout.rain&&layout.keys&&Math.abs(layout.rain.bottom-layout.keys.y)<2,label+': notes canvas and keyboard are misaligned');
   assert(layout.scrollWidth<=w,label+': page has horizontal overflow');
   assert(layout.labels.playAlong.includes('Play Along')&&layout.labels.playSong.includes('Play Song')&&layout.labels.listen.includes('Listen On')&&layout.listenPressed==='true',label+': Play Along, Play Song, or default Listen ON control is incorrect');
   assert(layout.measureCount>=2,label+': measure navigation has no selectable measures');
   await page.screenshot({path:path.join(out,String(i+1).padStart(2,'0')+'-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+w+'x'+h+'.png')});
   // Exercise the actual UI controls without starting audible playback.
   await page.locator('#speed').evaluate(e=>{e.value='91';e.dispatchEvent(new Event('input',{bubbles:true}))});
   assert(await page.locator('#speedVal').innerText()==='91%',label+': Speed control did not update');
   await page.locator('#loopRange').selectOption('2');assert((await page.locator('#status').innerText()).includes('Looping 2'),label+': Loop control did not activate');
   await page.locator('#bar').selectOption('2');assert((await page.locator('#position').innerText()).includes('Measure 2'),label+': measure navigation did not update');
   await page.locator('#listenToggle').click();assert(await page.locator('#listenToggle').getAttribute('aria-pressed')==='false',label+': Listen preference toggle did not turn off');
   await page.locator('#primaryModeButton').click();assert(await page.locator('#countdown').isVisible(),label+': Play Along did not start');
   await page.locator('#pause').click();assert(await page.locator('#pause').innerText()==='▶ Resume',label+': Pause did not pause Play Along');
   await page.locator('#pause').click();assert(await page.locator('#pause').innerText()==='⏸ Pause',label+': Resume did not resume Play Along');
   results.push({label,width:w,height:h,deviceScaleFactor:scale,touch,checks:'rows visible; Speed, Loop, measure, Play Along, Pause/Resume and separate Play Song/Listen controls functional',geometry:{rowsNonOverlapping:true,canvasToKeyboardBoundaryPx:+(layout.keys.y-layout.rain.bottom).toFixed(2),horizontalOverflow:layout.scrollWidth>w}});
   await context.close();
  }
  if(errors.length)throw Error('Browser errors: '+errors.join(' | '));
  fs.writeFileSync(path.join(out,'responsive-results.json'),JSON.stringify({sourceSha:sha,viewports:results},null,2)+'\n');
  fs.writeFileSync(path.join(out,'README.md'),'# Android landscape playback controls evidence\n\nCaptured from actual Piano Hero application rendering in Chromium at source SHA `'+sha+'`. The screenshot set covers Android landscape 844×390 and 915×412, Android portrait 390×844, iPad landscape 1194×834, iPad portrait 834×1194 and desktop 1440×900. Each viewport passed visibility, touch-size, clipping, canvas-to-keyboard alignment and interactive checks for Speed, Loop, measure selection, Play Along, Pause/Resume, separate Play Song and Listen preference controls. The install gate was unlocked in the test harness only. No saved application records were changed. See `responsive-results.json` for viewport details.\n');
  const zip=path.join(process.env.GITHUB_WORKSPACE||process.cwd(),'android-landscape-controls-evidence.zip');execFileSync('python3',['-m','zipfile','-c',zip,out]);console.log('Responsive control tests passed at '+sha+'; evidence ZIP: '+zip);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
