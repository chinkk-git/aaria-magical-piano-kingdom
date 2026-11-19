'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const oldWorker=fs.readFileSync(path.join(__dirname,'fixtures/sw-v1.18.1.js'),'utf8');
const newWorker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const installer=fs.readFileSync(path.join(root,'r2-install.js'),'utf8');
const shellName='aaria-piano-v1.19.0';
assert.match(newWorker,/const CACHE='aaria-piano-v1\.19\.0'/);
for(const url of [
  './r2-music.js?v=aaria-piano-r2.2',
  './r2-image.js?v=aaria-piano-r2.1',
  './piano-hero-v2.css?v=aaria-piano-v1.13.0',
  './song-import.js?v=aaria-piano-r2.3',
  './my-songs.js?v=aaria-piano-r2.3',
  './r2-install.js?v=aaria-piano-r2.5'
]){
  assert.ok(index.includes(url),`HTML references ${url}`);
  assert.ok(newWorker.includes(url),`worker precaches ${url}`);
}
assert.match(index,/id="appBuildInfo"[^>]*>App build: aaria-piano-v1\.19\.0/);
assert.match(installer,/__aariaPwaUpdateReloadBound/);
assert.match(installer,/location\.reload\(\)/);
assert.ok(newWorker.includes("/^aaria-piano-v\\d+\\.\\d+\\.\\d+$/.test(key)"),'activation only removes prior versioned app-shell caches');

const smokePage='<!doctype html><meta charset="utf-8"><title>PWA update check</title><p>Upgrade fixture</p>';
let servedWorker=oldWorker;
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/sw.js'){
    res.writeHead(200,{'content-type':contentTypes['.js'],'cache-control':'no-cache'});
    res.end(servedWorker);return;
  }
  if(pathname==='/upgrade-check.html'){
    res.writeHead(200,{'content-type':contentTypes['.html']});res.end(smokePage);return;
  }
  const file=pathname==='/'?path.join(root,'index.html'):path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return}
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{'content-type':contentTypes[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);return;
  }
  // The shell worker precaches OMR payloads. This test isolates update/cache behavior
  // and supplies inert bytes for large runtime/model files not present in source checkout.
  res.writeHead(200,{'content-type':'application/octet-stream'});res.end('fixture-payload');
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.goto(origin+'/upgrade-check.html');
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
    assert.ok(before.caches.includes('aaria-piano-v1.18.1'),'previous production shell cache is installed');

    await page.evaluate(()=>{window.__oldServiceWorker=navigator.serviceWorker.controller});
    servedWorker=newWorker;
    await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.getRegistration('./');
      await registration.update();
    });
    await page.waitForFunction(async name=>{
      const keys=await caches.keys();
      return keys.includes(name)&&!keys.includes('aaria-piano-v1.18.1');
    },shellName,{timeout:30000});
    await page.waitForFunction(()=>navigator.serviceWorker.controller&&navigator.serviceWorker.controller!==window.__oldServiceWorker,{timeout:10000});

    const result=await page.evaluate(async()=>{
      const keys=await caches.keys();
      const library=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('aaria-piano-library',2);
        req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('songs','readonly'),get=tx.objectStore('songs').get('kept-song');get.onsuccess=()=>{const song=get.result;db.close();resolve(song)};get.onerror=()=>reject(get.error)};
      });
      const verified=await (await caches.open('aaria-piano-r2-install-v1')).match('./models/verified-fixture.onnx');
      const shell=await caches.open('aaria-piano-v1.19.0');
      const script=await shell.match('./song-import.js?v=aaria-piano-r2.3');
      const libraryScript=await shell.match('./my-songs.js?v=aaria-piano-r2.3');
      const styles=await shell.match('./piano-hero-v2.css?v=aaria-piano-v1.13.0');
      const html=await shell.match('./index.html');
      return {
        keys,
        song:JSON.parse(localStorage.getItem('aaria-piano-custom-songs-v1')||'[]').find(s=>s.id==='kept-song'),
        favorite:JSON.parse(localStorage.getItem('aaria-piano-favorites-v1')||'[]').includes('kept-song'),
        idbSong:library,
        verifiedModel:await verified?.text(),
        script:await script?.text(),libraryScript:await libraryScript?.text(),styles:await styles?.text(),html:await html?.text()
      };
    });
    assert.ok(!result.keys.includes('aaria-piano-v1.18.1'),`old app-shell cache is retired; caches remaining: ${result.keys.join(', ')}`);
    assert.ok(result.keys.includes('aaria-piano-r2-install-v1'),'verified OMR cache is retained');
    assert.equal(result.song?.title,'Saved fixture');assert.equal(result.idbSong?.title,'Saved fixture');
    assert.equal(result.favorite,true);assert.equal(result.verifiedModel,'verified-model-marker');
    assert.match(result.script,/await lib\.saveSong\(draftSong\)/,'updated automatic save code is cached');
    assert.match(result.libraryScript,/songPickerButton/,'updated custom song selector code is cached');
    assert.match(result.styles,/app-build-info/,'updated stylesheet is cached');
    assert.match(result.html,/id="songPickerButton"/,'updated song selector HTML is cached');
    assert.match(result.html,/id="zoomKeys"/,'Zoom Keys control remains available');
    assert.match(result.html,/id="appBuildInfo"[^>]*>App build: aaria-piano-v1\.19\.0/,'Settings build identifier is available');
    assert.match(result.html,/Speed/,'updated playback label is available');
    console.log('PWA update upgrade passed: prior shell replaced, updated UI assets cached, localStorage/IndexedDB songs and favorites retained, verified OMR cache retained.');
    await context.close();
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
