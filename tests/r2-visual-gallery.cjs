'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.RUNNER_TEMP||'/tmp','release-2-screen-gallery'),sha=process.env.APP_SOURCE_SHA||process.env.GITHUB_SHA||'unknown';
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const payload=Buffer.alloc(1024*1024,0x4b),chunkSize=65536,digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest={schemaVersion:1,version:'visual-review-fixture-v1',totalBytes:payload.length,files:[{path:'./visual-fixture.bin',bytes:payload.length,sha256:digest(payload),chunkSize,chunks:Array.from({length:payload.length/chunkSize},(_,i)=>digest(payload.subarray(i*chunkSize,(i+1)*chunkSize)))}]};
const xml=['<?xml version="1.0"?>','<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Right Hand Piano</part-name></score-part><score-part id="P2"><part-name>Left Hand Piano</part-name></score-part></part-list>'];
for(const [id,name,steps,dur] of [['P1','right',[67,72,79,60,84,53,76,65],1],['P2','left',[48,50,52,53],2]]){
 xml.push('<part id="'+id+'">');
 for(let bar=0;bar<4;bar++){
  xml.push('<measure number="'+(bar+1)+'"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>'+(name==='left'?'F':'G')+'</sign><line>'+(name==='left'?'4':'2')+'</line></clef></attributes>');
  if(name==='right'){for(let j=0;j<8;j++){const midi=steps[(j+bar)%steps.length],step=['C','C','D','D','E','F','F','G','G','A','A','B'][midi%12],oct=Math.floor(midi/12)-1;xml.push('<note><pitch><step>'+step+'</step><octave>'+oct+'</octave></pitch><duration>'+dur+'</duration><type>eighth</type></note>')}}
  else{for(let j=0;j<4;j++){const midi=steps[(j+bar)%steps.length],step=['C','C','D','D','E','F','F','G','G','A','A','B'][midi%12],oct=Math.floor(midi/12)-1,step2=['E','F','G','A'][j];xml.push('<note><pitch><step>'+step+'</step><octave>'+oct+'</octave></pitch><duration>'+dur+'</duration><type>quarter</type></note><note><chord/><pitch><step>'+step2+'</step><octave>3</octave></pitch><duration>'+dur+'</duration><type>quarter</type></note>')}}
  xml.push('</measure>');
 }
 xml.push('</part>');
}
xml.push('</score-partwise>');
const scoreXml=xml.join('');
const worker='const xml='+JSON.stringify(scoreXml)+';self.onmessage=({data})=>{if(data.type==="init"){self.postMessage({type:"ready"});return}if(data.type==="layout"){self.postMessage({type:"result",id:data.id,classes:[]});return}if(data.type==="recognise"){setTimeout(()=>self.postMessage({type:"result",id:data.id,xml}),5500)}};';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p==='/release2-install-manifest.json'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(manifest));return}
 if(p==='/visual-fixture.bin'){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':payload.length});let at=0;const send=()=>{if(at>=payload.length){res.end();return}const end=Math.min(at+32768,payload.length);res.write(payload.subarray(at,end));at=end;setTimeout(send,125)};send();return}
 if(p==='/omr-worker.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(worker);return}
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(b)});
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function stamp(page,name){await page.evaluate(({name,sha})=>{let e=document.getElementById('visualReviewLabel');if(!e){e=document.createElement('div');e.id='visualReviewLabel';Object.assign(e.style,{position:'fixed',right:'8px',bottom:'8px',zIndex:'2147483647',maxWidth:'92vw',padding:'5px 8px',border:'1px solid #f6d47c',borderRadius:'8px',background:'rgba(15,10,30,.88)',color:'#fff',font:'600 11px/1.25 system-ui,sans-serif',pointerEvents:'none',textAlign:'right'});document.body.append(e)}e.textContent=name+' · '+innerWidth+'×'+innerHeight+' · '+sha},{name,sha})}
let n=0;
async function snap(page,name,w,h){await page.setViewportSize({width:w,height:h});await delay(250);await stamp(page,name);const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const file=String(++n).padStart(2,'0')+'-'+slug+'-'+w+'x'+h+'-'+sha.slice(0,12)+'.png';await page.screenshot({path:path.join(out,file)});}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.AariaR2Installer?.state==='installing',null,{timeout:30000});
  await delay(900);
  await page.evaluate(()=>{const p=document.querySelector('#release2InstallProgress'),s=document.querySelector('#release2InstallStatus'),d=document.querySelector('#release2InstallDetail');p.max=1000000;p.value=360000;s.textContent='Downloading and checking piano files…';d.textContent='visual-fixture.bin · 0.4 MB of 1.0 MB';document.querySelector('#release2InstallGate').setAttribute('aria-busy','true')});
  await snap(page,'First install OMR download locked app',390,844);
  await page.evaluate(()=>{const gate=document.querySelector('#release2InstallGate'),app=document.querySelector('#pianoApp');gate.hidden=true;app.inert=false;app.removeAttribute('aria-hidden');document.body.classList.remove('r2-installing');if(window.AariaR2Installer)window.AariaR2Installer.state='ready'});

  await snap(page,'Magical Piano Hero default home',390,844);
  await snap(page,'Magical Piano Hero default home',844,390);
  await snap(page,'Magical Piano Hero default home',820,1180);
  await snap(page,'Magical Piano Hero default home',1180,820);
  await snap(page,'Magical Piano Hero default home',1440,900);

  await page.locator('#setupKeyboard').click();await page.locator('#pianoLayoutSelect').selectOption('classic');await page.locator('#closeKeyboardSetup').click();await delay(300);
  await snap(page,'Classic Piano',390,844);await snap(page,'Classic Piano',844,390);await snap(page,'Classic Piano',820,1180);await snap(page,'Classic Piano',1180,820);await snap(page,'Classic Piano',1440,900);

  await page.locator('#openMySongs').click();await page.locator('#mySongsDialog[open]').waitFor({timeout:10000}).catch(()=>{});
  await snap(page,'Magical Song Library',390,844);await snap(page,'Magical Song Library',820,1180);await snap(page,'Magical Song Library',1440,900);
  await page.locator('#makeNewSong').click();await page.locator('#localSongWizard[open]').waitFor({timeout:10000});
  await page.locator('#scoreSongTitle').fill('Fixture: Joyful Journey');
  const dataUrl=await page.evaluate(label=>{const c=document.createElement('canvas');c.width=1200;c.height=1500;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#201638';x.font='bold 40px system-ui';x.fillText(label,80,85);x.font='22px system-ui';x.fillText('Visual review fixture — not a real score capture',80,125);for(let staff=0;staff<4;staff++){const top=220+staff*260;x.strokeStyle='#111';x.lineWidth=3;for(let line=0;line<5;line++){x.beginPath();x.moveTo(100,top+line*22);x.lineTo(1100,top+line*22);x.stroke()}x.fillStyle='#111';for(let i=0;i<8;i++){const xx=180+i*115,yy=top+75-((i*3+staff)%7)*10;x.beginPath();x.ellipse(xx,yy,13,8,-.3,0,Math.PI*2);x.fill();x.beginPath();x.moveTo(xx+12,yy);x.lineTo(xx+12,yy-65);x.stroke()}}return c.toDataURL('image/png')},'VISUAL REVIEW TEST FIXTURE');
  await page.locator('#scorePhotos').setInputFiles({name:'visual-review-score-fixture.png',mimeType:'image/png',buffer:Buffer.from(dataUrl.split(',')[1],'base64')});
  await page.locator('.score-photo-card').waitFor({timeout:10000});
  await snap(page,'Magic Song Workshop photo selection preview',390,844);await snap(page,'Magic Song Workshop photo selection preview',820,1180);await snap(page,'Magic Song Workshop photo selection preview',1440,900);

  await page.locator('#makeSong').click();
  for(let i=0;i<20;i++){const t=await page.locator('#scoreImportStatus').textContent().catch(()=>''),b=await page.locator('#makeSong').textContent().catch(()=>'' );if(/Continue with photos/i.test(b)){await page.locator('#makeSong').click();continue}if(/Reading notes and rhythm|Checking the music page|Getting the music reader ready/i.test(t))break;await delay(300)}
  await page.waitForFunction(()=>/Reading notes and rhythm|Checking the music page/.test(document.querySelector('#scoreImportStatus')?.textContent||''),null,{timeout:30000});
  await snap(page,'OMR processing Magic Song Workshop fixture',390,844);
  await page.locator('#keepPlaying').click();await snap(page,'Magic Bubble OMR processing fixture',1180,820);
  await page.waitForFunction(()=>document.querySelector('.magic-song-bubble')&&!document.querySelector('.magic-song-bubble').hidden&&/Review your score/.test(document.querySelector('.magic-song-bubble').textContent),null,{timeout:30000});
  await page.evaluate(()=>document.querySelector('.magic-song-bubble').click());await page.locator('#scoreReview:not([hidden])').waitFor({timeout:10000});
  await snap(page,'Recognized score correction and review fixture',390,844);await snap(page,'Recognized score correction and review fixture',820,1180);await snap(page,'Recognized score correction and review fixture',1440,900);
  const measures=await page.locator('#reviewMeasure option').count();for(let i=0;i<measures;i++){await page.locator('#reviewMeasure').selectOption(String(i+1));await delay(80)}
  await page.locator('#scoreChecked').check({force:true});await delay(350);
  const values=await page.locator('#arrangementSelect option').evaluateAll(os=>os.map(o=>o.value));
  for(const level of ['basic','medium','advanced'])if(values.includes(level)){await page.locator('#arrangementSelect').selectOption(level);await delay(200);await snap(page,'Arrangement selection '+level,820,1180)}
  await page.locator('#saveReviewedSong').click();await delay(700);
  await page.locator('#playMySong').click();await delay(500);
  await snap(page,'Saved song opened for playback fixture',390,844);await snap(page,'Saved song opened for playback fixture',844,390);await snap(page,'Saved song opened for playback fixture',1180,820);await snap(page,'Saved song opened for playback fixture',1440,900);

  const readme='# Release 2 actual development screen gallery\n\nDevelopment source commit: '+sha+'\n\nScreenshots are real Chromium renders of the Release 2 application source on the development branch. Device viewport sizes are embedded in every filename and visible stamp. The OMR processing, recognized score, correction, arrangement and saved-song screens use a clearly labeled visual-review score fixture and a local worker stub; they are not evidence of a real OMR recognition result.\n\nCaptured screenshots: '+n+'\n';
  fs.writeFileSync(path.join(out,'README.md'),readme);
  const zip=path.join(process.env.GITHUB_WORKSPACE||process.cwd(),'release-2-actual-screen-gallery.zip');
  execFileSync('python3',['-m','zipfile','-c',zip,out]);
  console.log('Captured '+n+' screenshots at development SHA '+sha+'; ZIP: '+zip);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
