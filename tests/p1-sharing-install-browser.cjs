#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root=process.cwd();
const evidence=process.env.EVIDENCE_DIR||path.join(root,'PR66_BROWSER_EVIDENCE');
const sourceSha=process.env.APP_SOURCE_SHA||'local';
fs.mkdirSync(evidence,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 let url;
 try{url=new URL(req.url,'http://127.0.0.1')}catch{res.writeHead(400).end();return}
 let decoded;try{decoded=decodeURIComponent(url.pathname)}catch{res.writeHead(400).end();return}
 const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/,'');
 const file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)});
});
const pixelUA='Mozilla/5.0 (Linux; Android 16; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const whatsappAndroidUA=pixelUA+' WhatsApp/2.24.20';
const iphoneUA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ipadUA='Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const desktopUA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
async function createPage(browser,viewport,userAgent,options={}){
 const context=await browser.newContext({viewport,userAgent,isMobile:/Mobile|iPhone|Android/i.test(userAgent),hasTouch:/Mobile|iPhone|Android|iPad/i.test(userAgent),serviceWorkers:'block'});
 if(options.standalone)await context.addInitScript(()=>{const original=window.matchMedia.bind(window);window.matchMedia=q=>q==='(display-mode: standalone)'?{matches:true,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true}}:original(q)});
 if(options.seed)await context.addInitScript(()=>{localStorage.setItem('pr66-review-retention-probe','keep');localStorage.setItem('aaria-piano-custom-songs-v1',JSON.stringify([{id:'custom-review-song',title:'Review Saved Song',total:1,barLengths:[6],events:[{bar:1,at:0,midi:60,dur:1}]}]))});
 return {context,page:await context.newPage()};
}
async function waitWelcome(page){await page.locator('#sharingWelcome[open]').waitFor({state:'visible'});await page.locator('.welcome-art').evaluate(img=>img.decode())}
async function capture(page,name){await page.screenshot({path:path.join(evidence,name),fullPage:false})}
async function fallback(page,expected){await page.getByRole('button',{name:'Install App'}).click();await page.locator('#installDialog[open]').waitFor({state:'visible'});const text=await page.locator('#installInstructions').innerText();assert.match(text,expected);assert.equal(await page.locator('#nativeInstall').isVisible(),false,'unsupported prompt must show guidance, not a fake native prompt');return text}
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const address=server.address();const base='http://127.0.0.1:'+address.port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});const version=browser.version();
 try{
  const thumb=await fetch(base+'/assets/social/aaria-piano-share.jpg');assert.equal(thumb.status,200);assert.match(thumb.headers.get('content-type')||'',/image\/jpeg/i);
  let {context,page}=await createPage(browser,{width:390,height:844},pixelUA);await page.goto(base+'/?welcome=1');await waitWelcome(page);assert.equal(await page.locator('#welcomeInstallApp').count(),1);assert.equal(await page.locator('#welcomeOpenApp').count(),1);await capture(page,'01-android-portrait-welcome.png');await context.close();
  ({context,page}=await createPage(browser,{width:844,height:390},pixelUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);await capture(page,'02-android-landscape-welcome.png');await context.close();
  ({context,page}=await createPage(browser,{width:390,height:844},pixelUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);const chromeHelp=await fallback(page,/Chrome.*Install app or Add to Home screen/i);await capture(page,'03-android-install-choice-fallback.png');await context.close();
  ({context,page}=await createPage(browser,{width:390,height:844},whatsappAndroidUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);const waHelp=await fallback(page,/In WhatsApp.*Open in browser.*In Chrome/i);await capture(page,'04-android-whatsapp-browser-fallback.png');await context.close();
  ({context,page}=await createPage(browser,{width:390,height:844},iphoneUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);await capture(page,'05-iphone-welcome.png');const iphoneHelp=await fallback(page,/In Safari.*Share.*Add to Home Screen/i);await capture(page,'06-iphone-add-to-home-screen.png');await context.close();
  ({context,page}=await createPage(browser,{width:820,height:1180},ipadUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);await capture(page,'07-ipad-portrait-welcome.png');const ipadHelp=await fallback(page,/In Safari.*Add to Home Screen/i);await capture(page,'08-ipad-install-guidance.png');await context.close();
  ({context,page}=await createPage(browser,{width:1180,height:820},ipadUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);await capture(page,'09-ipad-landscape-welcome.png');await context.close();
  ({context,page}=await createPage(browser,{width:1440,height:900},desktopUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);await capture(page,'10-desktop-welcome.png');const desktopHelp=await fallback(page,/browser menu.*Install app or Add to Home screen/i);await capture(page,'11-desktop-install-guidance.png');await context.close();
  ({context,page}=await createPage(browser,{width:390,height:844},desktopUA,{seed:true}));await page.goto(base+'/?welcome=1&keep=ok#review');await waitWelcome(page);assert.equal(await page.locator('#sharingWelcome .welcome-actions button').count(),2);await page.getByRole('button',{name:'Open in Browser'}).click();await page.waitForFunction(()=>!document.getElementById('sharingWelcome').open);assert.equal(new URL(page.url()).search,'?keep=ok');assert.equal(new URL(page.url()).hash,'#review');await page.locator('#rain').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>localStorage.getItem('pr66-review-retention-probe')),'keep');assert.equal(await page.locator('#songSelect option[value="custom-review-song"]').count(),1,'saved song must remain in the library');await capture(page,'12-open-in-browser-existing-app.png');await page.reload();await page.locator('#rain').waitFor({state:'visible'});assert.equal(await page.locator('#songSelect option[value="custom-review-song"]').count(),1,'saved song must survive app reload');await page.goto(base+'/?welcome=1');await waitWelcome(page);await page.reload();await waitWelcome(page);await context.close();
  ({context,page}=await createPage(browser,{width:390,height:844},desktopUA,{standalone:true}));await page.goto(base+'/?welcome=1');assert.equal(await page.locator('#sharingWelcome').evaluate(el=>el.open),false);await page.locator('#rain').waitFor({state:'visible'});await capture(page,'13-installed-standalone-bypass.png');await context.close();
  ({context,page}=await createPage(browser,{width:390,height:844},desktopUA));await page.goto(base+'/');assert.equal(await page.locator('#sharingWelcome').evaluate(el=>el.open),false);await page.locator('#rain').waitFor({state:'visible'});await capture(page,'14-normal-app-url.png');await context.close();
  ({context,page}=await createPage(browser,{width:390,height:844},pixelUA));await page.goto(base+'/?welcome=1');await waitWelcome(page);await page.evaluate(()=>{window.__promptCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});Object.defineProperty(event,'prompt',{value:async()=>{window.__promptCalls++}});window.dispatchEvent(event)});await page.getByRole('button',{name:'Install App'}).click();await page.waitForFunction(()=>window.__promptCalls===1);assert.equal(await page.evaluate(()=>window.__promptCalls),1);await page.waitForFunction(()=>!document.getElementById('installDialog').open);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__promptCalls),1);await context.close();
  const result={sourceSha,chromium:version,baseUrl:base,thumbnail:{status:thumb.status,contentType:thumb.headers.get('content-type')},results:{androidChromeFallback:chromeHelp,whatsappAndroidFallback:waHelp,iphoneGuidance:iphoneHelp,ipadGuidance:ipadHelp,desktopGuidance:desktopHelp,nativePromptHook:'PASS with a synthetic beforeinstallprompt event; no native OS install dialog was claimed',returningVisitor:'PASS (refresh on sharing URL)',standalone:'PASS (display-mode emulation)',normalRoute:'PASS',queryHashPreservation:'PASS',localStorageRetentionProbe:'PASS'}};
  fs.writeFileSync(path.join(evidence,'BROWSER-TEST-RESULTS.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(evidence,'BROWSER-VERSION.txt'),'Playwright 1.62.1 / Chromium '+version+'\nViewport and user-agent emulation; not physical devices or native Safari.\n');fs.copyFileSync(path.join(root,'assets/social/aaria-piano-share.jpg'),path.join(evidence,'15-approved-social-thumbnail.jpg'));console.log(JSON.stringify(result));
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
