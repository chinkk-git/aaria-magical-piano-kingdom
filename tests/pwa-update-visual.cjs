'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const out=path.resolve(process.env.EVIDENCE_DIR||path.join(root,'PWA_UPDATE_EVIDENCE'));
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end('not found: '+route);return}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)
  })
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.AariaPianoNavigation?.openNewSong&&!!window.PianoHeroVisual&&!!window.PianoGeometry);
    await page.evaluate(()=>{
      const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');
      if(gate)gate.hidden=true;
      if(app){app.inert=false;app.removeAttribute('aria-hidden')}
      document.body.classList.remove('r2-installing')
    });
    await page.waitForFunction(()=>window.AariaPwaUpdateState&&window.AariaPwaUpdateState.getState().phase!=='checking');
    const trigger=page.locator('.v21-overflow-trigger'),dot=page.locator('.v21-update-dot'),update=page.locator('#checkAppUpdate');
    await trigger.waitFor({state:'visible'});
    await page.evaluate(()=>{
      const indicator=document.querySelector('.v21-update-dot'),menuTrigger=document.querySelector('.v21-overflow-trigger'),button=document.querySelector('#checkAppUpdate'),status=document.querySelector('#appUpdateStatus');
      indicator.hidden=false;
      menuTrigger.setAttribute('aria-label','More app options, update available');
      button.disabled=false;
      button.textContent='Update Version';
      status.textContent='Update available: aaria-piano-v2.1.17. Tap Update Version when you are ready.';
      status.setAttribute('aria-busy','false')
    });
    assert.equal(await dot.isVisible(),true,'confirmed-update screenshot fixture shows dot');
    await page.screenshot({path:path.join(out,'pwa-update-android-portrait-dot.png')});
    await trigger.click();
    await page.locator('.v21-overflow-menu').waitFor({state:'visible'});
    assert.equal(await update.textContent(),'Update Version');
    await page.screenshot({path:path.join(out,'pwa-update-android-portrait-update-version.png')});
    await context.close();
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve))
  }
  console.log('Captured exactly two Android-sized portrait viewport screenshots (browser simulation; fixture state).')
})().catch(error=>{console.error(error);process.exitCode=1});
