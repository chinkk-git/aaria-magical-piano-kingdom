'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const oldWorker=fs.readFileSync(path.join(__dirname,'fixtures/sw-v1.20.2.js'),'utf8');
const oldShell=fs.readFileSync(path.join(__dirname,'fixtures/installed-shell-v1.20.2.html'),'utf8');
const newWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const installer=fs.readFileSync(path.join(root,'r2-install.js'),'utf8');
const shellName='aaria-piano-v1.20.4';
assert.match(newWorker,/const CACHE='aaria-piano-v1\.20\.4'/);
for(const url of [
  './r2-music.js?v=aaria-piano-r2.2',
  './r2-image.js?v=aaria-piano-r2.1',
  './piano-hero-v2.css?v=aaria-piano-v1.14.0',
  './song-import.js?v=aaria-piano-r2.4',
  './my-songs.js?v=aaria-piano-r2.4',
  './r2-install.js?v=aaria-piano-r2.7'
]){
  assert.ok(index.includes(url),`HTML references ${url}`);
  assert.ok(newWorker.includes(url),`worker precaches ${url}`);
}
assert.match(index,/id="appBuildInfo"[^>]*>Installed build: checking…/);
assert.match(installer,/__aariaPwaUpdateReloadBound/);
assert.match(installer,/location\.reload\(\)/);
assert.match(installer,/await registration\.update\(\)/,'the current shell explicitly checks for an update on each launch');
assert.ok(index.includes('Check for Updates'),'Settings includes an update action');
assert.ok(newWorker.includes("/^aaria-piano-v\\d+\\.\\d+\\.\\d+$/.test(key)"),'activation only removes prior versioned app-shell caches');
assert.match(newWorker,/if\(!self\.registration\.active\)await self\.skipWaiting\(\)/,'updates wait for the user while first install still controls the app');
assert.match(newWorker,/AARIA_ACTIVATE_UPDATE/,'Restart App activates a waiting update');
assert.match(fs.readFileSync(path.join(root,'pwa-update.js'),'utf8'),/busy=true;check\.disabled=true;setStatus\('Checking…',true\);try\{if\(!root\.navigator\.onLine\)/,'the check is serialized before asynchronous multi-tab coordination');

let servedWorker=oldWorker;
let serveNewShell=false;
let versionCheckRequests=0,versionCheckStatus=200,versionCheckWorker=null;
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const requestUrl=new URL(req.url,'http://localhost');
  const pathname=decodeURIComponent(requestUrl.pathname);
  if(pathname==='/sw.js'){
    const isVersionCheck=requestUrl.searchParams.has('version-check');
    if(isVersionCheck)versionCheckRequests++;
    res.writeHead(isVersionCheck?versionCheckStatus:200,{'content-type':contentTypes['.js'],'cache-control':'no-cache'});
    res.end(isVersionCheck?(versionCheckWorker||servedWorker):servedWorker);return;
  }
  if((pathname==='/'||pathname==='/index.html')&&!serveNewShell){
    res.writeHead(200,{'content-type':contentTypes['.html']});res.end(oldShell);return;
  }
  const file=pathname==='/'?path.join(root,'index.html'):path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return}
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{'content-type':contentTypes[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);return;
  }
  // The shell worker is tested separately from model bytes; the default route
  // supplies inert fixture responses for requests made by this upgrade test.
  res.writeHead(200,{'content-type':'application/octet-stream'});res.end('fixture-payload');
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.goto(origin+'/');
    assert.deepEqual((await page.locator('#playbackModeControls button').allTextContents()).map(x=>x.trim()),['🔊 Listen','🔊 Listen On'],'the previous v1.20.2 shell reproduces the duplicate Listen controls');
    assert.equal(await page.locator('button.listen-toggle').count(),1,'the old UI already contains one preference toggle');
    await page.evaluate(async()=>{
      await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      localStorage.setItem('aaria-piano-custom-songs-v1',JSON.stringify([{id:'kept-song',title:'Saved fixture',notes:[{midi:60,start:0,duration:1}]}]));
      localStorage.setItem('aaria-piano-favorites-v1',JSON.stringify(['kept-song']));
      await new Promise((resolve,reject)=>{
        const req=indexedDB.open('aaria-piano-library',2);
        req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('songs'))db.createObjectStore('songs',{keyPath:'id'});if(!db.objectStoreNames.contains('sources'))db.createObjectStore('sources',{keyPath:'songId'});};
        req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('songs','readwrite');tx.objectStore('songs').put({id:'kept-song',title:'Saved fixture',notes:[{midi:60,start:0,duration:1}]});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};
      });
      const verified=await caches.open('aaria-piano-r2-install-v1');
      await verified.put('./models/verified-fixture.onnx',new Response('verified-model-marker',{headers:{'X-Aaria-Install-SHA256':'fixture-sha256','X-Aaria-Install-Bytes':'21'}}));
    });
    const before=await page.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,caches:await caches.keys()}));
    assert.ok(before.controller,'previous worker controls the fixture before upgrade');
    assert.ok(before.caches.includes('aaria-piano-v1.20.2'),'previous production shell cache is installed');

    await page.evaluate(()=>{window.__oldServiceWorker=navigator.serviceWorker.controller});
    serveNewShell=true;
    servedWorker=newWorker;
    await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.getRegistration('./');
      await registration.update();
    });
    await page.waitForFunction(async()=>{const registration=await navigator.serviceWorker.getRegistration('./');return !!registration?.waiting||registration?.installing?.state==='installed'||(registration?.active&&registration.active!==window.__oldServiceWorker)},null,{timeout:30000});
    await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.getRegistration('./');
      const worker=registration?.waiting||registration?.installing;
      if(worker)worker.postMessage({type:'AARIA_ACTIVATE_UPDATE'});
    });
    await page.waitForFunction(async name=>{
      const keys=await caches.keys();
      return keys.includes(name)&&!keys.includes('aaria-piano-v1.20.2');
    },shellName,{timeout:30000});
    await page.waitForFunction(()=>navigator.serviceWorker.controller&&navigator.serviceWorker.controller!==window.__oldServiceWorker,{timeout:10000});
    await page.close();
    const reopened=await context.newPage();
    await reopened.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await reopened.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong,{timeout:15000});
    assert.equal(await reopened.locator('#release2InstallGate').count(),0,'reopening after upgrade shows no OMR installation gate');
    assert.equal(await reopened.locator('body').evaluate(el=>el.innerText.includes('Warning: truncated output')||el.innerText.includes('Total output lines: 196')),false,'reopening after upgrade shows no leaked source warning');
    assert.equal(await reopened.locator('#pianoApp').getAttribute('inert'),null,'the piano is interactive after reopening');
    assert.equal((await reopened.locator('#secondaryModeButton').innerText()).trim(),'♫ Play Song','the updated song-play action replaces the old Listen label');
    assert.equal(await reopened.locator('#playbackModeControls button.listen-toggle').count(),1,'one Listen preference toggle remains after upgrade');
    await reopened.locator('#setupKeyboard').click();
    await reopened.locator('#appBuildInfo').waitFor({state:'visible'});
    await reopened.waitForFunction(()=>document.querySelector('#appBuildInfo')?.textContent.includes('aaria-piano-v1.20.4'));
    await reopened.locator('#checkAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes("You're up to date"),{timeout:15000});
    await reopened.screenshot({path:'/tmp/pwa-update-settings.png'});
    await context.setOffline(true);
    await reopened.locator('#checkAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent==='Offline');
    await context.setOffline(false);

    const beforeMultiTab=versionCheckRequests;
    const busyTab=await context.newPage();
    await busyTab.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await busyTab.waitForFunction(()=>!!window.AariaPwaUpdateCore);
    await busyTab.evaluate(()=>{window.AariaPianoPlaybackIsBusy=()=>true});
    await reopened.locator('#checkAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes('Pause playback and finish'),{timeout:5000});
    assert.equal(versionCheckRequests,beforeMultiTab,'an active second tab prevents the network version request');
    await busyTab.close();

    await reopened.evaluate(()=>{window.AariaSongImportIsBusy=()=>true});
    const beforeImportBusy=versionCheckRequests;
    await reopened.locator('#checkAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes('Pause playback and finish'),{timeout:5000});
    assert.equal(versionCheckRequests,beforeImportBusy,'an active import prevents the network version request');
    await reopened.evaluate(()=>{window.AariaSongImportIsBusy=()=>false});

    const beforeRapidClicks=versionCheckRequests;
    await reopened.evaluate(()=>{const button=document.querySelector('#checkAppUpdate');button.dispatchEvent(new MouseEvent('click',{bubbles:true}));button.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes("You're up to date"),{timeout:15000});
    assert.equal(versionCheckRequests-beforeRapidClicks,1,'rapid duplicate clicks issue exactly one version request');

    versionCheckWorker=oldWorker;
    await reopened.locator('#checkAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes('published build is older'),{timeout:10000});
    versionCheckWorker=null;

    versionCheckStatus=503;
    await reopened.locator('#checkAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes('version could not be checked'),{timeout:10000});
    versionCheckStatus=200;

    const result=await reopened.evaluate(async()=>{
      const keys=await caches.keys();
      const library=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('aaria-piano-library',2);
        req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('songs','readonly'),get=tx.objectStore('songs').get('kept-song');get.onsuccess=()=>{const song=get.result;db.close();resolve(song)};get.onerror=()=>reject(get.error)};
      });
      const verified=await (await caches.open('aaria-piano-r2-install-v1')).match('./models/verified-fixture.onnx');
      const shell=await caches.open('aaria-piano-v1.20.4');
      const script=await shell.match('./song-import.js?v=aaria-piano-r2.4');
      const updater=await shell.match('./pwa-update.js?v=aaria-pwa-update-1.0');
      const libraryScript=await shell.match('./my-songs.js?v=aaria-piano-r2.4');
      const styles=await shell.match('./piano-hero-v2.css?v=aaria-piano-v1.14.0');
      const html=await shell.match('./index.html');
      return {
        keys,
        song:JSON.parse(localStorage.getItem('aaria-piano-custom-songs-v1')||'[]').find(s=>s.id==='kept-song'),
        favorite:JSON.parse(localStorage.getItem('aaria-piano-favorites-v1')||'[]').includes('kept-song'),
        idbSong:library,
        verifiedModel:await verified?.text(),
        script:await script?.text(),updater:await updater?.text(),libraryScript:await libraryScript?.text(),styles:await styles?.text(),html:await html?.text()
      };
    });
    assert.ok(!result.keys.includes('aaria-piano-v1.20.2'),`old app-shell cache is retired; caches remaining: ${result.keys.join(', ')}`);
    assert.ok(result.keys.includes('aaria-piano-r2-install-v1'),'verified OMR cache is retained');
    assert.match(result.updater,/AariaPwaUpdateCore/,'the updater is cached in the new shell');
    assert.equal(result.song?.title,'Saved fixture');assert.equal(result.idbSong?.title,'Saved fixture');
    assert.equal(result.favorite,true);assert.equal(result.verifiedModel,'verified-model-marker');
    assert.match(result.script,/await lib\.saveSong\(draftSong\)/,'updated automatic save code is cached');assert.match(result.script,/Add New Song/,'new workshop flow is cached');
    assert.match(result.libraryScript,/songPickerButton/,'updated custom song selector code is cached');assert.match(result.libraryScript,/Add New Song/,'library entry is renamed in the cached app');assert.match(result.libraryScript,/Delete Song/,'custom songs remain deletable in the updated shell');
    assert.match(result.styles,/app-build-info/,'updated stylesheet is cached');
    assert.match(result.html,/id="songPickerButton"/,'updated song selector HTML is cached');assert.ok(!result.html.includes('release2InstallGate'),'updated shell no longer has the startup gate');
    assert.match(result.html,/id="zoomKeys"/,'Zoom Keys control remains available');
    assert.match(result.html,/id="appBuildInfo"[^>]*>Installed build: checking…/,'Settings resolves the installed build from its worker');
    assert.match(result.html,/Speed/,'updated playback label is available');assert.match(result.html,/id="listenToggle"/,'Listen preference control is in the updated shell');assert.match(result.html,/note-impact-style/,'note impact key glow styling is in the updated shell');assert.match(result.html,/spawnNoteExplosion/,'note impact implementation is in the updated shell');assert.match(result.html,/NOTE_FX_DURATION\*1000/,'note flash uses millisecond timing in the updated shell');
    console.log('PWA update-and-reopen passed: prior v1.19.0 shell and warning/gate were replaced; current Piano Hero opened without OMR setup; localStorage/IndexedDB songs, favorites and verified OMR cache remained intact.');

    const futureWorker=newWorker.replace("const CACHE='aaria-piano-v1.20.4'","const CACHE='aaria-piano-v1.20.5'");
    assert.notEqual(futureWorker,newWorker,'future worker fixture advances the authoritative build identifier');
    versionCheckWorker=futureWorker;servedWorker=futureWorker;
    await reopened.locator('#checkAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes('Update available. Restart App when you are ready.'),null,{timeout:15000});
    assert.equal(await reopened.locator('#restartAppUpdate').isVisible(),true,'a waiting worker exposes the explicit Restart App action');
    await reopened.locator('#restartAppUpdate').click();
    await reopened.waitForFunction(()=>document.querySelector('#appUpdateStatus')?.textContent.includes('Update installed and verified: aaria-piano-v1.20.5'),null,{timeout:20000});
    await reopened.waitForFunction(()=>document.querySelector('#appBuildInfo')?.textContent.includes('aaria-piano-v1.20.5'),null,{timeout:10000});
    const afterConfirmedRestart=await reopened.evaluate(async()=>({build:document.querySelector('#appBuildInfo')?.textContent,status:document.querySelector('#appUpdateStatus')?.textContent,caches:await caches.keys(),song:JSON.parse(localStorage.getItem('aaria-piano-custom-songs-v1')||'[]').find(s=>s.id==='kept-song'),favorite:JSON.parse(localStorage.getItem('aaria-piano-favorites-v1')||'[]').includes('kept-song'),verified:await(await caches.open('aaria-piano-r2-install-v1')).match('./models/verified-fixture.onnx')?.text()}));
    assert.match(afterConfirmedRestart.build,/aaria-piano-v1.20.5/,'Settings reports the new worker build after restart');
    assert.match(afterConfirmedRestart.status,/Update installed and verified: aaria-piano-v1.20.5/,'restart is confirmed only after the active worker reports the expected build');
    assert.ok(afterConfirmedRestart.caches.includes('aaria-piano-v1.20.5'));
    assert.ok(!afterConfirmedRestart.caches.includes('aaria-piano-v1.20.4'),'the prior app-shell cache is retired');
    assert.equal(afterConfirmedRestart.song?.title,'Saved fixture','confirmed restart preserves the saved song');
    assert.equal(afterConfirmedRestart.favorite,true,'confirmed restart preserves favorites');
    assert.equal(afterConfirmedRestart.verified,'verified-model-marker','confirmed restart preserves the verified OMR cache');
    console.log('Safe update restart passed: a user-confirmed waiting worker activated, reloaded, verified v1.20.5, and retained songs, favorites and OMR cache.');
    await context.close();

    const freshContext=await browser.newContext();
    const fresh=await freshContext.newPage();
    await fresh.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await fresh.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong&&window.AariaR2Installer);
    assert.equal(await fresh.locator('#release2InstallGate').count(),0,'fresh installs never render the OMR installation gate');
    const freshState=await fresh.evaluate(async()=>({installer:window.AariaR2Installer.state,inert:document.querySelector('#pianoApp')?.inert,caches:await caches.keys()}));
    assert.equal(freshState.installer,'idle','fresh launch does not start OMR download or validation');
    assert.equal(freshState.inert,false,'piano controls are immediately available on fresh launch');
    assert.ok(!freshState.caches.includes('aaria-piano-r2-install-v1'),'fresh launch does not create or populate the verified OMR cache');
    await freshContext.close();
    console.log('Fresh-install startup passed: Piano Hero is immediately interactive and OMR remains idle until Make Music.');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
