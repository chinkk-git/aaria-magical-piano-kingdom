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
const workerStub=`let requests=0,failFirstRecognition=true;const xml=${JSON.stringify(xml)};self.onmessage=({data})=>{if(data.type==='init'){self.postMessage({type:'ready'});return}if(data.type==='layout'){self.postMessage({type:'result',id:data.id,classes:[]});return}if(data.type==='recognise'){requests++;if(failFirstRecognition){failFirstRecognition=false;self.postMessage({type:'error',id:data.id,msg:'Simulated recognition failure'});return}setTimeout(()=>self.postMessage({type:'result',id:data.id,xml}),700)}}`;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:workerStub}));
  await page.route('**/r2-install.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:"(()=>{window.AariaR2Installer={state:'ready',ensureReady:async()=>true}})()"}));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong);
  assert.equal(await page.locator('#release2InstallGate').count(),0,'first launch has no mandatory OMR gate');
  await page.locator('#setupKeyboard').click();await page.locator('#pianoLayoutSelect').selectOption('hero');await page.locator('#saveKeyboardSetup').click();
  await page.locator('#openMySongs').click();await page.locator('#makeNewSong').click();
  const wizard=page.locator('#localSongWizard');await wizard.waitFor({state:'visible'});
  await page.locator('#scoreSongTitle').fill('Automatic Workshop Song');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="white"/><g stroke="black" stroke-width="5">'+[170,190,210,230,250].map(y=>`<path d="M100 ${y}H1100"/>`).join('')+'</g><g fill="black">'+[220,420,620,820,220,420,620,820].map((x,i)=>`<ellipse cx="${x}" cy="${190+(i%4)*10+(i>3?0:0)}" rx="13" ry="9"/>`).join('')+'</g></svg>';
  const png64=await page.evaluate(async source=>{const img=new Image(),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));img.src=url;await img.decode();const c=document.createElement('canvas');c.width=1200;c.height=700;c.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);return c.toDataURL('image/png').split(',')[1]},svg);
  assert.match(await page.locator('#localSongWizardTitle').textContent(),/Add New Song/);
  assert.match(await page.locator('#makeSong').textContent(),/Make Music/);
  await page.locator('#scorePhotos').setInputFiles({name:'known-score.png',mimeType:'image/png',buffer:Buffer.from(png64,'base64')});
  await page.locator('#makeSong').click();
  await page.waitForFunction(()=>document.querySelector('#makeSong')?.textContent.includes('Try again'),{timeout:30000});
  assert.equal(await page.evaluate(()=>Object.values(window.PianoKingdomLibrary.songs).some(song=>song?.title==='Automatic Workshop Song')),false,'recognition failure does not create a library record');
  await page.evaluate(()=>{window.__originalSaveSong=window.PianoKingdomLibrary.saveSong;window.PianoKingdomLibrary.saveSong=async()=>{throw new Error('Simulated storage failure')}});
  await page.locator('#makeSong').click();
  await page.locator('#keepPlaying').waitFor({state:'visible'});
  await page.locator('#keepPlaying').click();
  await page.locator('.magic-song-bubble').waitFor({state:'visible'});
  const bubbleBox=await page.locator('.magic-song-bubble').boundingBox(),keyBox=await page.locator('#keys').boundingBox(),playbackBox=await page.locator('#player').boundingBox();
  assert.ok(bubbleBox.x+bubbleBox.width<=keyBox.x+keyBox.width&&bubbleBox.y+bubbleBox.height<=keyBox.y,'minimized button stays above the reference keyboard');
  assert.ok(bubbleBox.y+bubbleBox.height<=playbackBox.y,'minimized button stays clear of playback controls');
  const sha=process.env.APP_SOURCE_SHA||'local';await page.screenshot({path:`/tmp/issue25-minimized-processing-390x844-${sha}.png`});
  await page.locator('.magic-song-bubble').click();await page.locator('#localSongWizard').waitFor({state:'visible'});
  await page.waitForFunction(()=>/This song could not be saved/i.test(document.querySelector('#scoreImportStatus')?.textContent||''),{timeout:30000});
  assert.equal(await page.evaluate(()=>Object.values(window.PianoKingdomLibrary.songs).some(song=>song?.title==='Automatic Workshop Song')),false,'storage failure does not claim a saved song');
  assert.equal(await page.locator('#retrySongSave').isVisible(),true,'storage failure offers a retry');
  await page.evaluate(()=>{window.PianoKingdomLibrary.saveSong=window.__originalSaveSong});
  await page.locator('#retrySongSave').click();
  await page.waitForFunction(()=>/Your magical song is ready/i.test(document.querySelector('#scoreImportStatus')?.textContent||''),{timeout:30000});
  assert.equal(await page.locator('#scoreReview').isVisible(),false,'recognition auto-saves without opening the optional editor');
  const id=await page.evaluate(()=>Object.keys(window.PianoKingdomLibrary.songs).find(k=>window.PianoKingdomLibrary.songs[k]?.title==='Automatic Workshop Song'));
  assert.ok(id,'recognized score is saved automatically to the shared song catalog');
  assert.equal(await page.evaluate(()=>Object.values(window.PianoKingdomLibrary.songs).filter(song=>song?.title==='Automatic Workshop Song').length),1,'repeated save identity is represented by one library record');
  const saved=await page.evaluate(expected=>window.PianoKingdomLibrary.songs[expected],id);
  assert.ok(saved.arrangements.basic?.events?.length,'valid Basic arrangement is available after recognition');
  await page.locator('#playMySong').click();
  await page.locator('#localSongWizard').waitFor({state:'hidden'});
  await page.waitForFunction(expected=>document.querySelector('#songSelect')?.value===expected&&mode==='listen',id);
  await page.locator('#songPickerButton').click();await page.locator('#mySongsDialog').waitFor({state:'visible'});
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).locator('select').selectOption('basic');
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).getByRole('button',{name:'Choose'}).click();
  await page.waitForFunction(expected=>document.querySelector('#songSelect')?.value===expected,id);
  const playback=await page.evaluate(expected=>({id:document.querySelector('#songSelect').value,engineEvents:EVENTS.map(n=>[n.bar,n.at,n.dur,n.midi]),savedEvents:window.PianoKingdomLibrary.songs[expected].arrangements.basic.events.map(n=>[n.bar,n.at,n.dur,n.midi])}),id);
  assert.equal(playback.id,id);assert.deepEqual(playback.engineEvents,playback.savedEvents,'selected Basic note data reaches the shared playback engine');
  assert.equal(await page.locator('#songSelect').isVisible(),false,'old native selector stays disabled');
  await page.locator('#songPickerButton').click();await page.locator('#mySongsDialog').waitFor({state:'visible'});
  await page.locator('.library-card').filter({hasText:'Cradle Song'}).getByRole('button',{name:'▶ Play'}).click();
  await page.waitForFunction(()=>document.querySelector('#songSelect')?.value==='cradle'&&mode==='listen');
  assert.equal(await page.locator('#songPickerButton').textContent().then(t=>t.includes('Dalmatian Cradle Song')),true,'built-in song selection updates the visible selector');
  await page.locator('#songPickerButton').click();await page.locator('#mySongsDialog').waitFor({state:'visible'});
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).locator('select').selectOption('basic');
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).getByRole('button',{name:'▶ Play'}).click();
  await page.waitForFunction(expected=>document.querySelector('#songSelect')?.value===expected&&mode==='listen',id);
  assert.deepEqual(await page.evaluate(()=>EVENTS.map(n=>[n.bar,n.at,n.dur,n.midi])),playback.savedEvents,'saved song opens in playback with its selected arrangement');
  await page.locator('#openMySongs').click();await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.locator('#closeMySongs').click();
  assert.match(await page.locator('#songPickerButton').textContent(),/Automatic Workshop Song/,'song selector reflects selection');
  await page.locator('#openMySongs').click();await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.locator('#makeNewSong').click();await page.locator('#localSongWizard').waitFor({state:'visible'});
  await page.locator('#editSavedSong').click();await page.locator('#scoreReview').waitFor({state:'visible'});await page.locator('#cancelReview').click();
  assert.equal(await page.evaluate(expected=>window.PianoKingdomLibrary.songs[expected]?.title,id),'Automatic Workshop Song','optional edit can be canceled while keeping the saved song');
  await page.locator('#closeSongWizard').click();await page.locator('#localSongWizard').waitFor({state:'hidden'});
  const zoom=await page.locator('#keys .white').count();await page.locator('#zoomKeys').click();assert.equal(await page.locator('#keys .white').count(),8,'Zoom Keys changes the visible white key count');await page.locator('#zoomKeys').click();await page.locator('#zoomKeys').click();assert.equal(await page.locator('#keys .white').count(),zoom,'Zoom Keys cycles through its key ranges');
  assert.match(await page.locator('#speed').evaluate(e=>e.parentElement.textContent),/Speed/,'the playback slider uses the Speed label');
  await page.locator('#songPickerButton').click();await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.screenshot({path:`/tmp/issue25-song-selector-390x844-${sha}.png`});
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:834,height:1194},{width:1194,height:834},{width:1440,height:900}]){
   await page.setViewportSize(viewport);
   const layout=await page.evaluate(()=>{const rect=selector=>document.querySelector(selector).getBoundingClientRect(),home=rect('#openMySongs'),picker=rect('#songPickerButton'),controls=['#favoriteCurrent','#zoomKeys','#setupKeyboard'].map(rect);return{separate:home.right<=picker.left||picker.right<=home.left||home.bottom<=picker.top||picker.bottom<=home.top,controlsClear:controls.every(c=>picker.right<=c.left||c.right<=picker.left||picker.bottom<=c.top||c.bottom<=picker.top),dialogVisible:document.querySelector('#mySongsDialog').getBoundingClientRect().width>0}});
   assert.equal(layout.separate,true,`Home and selector do not overlap at ${viewport.width}x${viewport.height}`);assert.equal(layout.homeNextToSettings,true,`Home is next to Settings at ${viewport.width}x${viewport.height}`);
   assert.equal(layout.controlsClear,true,`selector does not overlap header controls at ${viewport.width}x${viewport.height}`);
   assert.equal(layout.dialogVisible,true,`custom selector dialog remains visible at ${viewport.width}x${viewport.height}`);await page.screenshot({path:`/tmp/issue25-song-selector-${viewport.width}x${viewport.height}-${sha}.png`});
  }

  console.log('Issue #25 workshop browser checks passed: no startup OMR gate, one-screen Add New Song → Make Music, recognition failure and retry, minimized processing restore, storage failure recovery, auto-save, optional correction, arrangement playback, custom selector and responsive layouts. Screenshots are labeled in /tmp with viewport and source SHA.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
