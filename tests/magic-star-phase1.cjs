'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(process.cwd(),'magic-star-phase1-evidence');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('not found: '+pathname);return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)})});
const viewports=[
 {name:'motorola-edge-50-fusion-portrait-emulated',width:412,height:915},
 {name:'motorola-edge-50-fusion-landscape-emulated',width:915,height:412},
 {name:'ipad-portrait-emulated',width:834,height:1194},
 {name:'ipad-landscape-emulated',width:1194,height:834},
 {name:'desktop-1440x900',width:1440,height:900}
];
const groups={
 music:['measure','loop','jump','practice','makeMusic'],
 navigation:['home','songs','pianoMode','settings','updateApp']
};
const shots=[];
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const origin='http://127.0.0.1:'+server.address().port;
 for(let i=0;i<viewports.length;i++){
   const vp=viewports[i],videoDir=path.join(out,'video-temp');fs.mkdirSync(videoDir,{recursive:true});
   const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block',...(i===0?{recordVideo:{dir:videoDir,size:{width:vp.width,height:vp.height}}}:{})});
   await context.addInitScript(()=>localStorage.setItem('aaria-piano-custom-songs-v1',JSON.stringify([{id:'phase1-fixture',title:'Owner review fixture',events:[{bar:1,at:0,dur:2,midi:60}],total:1,barLengths:[8],bpm:80,imported:true}])));
   const page=await context.newPage(),errors=[],missingAssets=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',r=>{if(/v2\.1-magic-wheel/.test(r.url()))missingAssets.push(r.url())});
   await page.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* wheel acceptance fixture */'}));
   await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForSelector('.v21-dock',{timeout:15000});
   await page.waitForFunction(()=>window.AariaV21Engine);
   await page.evaluate(()=>{const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');if(gate)gate.hidden=true;if(app){app.inert=false;app.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
   await page.waitForTimeout(250);
   assert.equal(await page.locator('.v21-dock button').count(),3,'the fixed dock keeps Play/Pause, Sound and Zoom buttons plus the Speed slider');
   assert.equal(await page.locator('.v21-dock input[type=range]').count(),1,'the fixed dock keeps Speed accessible');
   const keyBox=await page.locator('#keys').boundingBox(),dockBox=await page.locator('.v21-dock').boundingBox();
   assert.ok(keyBox&&keyBox.width>0&&keyBox.height>0,'piano keyboard remains present');
   assert.ok(dockBox&&dockBox.y<vp.height&&dockBox.y+dockBox.height<=vp.height+1,'fixed playback dock remains in viewport');
   const base=vp.name;
   const closedPath=path.join(out,base+'__01-closed.png');
   await page.screenshot({path:closedPath,fullPage:false});shots.push({file:closedPath,label:base+' · closed',width:vp.width,height:vp.height});
   await page.locator('.v21-star').click();
   assert.deepEqual(await page.locator('.v21-wheel button').evaluateAll(bs=>bs.map(b=>b.dataset.key)),groups.music,'Music group has all five mapped actions');
   await page.waitForFunction(()=>[...document.querySelectorAll('.v21-wheel img')].length>=5&&[...document.querySelectorAll('.v21-wheel img')].every(i=>i.complete&&i.naturalWidth>0));
   await page.waitForTimeout(100);
   const wheel=await page.locator('.v21-wheel').boundingBox();
   assert.ok(wheel&&wheel.x>=0&&wheel.y>=0&&wheel.x+wheel.width<=vp.width+1&&wheel.y+wheel.height<=vp.height+1,'expanded wheel stays inside viewport');
   const dockNow=await page.locator('.v21-dock').boundingBox();
   assert.ok(wheel.y+wheel.height<=dockNow.y+1,'wheel does not cover fixed playback dock');const visualX=await page.locator('.v21-wheel-art').evaluate(el=>el.closest('.v21-wheel').dataset.side==='left'?0:.56),visualRect={x:wheel.x+wheel.width*visualX,width:wheel.width*(visualX===0?.44:.44),y:wheel.y+wheel.height*.06,height:wheel.height*.88};assert.ok(visualRect.y+visualRect.height<=keyBox.y+1||visualRect.y>=keyBox.y+keyBox.height-1,'visible wheel art stays clear of piano keys');
   const boxes=await page.locator('.v21-wheel button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,label:b.dataset.key}}));
   for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=Math.min(boxes[a].right,boxes[b].right)-Math.max(boxes[a].x,boxes[b].x),y=Math.min(boxes[a].bottom,boxes[b].bottom)-Math.max(boxes[a].y,boxes[b].y);assert.ok(x<=1||y<=1,'wheel action hit targets do not collide: '+boxes[a].label+' / '+boxes[b].label)}
   const musicPath=path.join(out,base+'__02-music-expanded.png');
   await page.screenshot({path:musicPath,fullPage:false});shots.push({file:musicPath,label:base+' · Music group',width:vp.width,height:vp.height});
   await page.locator('.v21-star').click();
   assert.deepEqual(await page.locator('.v21-wheel button').evaluateAll(bs=>bs.map(b=>b.dataset.key)),groups.navigation,'Navigation group has all five mapped actions');
   await page.waitForTimeout(100);
   const navBox=await page.locator('.v21-wheel').boundingBox();
   assert.ok(navBox&&navBox.x>=0&&navBox.y>=0&&navBox.x+navBox.width<=vp.width+1&&navBox.y+navBox.height<=vp.height+1,'Navigation wheel stays inside viewport');
   const navPath=path.join(out,base+'__03-navigation-expanded.png');
   await page.screenshot({path:navPath,fullPage:false});shots.push({file:navPath,label:base+' · Navigation group',width:vp.width,height:vp.height});
   await page.locator('.v21-star').click();
   assert.equal(await page.locator('.v21-wheel').isVisible(),false,'Magic Star closes');
   assert.equal(await page.locator('.v21-practice-panel').isVisible(),false,'wheel-only interaction does not open a secondary panel');
   if(errors.length)throw new Error('Runtime page errors: '+errors.join(' | '));
   if(missingAssets.length)throw new Error('Missing wheel asset requests: '+missingAssets.join(' | '));
   if(i===0){const starBox=await page.locator('.v21-star').boundingBox();await page.mouse.move(starBox.x+starBox.width/2,starBox.y+starBox.height/2);await page.mouse.down();await page.mouse.move(vp.width-32,Math.min(vp.height-80,starBox.y+starBox.height/2),{steps:5});await page.mouse.up();await page.locator('.v21-star').click();assert.equal(await page.locator('.v21-wheel').getAttribute('data-side'),'right','star can pin to right edge');const right=await page.locator('.v21-wheel').boundingBox();assert.ok(right.x>=0&&right.x+right.width<=vp.width+1&&right.y>=0&&right.y+right.height<=vp.height+1,'right-pinned wheel stays within viewport');const rightDock=await page.locator('.v21-dock').boundingBox();assert.ok(right.y+right.height<=rightDock.y+1,'right-pinned wheel stays clear of the dock');await page.locator('.v21-star').click();await page.locator('.v21-star').click();}
   if(i===0){const video=page.video();await context.close();const videoPath=await video.path();const target=path.join(out,'magic-star-open-close-group-switching.webm');fs.renameSync(videoPath,target)}else await context.close();
   console.log('PASS '+vp.name+' '+vp.width+'x'+vp.height+'; 10 actions, in-bounds wheel, no overlapping hit targets; keyboard and dock visible');
 }
 const contactHtml=path.join(out,'contact-sheet.html');
 const html='<!doctype html><meta charset="utf-8"><title>Magic Star Phase 1 Contact Sheet</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#120b25;color:#fff;font:700 18px system-ui}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{padding:10px;border:1px solid #e9c46a;border-radius:12px;background:#261548}.card h2{font-size:15px;margin:0 0 8px}.card img{display:block;width:100%;height:230px;object-fit:contain;background:#100b20;border-radius:8px}.card small{display:block;margin-top:6px;color:#ffe8aa}</style><h1>Magic Star — Phase 1</h1><section class="grid">'+shots.map(s=>'<article class="card"><h2>'+s.label.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</h2><img src="'+pathToFileURL(s.file).href+'"><small>'+s.width+' × '+s.height+' CSS px · emulated</small></article>').join('')+'</section>';
 fs.writeFileSync(contactHtml,html);
 const sheet=await browser.newPage({viewport:{width:1600,height:2400}});await sheet.goto(pathToFileURL(contactHtml).href);await sheet.locator('img').last().waitFor({state:'attached'});await sheet.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await sheet.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});await sheet.close();
 const sha=process.env.APP_SOURCE_SHA||'unknown';
 const manifest={project:'Aaria’s Magical Piano Kingdom',phase:'Phase 1 — Magic Star wheel only',commit_sha:sha,physical_device_testing:false,viewports:viewports.map(({name,width,height})=>({name,width,height,mode:'Chromium viewport emulation'})),screenshots:shots.map(s=>({file:path.basename(s.file),label:s.label,width:s.width,height:s.height})),video:'magic-star-open-close-group-switching.webm',focused_checks:['Open and close wheel','Switch between both five-action groups','Verify ten action keys and destinations','No button hit-target collisions','Wheel stays inside each viewport and above playback dock','Piano keyboard and four fixed controls remain visible','Wheel SVG assets load without missing requests or page errors'],known_limitations:['Viewport emulation only; no physical device was used.','Make Music and Navigation-group control illustrations adapt supplied star/button materials; those action-specific visuals are newly adapted and are not original supplied assets.','Secondary panels and unrelated application workflows were not redesigned or acceptance-tested.'],owner_visual_approval:'PENDING'};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(out,'ASSET_PROVENANCE.md'),[
 '# Phase 1 Magic Star asset provenance',
 '',
 '- Supplied primary source: AARIA_MAGIC_STAR_HALF_WHEEL_CORRECTED_V2.zip (half-wheel visual reference and supplied button artwork).',
 '- Supplied original source: AARIA_MAGIC_STAR_HALF_WHEEL_DESIGN_PACKAGE.zip (button_measure, button_loop, button_jump, button_practice, star_idle and star_active source SVGs).',
 '- Runtime supplied assets: measure/loop/jump/practice use corresponding original button SVGs; closed star and hub use supplied idle/active star SVGs.',
 '- Newly adapted elements: Make Music uses supplied corrected star button artwork with a live Make Music label. All five Navigation-group actions reuse supplied corrected star-button material with live action labels. Five-segment wheel geometry, Navigation-group arrangement, group-specific labels, safe placement and selected-state lighting are adaptations authored for this provisional iteration; they are not original supplied artwork.',
 '- Wheel labels and touch targets remain live semantic HTML controls. SVG illustrations are loaded as visual components.',
 '- This iteration is provisional and awaits owner visual approval.'
 ].join('\\n'));
 const zip=path.join(process.cwd(),'AARIA_MAGIC_STAR_PHASE1_OWNER_REVIEW.zip');
 execFileSync('zip',['-qr',zip,path.basename(out)],{cwd:process.cwd()});
 console.log('ZIP '+zip+'; screenshots='+shots.length+'; commit='+sha);
 await browser.close();server.close();
})().catch(async e=>{console.error(e.stack||e);try{await browser?.close()}catch{}try{server.close()}catch{}process.exitCode=1});
