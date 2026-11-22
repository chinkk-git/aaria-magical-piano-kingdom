'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'AARIA_HERO_ROYAL_DEFAULT_REVIEW');
const shots=path.join(out,'screenshots');
const zip=path.join(root,'AARIA_HERO_ROYAL_DEFAULT_REVIEW.zip');
const sha=process.env.APP_SOURCE_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const viewports=[
 {device:'Android portrait',width:390,height:844,mobile:true},
 {device:'Android landscape',width:844,height:390,mobile:true},
 {device:'iPad portrait',width:834,height:1194,mobile:true},
 {device:'iPad landscape',width:1194,height:834,mobile:true},
 {device:'Desktop',width:1440,height:900,mobile:false}
];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.webmanifest':'application/manifest+json'};
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(shots,{recursive:true});
const server=http.createServer((req,res)=>{
 const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)});
});
const results=[];let browser;
async function openViewport(v){
 const context=await browser.newContext({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,isMobile:v.mobile,hasTouch:v.mobile,serviceWorkers:'allow',reducedMotion:'reduce'});
 // Simulate an existing installation with a legacy Classic preference and no scenery choice.
 await context.addInitScript(()=>{if(!sessionStorage.getItem('hero-royal-test-initialized')){localStorage.setItem('aaria-piano-layout-v1','classic');localStorage.removeItem('aaria-royal-hall-preview-v1');localStorage.setItem('theme-test-owner-data','keep-me');sessionStorage.setItem('hero-royal-test-initialized','yes')}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.AariaV21Engine&&window.PianoHeroVisual&&document.querySelector('#rain')?.width>0&&document.querySelector('#keys .white'));
 await page.evaluate(()=>{const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');if(gate)gate.hidden=true;if(app){app.inert=false;app.removeAttribute('aria-hidden')}document.body.classList.remove('r2-installing')});
 await page.waitForFunction(()=>document.documentElement.dataset.royalHall==='on'&&document.querySelector('#royalHallScenery')&&!document.querySelector('#royalHallScenery').hidden);
 return{context,page,errors};
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const launch={headless:true,args:['--no-sandbox']};
 if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)launch.executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
 browser=await chromium.launch(launch);
 for(const [index,v] of viewports.entries()){
  const {context,page,errors}=await openViewport(v);
  const initial=await page.evaluate(()=>({layout:window.AariaV21Engine.state().layout,mainLayout:document.querySelector('main').dataset.pianoLayout,rootLayout:document.documentElement.dataset.pianoLayout,theme:document.querySelector('#royalHallTheme').value,sceneHidden:document.querySelector('#royalHallScenery').hidden,preference:localStorage.getItem('aaria-royal-hall-preview-v1'),legacyLayoutPreference:localStorage.getItem('aaria-piano-layout-v1'),classicOptionCount:document.querySelectorAll('#pianoLayoutSelect option[value="classic"]').length,layoutControlHidden:document.querySelector('#pianoLayoutSelect').hidden,visibleText:document.body.innerText,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,sceneryImages:[...document.querySelectorAll('#royalHallScenery img')].map(i=>({src:new URL(i.src).pathname,complete:i.complete,naturalWidth:i.naturalWidth})),roofHidden:document.querySelector('#royalVaultRoof').hidden,ownerData:localStorage.getItem('theme-test-owner-data')}));
  assert.equal(initial.layout,'hero',`${v.device}: legacy Classic preference must not restore Classic gameplay`);
  assert.equal(initial.mainLayout,'hero',`${v.device}: initial main markup must be Hero before initialization`);
  assert.equal(initial.rootLayout,'hero',`${v.device}: root layout must be Hero`);
  assert.equal(initial.theme,'royal',`${v.device}: Royal Hall must default on`);
  assert.equal(initial.sceneHidden,false,`${v.device}: Royal Hall must be visible`);
  assert.equal(initial.preference,null,`${v.device}: default theme must not be redundantly saved`);
  assert.equal(initial.classicOptionCount,0,`${v.device}: no Classic layout option may be offered`);
  assert.equal(initial.layoutControlHidden,true,`${v.device}: internal layout select must not be user-facing`);
  assert.ok(!initial.visibleText.includes('Classic Piano'),`${v.device}: visible UI must not mention Classic Piano`);
  assert.ok(initial.scrollWidth<=initial.viewportWidth,`${v.device}: no horizontal overflow`);
  assert.equal(initial.ownerData,'keep-me',`${v.device}: unrelated local data remains intact`);
  assert.ok(initial.sceneryImages.length>=4&&initial.sceneryImages.every(i=>i.complete&&i.naturalWidth>0),`${v.device}: approved hall assets load`);
  if(v.width>=1100)assert.equal(initial.roofHidden,false,`${v.device}: Hero vaulted architecture visible`);
  const controls=await page.evaluate(()=>['.v21-star','.v21-make-music'].map(sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();return{selector:sel,visible:!!el&&!el.hidden&&r.width>0&&r.height>0,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}}));
  assert.ok(controls.every(c=>c.visible&&c.inside),`${v.device}: Magic Star and Make Music are visible within the viewport`);
  const screenshot=`${String(index+1).padStart(2,'0')}-${v.device.toLowerCase().replaceAll(' ','-')}-${v.width}x${v.height}-hero-royal-default.png`;
  await page.screenshot({path:path.join(shots,screenshot),fullPage:false,animations:'disabled'});
  if(index===0){
   const beforeState=await page.evaluate(()=>window.AariaV21Engine.state());
   await page.evaluate(()=>window.AariaOpenSettings());
   const settingsText=await page.locator('#keyboardSetupDialog').innerText();
   assert.ok(!settingsText.includes('Classic Piano'),'settings do not offer Classic Piano');
   await page.locator('#royalHallTheme').selectOption('off');await page.locator('#closeKeyboardSetup').click();
   await page.waitForFunction(()=>document.documentElement.dataset.royalHall==='off');
   assert.equal(await page.evaluate(()=>localStorage.getItem('aaria-royal-hall-preview-v1')),'off','intentional scenery choice persists');
   assert.deepEqual(await page.evaluate(()=>({layout:AariaV21Engine.state().layout,song:AariaV21Engine.state().songId,measure:AariaV21Engine.state().currentMeasure})),{layout:beforeState.layout,song:beforeState.songId,measure:beforeState.currentMeasure},'theme selection does not reset active song/layout/measure');
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AariaV21Engine&&document.documentElement.dataset.royalHall==='off');
   assert.equal(await page.evaluate(()=>AariaV21Engine.state().layout),'hero','reload ignores legacy Classic layout preference');
   await page.evaluate(()=>window.AariaOpenSettings());await page.locator('#royalHallTheme').selectOption('royal');await page.locator('#closeKeyboardSetup').click();
   await page.waitForFunction(()=>document.documentElement.dataset.royalHall==='on');
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.AariaV21Engine&&document.documentElement.dataset.royalHall==='on');
   assert.equal(await page.evaluate(()=>AariaV21Engine.state().layout),'hero','saved Hero remains selected after reload');
   await page.locator('.v21-star').click();await page.waitForFunction(()=>document.querySelector('.v21-wheel')?.dataset.state==='open');
   assert.deepEqual(await page.locator('.v21-wheel-hit').evaluateAll(bs=>bs.map(b=>b.dataset.key)),['measure','loop','jump','practice','songSettings'],'Magic Star retains five actions');
   await page.locator('.v21-wheel-center-hit').click();await page.waitForFunction(()=>document.querySelector('.v21-wheel')?.dataset.state==='closed');
   await page.locator('.v21-make-music').click();await page.locator('#localSongWizard[open]').waitFor({state:'visible'});
   await page.locator('#localSongWizard button').filter({hasText:/close|cancel/i}).first().click().catch(()=>{});
  }
  if(errors.length)throw new Error(`${v.device} browser errors: ${errors.join(' | ')}`);
  results.push({device:v.device,width:v.width,height:v.height,screenshot,layout:'hero',theme:'royal',classicSelectable:false,sceneAssets:initial.sceneryImages.length,controls});
  await context.close();
 }
 const summary={sourceCommit:sha,browser:'Playwright Chromium responsive and touch emulation, DPR 1',physicalDevicesTested:false,scenarios:['Legacy saved Classic preference ignored','Royal Hall is the missing-preference default','Explicit scenery choice persists across reload','Theme changes preserve layout/song/measure','Magic Star five actions and center close interaction','Make Music opens the song workshop'],viewports:results,limitations:['Installed PWA shell and a real offline launch were not executed on physical Android/iPad hardware; browser viewport screenshots are emulated.','PR #66 remains separate and unmodified; its shared-link welcome behavior is not included in this branch.']};
 fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify(summary,null,2)+'\n');
 fs.writeFileSync(path.join(out,'README.md'),`# Hero + Royal Concert Hall default evidence\n\nSource commit: \`${sha}\`. Screenshots are actual Playwright Chromium renders at DPR 1; mobile and tablet viewports use touch emulation. No physical device was used.\n\nEvery screenshot loads with a legacy saved \`classic\` layout preference and no saved scenery preference. The assertions confirm Hero is active before and after refresh, Royal Hall is visible by default, Classic is absent from visible settings and hidden from internal controls, and the owner-data probe is unchanged. The interaction checks confirm the Magic Star's five actions and center close behavior, plus the Make Music workshop opening.\n\nThe test also switches scenery to the alternate magical stage, verifies that this deliberate preference persists after reload, then restores Royal Hall and verifies persistence. Theme selection leaves the active layout, song and measure untouched.\n\nPhysical installed-PWA and true offline-device launches remain unverified. PR #66 (WhatsApp Smart Install) was not modified; its welcome-screen behavior is not merged into this source. See \`test-results.json\` for source and per-viewport evidence.\n`);
 try{fs.unlinkSync(zip)}catch{}
 execFileSync('python3',['-c','import os,sys,zipfile\nroot,archive=sys.argv[1:3]\nwith zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as z:\n for base,_,files in os.walk(root):\n  for name in files:\n   p=os.path.join(base,name); z.write(p,os.path.relpath(p,root))',out,zip]);
 execFileSync('python3',['-c','import sys,zipfile\np=sys.argv[1]\nwith zipfile.ZipFile(p) as z:\n bad=z.testzip(); assert bad is None,bad\n print("ZIP integrity PASS; entries:",len(z.namelist()))',zip],{stdio:'inherit'});
 console.log(JSON.stringify({zip,summary},null,2));
 await browser.close();await new Promise(resolve=>server.close(resolve));
})().catch(async error=>{console.error(error);try{await browser?.close()}catch{}try{server.close()}catch{}process.exitCode=1});
