'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]||'_site');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.stat(file,(se,st)=>{if(se||!st.isFile()){res.writeHead(404).end('not found');return}
  const range=req.headers.range;
  if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m){res.writeHead(416).end();return}const start=Number(m[1]),end=Math.min(m[2]?Number(m[2]):st.size-1,st.size-1);if(start>end||start>=st.size){res.writeHead(416).end();return}res.writeHead(206,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${st.size}`,'Accept-Ranges':'bytes','Cache-Control':'no-store'});fs.createReadStream(file,{start,end}).pipe(res);return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':st.size,'Accept-Ranges':'bytes','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res)
 })
});
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><work><work-title>Ground Truth Piano Exercise</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
<measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><barline location="right"><bar-style>regular</bar-style></barline></measure>
<measure number="2">
<note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><barline location="right"><bar-style>light-heavy</bar-style></barline></measure></part></score-partwise>`;
const expected=[67,69,71,72,74,72,71,67];
function analyse(result){return result.events||[]}
async function recognize(page,b64){
 return page.evaluate(async b64=>new Promise((resolve,reject)=>{
  const worker=new Worker('./omr-worker.js',{type:'module'});let id=0;const pending=new Map();let readyResolve,readyReject;
  const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j});const timer=setTimeout(()=>{readyReject(Error('OMR engine did not initialize within 10 minutes'))},600000);
  worker.onmessage=({data})=>{if(data.type==='progress')return;if(data.type==='ready'){clearTimeout(timer);readyResolve();return}if(data.type==='error'&&data.id==null){readyReject(Error(data.msg||'OMR init failed'));return}if(data.type==='result'||data.type==='error'){const t=pending.get(data.id);if(!t)return;pending.delete(data.id);data.type==='result'?t.resolve(data):t.reject(Error(data.msg||'OMR step failed'))}};
  worker.onerror=e=>readyReject(Error(e.message||'OMR worker error'));worker.postMessage({type:'init',noGpu:true,ios:false});
  const ask=(data,transfer=[])=>new Promise((r,j)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);j(Error('OMR '+data.type+' timed out after 10 minutes'))},600000);pending.set(n,{resolve:v=>{clearTimeout(timer);r(v)},reject:e=>{clearTimeout(timer);j(e)}});worker.postMessage({...data,id:n},transfer)});
  (async()=>{try{await ready;const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const layoutBytes=bytes.slice();const layout=await ask({type:'layout',image:layoutBytes.buffer},[layoutBytes.buffer]);const readBytes=bytes.slice();const read=await ask({type:'recognise',image:readBytes.buffer,classes:layout.classes},[readBytes.buffer]);worker.terminate();resolve(read.xml)}catch(e){worker.terminate();reject(e)}})()
 }))
}
async function summarize(page,scoreXml){
 return page.evaluate(source=>{
  const doc=new DOMParser().parseFromString(source,'application/xml');if(doc.querySelector('parsererror'))throw Error('OMR returned invalid MusicXML');
  const steps={C:0,D:2,E:4,F:5,G:7,A:9,B:11},out=[];let div=1;
  for(const part of [...doc.querySelectorAll('score-partwise > part')])for(const measure of [...part.children].filter(x=>x.localName==='measure')){
   const attrs=[...measure.children].find(x=>x.localName==='attributes');const d=attrs?.querySelector('divisions');if(d)div=Number(d.textContent)||1;let cursor=0,lastAt=0;
   for(const n of [...measure.children].filter(x=>x.localName==='note')){const dur=Number(n.querySelector('duration')?.textContent)||0,p=n.querySelector('pitch');if(p){const step=p.querySelector('step')?.textContent,oct=Number(p.querySelector('octave')?.textContent),alter=Number(p.querySelector('alter')?.textContent)||0,at=n.querySelector('chord')?lastAt:cursor,midi=(oct+1)*12+(steps[step]??0)+alter;out.push({bar:Number(measure.getAttribute('number'))||out.length+1,midi,at:+(at/div).toFixed(3),dur:+(dur/div).toFixed(3)});lastAt=at}if(!n.querySelector('chord'))cursor+=dur}
  }return out;
 },scoreXml)
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1600,height:1200},serviceWorkers:'allow'});
 const page=await context.newPage();
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.AariaR2Installer?.state==='ready',null,{timeout:600000});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;for(let i=0;i<100&&!navigator.serviceWorker.controller;i++)await new Promise(r=>setTimeout(r,100));if(!navigator.serviceWorker.controller)throw Error('PWA service worker did not take control')});
  const fixtureSvg='<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="360" viewBox="0 0 1500 360"><rect width="1500" height="360" fill="white"/><g stroke="#111" stroke-width="3"><path d="M80 160H1400"/><path d="M80 184H1400"/><path d="M80 208H1400"/><path d="M80 232H1400"/><path d="M80 256H1400"/><path d="M740 160V256"/><path d="M1390 160V256"/></g><text x="95" y="246" font-family="serif" font-size="92">𝄞</text><g fill="#111" stroke="#111" stroke-width="5">'+[[260,232],[390,220],[520,208],[650,196],[850,184],[980,196],[1110,208],[1240,232]].map(([x,y])=>'<ellipse cx="'+x+'" cy="'+y+'" rx="13" ry="9" transform="rotate(-18 '+x+' '+y+')"/><path d="M'+(x+11)+' '+(y-2)+'V'+(y-76)+'"/>').join('')+'</g></svg>';
  const b64=await page.evaluate(async svg=>{const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=360;canvas.getContext('2d').drawImage(image,0,0);URL.revokeObjectURL(url);return canvas.toDataURL('image/png').split(',')[1]},fixtureSvg);
  const onlineXml=await recognize(page,b64);const online=await summarize(page,onlineXml);
  const match=(events)=>events.filter((e,i)=>e.midi===expected[i]&&e.bar===Math.floor(i/4)+1&&Math.abs(e.at-(i%4))<=0.25&&Math.abs(e.dur-1)<=0.25).length;
  const hits=match(online);console.log('OMR GROUND TRUTH ONLINE',JSON.stringify({expected,observed:online,hits,total:expected.length,xml:onlineXml.slice(0,500)}));
  assert.ok(online.length>=6&&hits>=6,`online OMR ground truth below 6/8 exact pitch+onset+duration; observed ${online.length}, matched ${hits}/8`);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  const offlineXml=await recognize(page,b64);const offline=await summarize(page,offlineXml);const offlineHits=match(offline);
  console.log('OMR GROUND TRUTH OFFLINE',JSON.stringify({observed:offline,hits:offlineHits,total:expected.length}));
  assert.ok(offline.length>=6&&offlineHits>=6,`offline OMR ground truth below 6/8 exact pitch+onset+duration; observed ${offline.length}, matched ${offlineHits}/8`);
  const caches=await page.evaluate(async()=>({serviceWorkerControlled:!!navigator.serviceWorker.controller,modelCache:(await caches.keys()).filter(k=>k==='partscanner-models-v1')}));
  assert.equal(caches.serviceWorkerControlled,true);assert.deepEqual(caches.modelCache,['partscanner-models-v1']);
  console.log('Actual pinned Partsong OMR passed online and offline against a rendered two-measure MusicXML ground truth. This is a single-fixture smoke, not a general accuracy claim.');
 }finally{await context.setOffline(false).catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
