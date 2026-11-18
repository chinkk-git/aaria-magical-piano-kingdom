'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)})});
const xml=`<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part><score-part id="P2"><part-name>Bass</part-name></score-part></part-list><part id="P1">
<measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note></measure>
<measure number="2"><note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part><part id="P2">
<measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef></attributes>
<note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>D</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note></measure>
<measure number="2">
<note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>B</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>D</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note><note><chord/><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note></measure></part></score-partwise>`;
const workerStub=`let requests=0;const xml=${JSON.stringify(xml)};self.onmessage=({data})=>{if(data.type==='init'){self.postMessage({type:'ready'});return}if(data.type==='layout'){self.postMessage({type:'result',id:data.id,classes:[]});return}if(data.type==='recognise'){requests++;self.postMessage({type:'result',id:data.id,xml})}}`;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:workerStub}));
  await page.route('**/r2-install.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:"(()=>{const g=document.getElementById('release2InstallGate'),a=document.getElementById('pianoApp');if(g){g.hidden=true;g.setAttribute('aria-busy','false')}if(a){a.inert=false;a.removeAttribute('aria-hidden')}window.AariaR2Installer={state:'ready'}})()"}));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong);
  await page.locator('#openMySongs').click();await page.locator('#makeNewSong').click();
  const wizard=page.locator('#localSongWizard');await wizard.waitFor({state:'visible'});
  await page.locator('#scoreSongTitle').fill('Reviewed Workshop Song');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="white"/><g stroke="black" stroke-width="5">'+[170,190,210,230,250].map(y=>`<path d="M100 ${y}H1100"/>`).join('')+'</g><g fill="black">'+[220,420,620,820,220,420,620,820].map((x,i)=>`<ellipse cx="${x}" cy="${190+(i%4)*10+(i>3?0:0)}" rx="13" ry="9"/>`).join('')+'</g></svg>';
  const png64=await page.evaluate(async source=>{const img=new Image(),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));img.src=url;await img.decode();const c=document.createElement('canvas');c.width=1200;c.height=700;c.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);return c.toDataURL('image/png').split(',')[1]},svg);
  await page.locator('#scorePhotos').setInputFiles({name:'known-score.png',mimeType:'image/png',buffer:Buffer.from(png64,'base64')});
  await page.locator('#makeSong').click();
  await page.waitForFunction(()=>{const t=document.querySelector('#makeSong')?.textContent||'';return t.includes('Continue with photos')||t.includes('Reading music')||document.querySelector('#scoreReview:not([hidden])')});
  if((await page.locator('#makeSong').textContent()).includes('Continue with photos'))await page.locator('#makeSong').click();
  await page.waitForFunction(()=>document.querySelector('#scoreReview:not([hidden])')||/couldn.t|could not|try again|needs more free space|Wi-Fi/i.test(document.querySelector('#scoreImportStatus')?.textContent||''),{timeout:30000});
  const workshopStatus=await page.locator('#scoreImportStatus').textContent();
  assert.equal(await page.locator('#scoreReview').isVisible(),true,`score review should open after recognition; workshop status: ${workshopStatus}`);
  assert.match(await page.locator('#scoreConfidenceNotice').textContent(),/not provided by the music reader/i);
  assert.equal(await page.locator('#scoreChecked').isDisabled(),true,'both measures must be inspected');
  await page.locator('#reviewMeasure').selectOption('2');assert.equal(await page.locator('#scoreChecked').isDisabled(),false);
  await page.locator('#reviewMeasure').selectOption('1');
  const before=await page.locator('.score-review-row').first().locator('.score-review-note').textContent();
  await page.locator('.score-review-row').first().locator('button[data-edit="up"]').click();
  const after=await page.locator('.score-review-row').first().locator('.score-review-note').textContent();assert.notEqual(after,before,'pitch correction changes the reviewed note');
  assert.equal(await page.locator('#scoreChecked').isDisabled(),true,'a correction requires re-confirming every measure');
  await page.locator('#reviewMeasure').selectOption('2');await page.locator('#scoreChecked').check();
  assert.ok(await page.locator('#arrangementSelect option[value="basic"]').count(),'reviewed score exposes a generated Basic level');
  await page.locator('#arrangementSelect').selectOption('basic');
  await page.locator('#saveReviewedSong').click();await page.waitForFunction(()=>document.querySelector('#saveReviewedSong')?.textContent.includes('Saved'));
  const id=await page.evaluate(()=>Object.keys(window.PianoKingdomLibrary.songs).find(k=>window.PianoKingdomLibrary.songs[k]?.title==='Reviewed Workshop Song'));
  assert.ok(id,'reviewed score is saved to the shared song catalog');
  await page.locator('#closeSongWizard').click();await page.locator('#openMySongs').click();
  const card=page.locator('.library-card').filter({hasText:'Reviewed Workshop Song'});await card.waitFor();
  await card.locator('select').selectOption('basic');await card.getByRole('button',{name:'▶ Play'}).click();
  await page.waitForFunction(expected=>document.querySelector('#songSelect')?.value===expected,id);
  const playback=await page.evaluate(expected=>({id:document.querySelector('#songSelect').value,engineEvents:EVENTS.map(n=>[n.bar,n.at,n.dur,n.midi]),savedEvents:window.PianoKingdomLibrary.songs[expected].arrangements.basic.events.map(n=>[n.bar,n.at,n.dur,n.midi])}),id);
  assert.equal(playback.id,id);assert.deepEqual(playback.engineEvents,playback.savedEvents,'selected Basic note data reaches the shared playback engine');
  assert.deepEqual(errors,[],'no browser runtime errors');
  console.log('Workshop review integration passed: recognized MusicXML → measure gate → pitch correction → Basic arrangement → save → Library → exact engine events.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
