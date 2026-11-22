'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.RUNNER_TEMP||'/tmp','neon-label-impact-evidence'),sha=process.env.APP_SOURCE_SHA||process.env.GITHUB_SHA||'local';
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(route==='/'?'/index.html':route));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(b)})});
const wait=ms=>new Promise(r=>setTimeout(r,ms));function assert(ok,message){if(!ok)throw Error(message)}
const viewports=[['Android portrait',390,844,2,true],['Android landscape',844,390,2,true],['Android landscape wide',915,412,2,true],['iPad portrait',834,1194,2,true],['iPad landscape',1194,834,2,true],['Desktop Chromium',1440,900,1,false]];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const launchOptions={headless:true,args:['--no-sandbox','--mute-audio']};if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launchOptions.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
 const browser=await chromium.launch(launchOptions),errors=[],results=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'no-preference',recordVideo:{dir:out,size:{width:390,height:844}}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>{if(!r.url().startsWith('data:'))errors.push('request failed '+r.url()+' · '+r.failure()?.errorText)});
  await page.addInitScript(()=>{
   localStorage.setItem('aaria-piano-layout-v1','hero');window.__arrivals=[];window.__labels=[];
   window.addEventListener('piano-note-arrival',e=>window.__arrivals.push(e.detail));
   const native=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
    if(this.canvas?.id==='rain'&&/^[A-G](?:#|♯)?[0-9]$/.test(String(text))){const m=this.font.match(/([0-9.]+)px/),transform=this.getTransform(),pixelRatio=this.canvas.width/(this.canvas.clientWidth||1),cssScale=transform.a/pixelRatio;window.__labels.push({text:String(text),fontPx:m?Number(m[1]):0,x:transform.e/pixelRatio,y:transform.f/pixelRatio,width:this.measureText(String(text)).width*cssScale,canvasWidth:this.canvas.clientWidth,canvasHeight:this.canvas.clientHeight})}
    return native.call(this,text,x,y,...rest)
   };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.PianoHeroVisual&&!!document.querySelector('#rain'),null,{timeout:20000});
  // The install gate is bypassed only in this isolated test browser; the app renderer remains live.
  await page.evaluate(()=>{const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');if(gate)gate.hidden=true;if(app){app.inert=false;app.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
  await page.waitForFunction(()=>document.querySelector('#rain')?.width>0&&document.querySelector('#keys [data-pitch]'),null,{timeout:20000});
  assert((await page.locator('#v21Play').innerText()).includes('Play Along'),'Unified Play Along control is missing');
  assert(await page.locator('#v21Sound').getAttribute('aria-pressed')==='true','new profile should start with Sound On');
  await page.locator('#v21Play').click();
  await page.waitForFunction(()=>window.__arrivals.length>=3,null,{timeout:12000});await wait(45);
  const impact=await page.evaluate(()=>{
   const first=window.__arrivals[0],key=first&&document.querySelector('#keys [data-pitch="'+first.pitch+'"]'),style=key?getComputedStyle(key):null,pseudo=key?getComputedStyle(key,'::after'):null;
   const chord=window.__arrivals.filter(e=>e.bar===first?.bar&&e.at===first?.at),nearLabels=window.__labels.filter(x=>x.y>x.canvasHeight*.45);
   const sourceNotes=EVENTS.filter(n=>n.bar===bar),expectedLabels=[...new Set(sourceNotes.map(n=>noteName(n.midi)))],observedLabels=[...new Set(window.__labels.map(x=>x.text))],nearAndSmallLabels=window.__labels.filter(x=>x.y>x.canvasHeight*.45);const expectedPitches=[...new Set(EVENTS.filter(n=>n.bar===first?.bar&&n.at===first?.at).map(n=>n.midi))];return{first,chordCount:chord.length,chordPitches:[...new Set(chord.map(e=>e.pitch))],expectedPitches,sourceNotes:sourceNotes.map(n=>({midi:n.midi,dur:n.dur,part:n.part})),expectedLabels,observedLabels,smallLabels:window.__labels.filter(x=>x.fontPx<11).slice(-30),nearLabels:nearAndSmallLabels.slice(-40),impactClass:key?.classList.contains('impact-lit'),keyAnimation:pseudo?.animationName,keyBoxShadow:style?.boxShadow};
  });
  console.log('Measure-start impact evidence',JSON.stringify({first:impact.first,chordCount:impact.chordCount,chordPitches:impact.chordPitches,arrivals:await page.evaluate(()=>window.__arrivals.slice(0,12))}));
  assert(impact.first?.visualOnly===true,'a real note-arrival event did not fire');
  assert(impact.chordCount===impact.expectedPitches.length&&impact.chordPitches.length===impact.expectedPitches.length&&impact.expectedPitches.every(pitch=>impact.chordPitches.includes(pitch)),'measure-start impacts do not match the source chord or include duplicate notes: '+JSON.stringify({expected:impact.expectedPitches,arrived:impact.chordPitches,count:impact.chordCount,arrivals:await page.evaluate(()=>window.__arrivals.slice(0,12))}));
  assert(impact.first.particlesGenerated>=8,'impact event fired but no visible spark particles were generated');
  assert(impact.first.flashDurationMs===360,'normal impact flash duration changed from 360 ms');
  assert(impact.first.effectY<impact.first.keyTop&&impact.first.keyTop-impact.first.effectY>=8,'impact effect remains clipped on the keyboard/canvas boundary');
  assert(impact.impactClass&&impact.keyAnimation==='piano-hero-impact-flash','Hero key impact halo is not visibly rendered over the key');
  const nearLabelSizes=impact.nearLabels.map(x=>({text:x.text,fontPx:x.fontPx,y:x.y,canvasHeight:x.canvasHeight}));
  assert(impact.nearLabels.length>0&&Math.max(...impact.nearLabels.map(x=>x.fontPx))>=11,'note-code labels were not drawn at a readable near-keyboard size: '+JSON.stringify(nearLabelSizes));
  assert(impact.nearLabels.every(x=>x.x-x.width/2>=0&&x.x+x.width/2<=x.canvasWidth),'near-keyboard note label text is clipped');
  assert(impact.sourceNotes.some(n=>n.part==='piano-lh')&&impact.sourceNotes.some(n=>n.part==='piano-rh'),'label fixture includes both hands from actual song events');
  assert(impact.sourceNotes.some(n=>n.dur<=1)&&impact.sourceNotes.some(n=>n.dur>=2),'label fixture includes short and long actual song notes');
  assert(impact.expectedLabels.every(label=>impact.observedLabels.includes(label)),'every visible measure note name is drawn from the song MIDI data: '+JSON.stringify({expected:impact.expectedLabels,observed:impact.observedLabels,measure:impact.first?.bar}));
  assert(impact.smallLabels.length>0,'small/far projected notes still receive a compact readable label');
  await page.screenshot({path:path.join(out,'01-android-portrait-note-impact-390x844.png')});
  const beatBefore=await page.evaluate(()=>beat);await wait(1000);const beatAfter=await page.evaluate(()=>beat),beatAdvance=beatAfter-beatBefore;
  assert(beatAdvance>1.1&&beatAdvance<3,'real-time playback continued at expected speed while the effects rendered; observed '+beatAdvance.toFixed(2)+' beats per second interval');
  await page.screenshot({path:path.join(out,'02-android-portrait-live-labels-390x844.png')});
  const speedZoomChecks=[];for(const speedValue of [40,120]){await page.locator('#speed').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}))},speedValue);await page.locator('#v21Zoom').click();await page.evaluate(()=>window.__labels=[]);await wait(240);const state=await page.evaluate(()=>({speed:document.querySelector('#speed').value,zoom:document.querySelector('#v21Zoom').getAttribute('aria-label'),labels:window.__labels.length}));assert(state.labels>0,'note names remain visible at '+state.speed+'% speed and '+state.zoom);speedZoomChecks.push(state)}
  for(const [label,w,h,scale,touch] of viewports.slice(1)){
   await page.setViewportSize({width:w,height:h});await page.evaluate(()=>window.__labels=[]);await wait(220);
   const state=await page.evaluate(()=>{const c=document.querySelector('#rain'),k=document.querySelector('#keys'),r=c.getBoundingClientRect(),kr=k.getBoundingClientRect(),labels=window.__labels.slice(-120);return{width:innerWidth,height:innerHeight,canvasHeight:c.clientHeight,labels:labels.length,largestNearLabel:Math.max(0,...labels.filter(x=>x.y>x.canvasHeight*.45).map(x=>x.fontPx)),clipped:labels.some(x=>x.x-x.width/2<0||x.x+x.width/2>c.clientWidth),keyBoundary:Math.abs(r.bottom-kr.top),scrollWidth:document.documentElement.scrollWidth}});
   assert(state.labels>0,label+': no real note labels were drawn');assert(!state.clipped,label+': note labels clip beyond the highway');assert(state.keyBoundary<2,label+': notes canvas no longer meets the keyboard boundary');assert(state.scrollWidth<=w,label+': viewport has horizontal overflow');
   await page.screenshot({path:path.join(out,String(results.length+3).padStart(2,'0')+'-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+w+'x'+h+'.png')});
   results.push({label,width:w,height:h,deviceScaleFactor:scale,touch,noteLabelsSeen:state.labels,largestNearKeyLabelFontPx:state.largestNearLabel,clipped:state.clipped,keyBoundaryErrorPx:+state.keyBoundary.toFixed(2)});
  }
  await page.emulateMedia({reducedMotion:'reduce'});const beforeReduce=await page.evaluate(()=>window.__arrivals.length);await page.evaluate(()=>window.AariaV21Engine.setMeasure(2));await page.waitForFunction(n=>window.__arrivals.length>n,beforeReduce,{timeout:5000});
  const reduced=await page.evaluate(()=>{const latest=window.__arrivals.at(-1),key=latest&&document.querySelector('#keys [data-pitch="'+latest.pitch+'"]');return{latest,animation:key?getComputedStyle(key,'::after').animationName:null,media:matchMedia('(prefers-reduced-motion: reduce)').matches}});
  assert(reduced.media&&reduced.latest?.flashDurationMs===120&&reduced.latest?.particlesGenerated===0,'reduced-motion did not use the 120 ms, particle-free impact');
  await page.screenshot({path:path.join(out,'08-reduced-motion-impact.png')});
  fs.writeFileSync(path.join(out,'impact-and-responsive-results.json'),JSON.stringify({sourceSha:sha,normalImpact:{bar:impact.first.bar,at:impact.first.at,pitch:impact.first.pitch,chordImpactCount:impact.chordCount,distinctPitches:impact.chordPitches,sourceMeasureLabelCoverage:impact.expectedLabels,smallProjectionLabels:impact.smallLabels,particlesGenerated:impact.first.particlesGenerated,flashDurationMs:impact.first.flashDurationMs,effectAboveKeyPx:+(impact.first.keyTop-impact.first.effectY).toFixed(2),heroKeyAnimation:impact.keyAnimation,nearKeyLabels:impact.nearLabels},playbackBeatAdvance:beatAdvance,speedAndZoom: speedZoomChecks,reducedMotion:{particlesGenerated:reduced.latest.particlesGenerated,flashDurationMs:reduced.latest.flashDurationMs},responsive:results},null,2)+'\n');
  if(errors.length)throw Error('Browser errors: '+errors.join(' | '));
  await page.close();const video=await page.video().path();fs.copyFileSync(video,path.join(out,'neon-labels-and-magical-impacts-live.webm'));await context.close();
  fs.writeFileSync(path.join(out,'README.md'),'# Neon key-code labels and Magical Note Explosion evidence\n\nReal application rendering captured in Chromium at source SHA `'+sha+'`. Includes an impact-frame screenshot from live playback, the live Android portrait view, landscape and tablet screenshots, desktop, and reduced-motion evidence. The playback test verifies actual MIDI-derived note-name coverage for both hands and small projected notes, and verifies every source note in the measure-start chord arrives exactly once, a 360 ms normal impact, generated colored particles, the Hero key halo layer, and the 120 ms particle-free reduced-motion impact. Screenshots use viewport and mode names. The WebM records actual running app playback with browser audio muted for CI. Chromium mobile/touch emulation is not a physical Android PWA install; the supplied Android screenshot remains the device baseline. The install gate is unlocked only in the isolated test harness.\n');
  const zip=path.join(process.env.GITHUB_WORKSPACE||process.cwd(),'neon-label-impact-evidence.zip');execFileSync('python3',['-m','zipfile','-c',zip,out]);console.log('Neon labels and real note-impact checks passed at '+sha+'; evidence ZIP: '+zip);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
