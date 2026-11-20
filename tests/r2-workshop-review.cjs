'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
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
const workerStub=`let requests=0,failFirstRecognition=true;const xml=${JSON.stringify(xml)};self.onmessage=({data})=>{if(data.type==='init'){self.postMessage({type:'ready'});return}if(data.type==='layout'){self.postMessage({type:'result',id:data.id,classes:[]});return}if(data.type==='recognise'){requests++;if(failFirstRecognition){failFirstRecognition=false;self.postMessage({type:'error',id:data.id,msg:'Simulated recognition failure'});return}setTimeout(()=>self.postMessage({type:'result',id:data.id,xml}),1200)}}`;
const workerSlowStub=`const xml=${JSON.stringify(xml)};self.onmessage=({data})=>{if(data.type==='init'){self.postMessage({type:'ready'});return}if(data.type==='layout'){self.postMessage({type:'result',id:data.id,classes:[]});return}if(data.type==='recognise'){setTimeout(()=>self.postMessage({type:'result',id:data.id,xml}),12000)}}`;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 fs.mkdirSync('/tmp/magic-progress-video',{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce',recordVideo:{dir:'/tmp/magic-progress-video',size:{width:390,height:844}}});
 const page=await context.newPage(),progressVideo=page.video(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:workerStub}));
  await page.route('**/r2-install.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:"(()=>{window.AariaR2Installer={state:'ready',ensureReady:async()=>true}})()"}));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong);
  assert.equal(await page.locator('#release2InstallGate').count(),0,'first launch has no mandatory OMR gate');
  await page.evaluate(()=>window.AariaOpenSettings());await page.locator('#pianoLayoutSelect').selectOption('hero');await page.locator('.keyboard-settings-details summary').click();await page.locator('#saveKeyboardSetup').click();
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#makeNewSong').click();
  const wizard=page.locator('#localSongWizard');await wizard.waitFor({state:'visible'});
  await page.locator('#scoreSongTitle').fill('Automatic Workshop Song');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="white"/><g stroke="black" stroke-width="5">'+[170,190,210,230,250].map(y=>`<path d="M100 ${y}H1100"/>`).join('')+'</g><g fill="black">'+[220,420,620,820,220,420,620,820].map((x,i)=>`<ellipse cx="${x}" cy="${190+(i%4)*10+(i>3?0:0)}" rx="13" ry="9"/>`).join('')+'</g></svg>';
  const png64=await page.evaluate(async source=>{const img=new Image(),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));img.src=url;await img.decode();const c=document.createElement('canvas');c.width=1200;c.height=700;c.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);return c.toDataURL('image/png').split(',')[1]},svg);
  assert.match(await page.locator('#localSongWizardTitle').textContent(),/Add New Song/);
  assert.match(await page.locator('#makeSong').textContent(),/Make Music/);
  await page.locator('#scorePhotos').setInputFiles({name:'known-score.png',mimeType:'image/png',buffer:Buffer.from(png64,'base64')});
  // Isolate the manual failure/retry path; automatic page recovery has its own test below.
  await page.evaluate(()=>{const choose=window.AariaR2Image.chooseRecovery;window.AariaR2Image.chooseRecovery=(details)=>details.failureClass==='OMR_OUTPUT_INVALID'?{retry:false,reason:null}:choose(details)});
  await page.locator('#makeSong').click();
  await page.waitForFunction(()=>document.querySelector('#makeSong')?.textContent.includes('Try again'),{timeout:30000});
  assert.equal(await page.evaluate(()=>Object.values(window.PianoKingdomLibrary.songs).some(song=>song?.title==='Automatic Workshop Song')),false,'recognition failure does not create a library record');
  await page.evaluate(()=>{window.__originalSaveSong=window.PianoKingdomLibrary.saveSong;window.PianoKingdomLibrary.saveSong=async()=>{throw new Error('Simulated storage failure')}});
  await page.locator('#makeSong').click();
  await page.locator('#keepPlaying').waitFor({state:'visible'});
  await page.locator('#keepPlaying').click();
  await page.locator('.magic-song-bubble').waitFor({state:'visible'});
  const bubbleBox=await page.locator('.magic-song-bubble').boundingBox(),keyBox=await page.locator('#keys').boundingBox(),playbackBox=await page.locator('.v21-dock').boundingBox(),bubbleStyle=await page.locator('.magic-song-bubble').evaluate(e=>({position:getComputedStyle(e).position,top:getComputedStyle(e).top,parent:e.parentElement.id,playfield:e.parentElement.getBoundingClientRect().toJSON()}));console.log('minimized overlay geometry',JSON.stringify({bubbleBox,keyBox,playbackBox,bubbleStyle}));await page.screenshot({path:`/tmp/issue25-minimized-processing-390x844-${process.env.APP_SOURCE_SHA||'local'}.png`});
  assert.ok(bubbleBox.x+bubbleBox.width<=keyBox.x+keyBox.width&&bubbleBox.y+bubbleBox.height<=keyBox.y,'minimized button stays above the reference keyboard');
  assert.ok(bubbleBox.y+bubbleBox.height<=playbackBox.y,'minimized button stays clear of playback controls');
  const sha=process.env.APP_SOURCE_SHA||'local';await page.screenshot({path:`/tmp/issue25-minimized-processing-390x844-${sha}.png`});
  await page.locator('.magic-song-bubble').click();await page.locator('#localSongWizard').waitFor({state:'visible'});
  await page.waitForTimeout(5000);
  const saveFailureState=await page.evaluate(()=>({status:document.querySelector('#scoreImportStatus')?.textContent,stage:document.querySelector('#workshopStage')?.textContent,pages:document.querySelector('#workshopProgressPages')?.textContent,eta:document.querySelector('#workshopProgressEta')?.textContent,retry:document.querySelector('#retrySongSave')?.hidden,busy:window.AariaSongImportIsBusy?.()}));console.log('save failure state',JSON.stringify({saveFailureState,errors}));
  assert.match(saveFailureState.status,/needs help saving/i,'simulated Library save failure is reported clearly');
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
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).locator('.v21-song-details').evaluate(el=>{el.open=true});await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).locator('select').selectOption('basic');
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).getByRole('button',{name:'Choose'}).click();
  await page.waitForFunction(expected=>document.querySelector('#songSelect')?.value===expected,id);
  const playback=await page.evaluate(expected=>({id:document.querySelector('#songSelect').value,engineEvents:EVENTS.map(n=>[n.bar,n.at,n.dur,n.midi]),savedEvents:window.PianoKingdomLibrary.songs[expected].arrangements.basic.events.map(n=>[n.bar,n.at,n.dur,n.midi])}),id);
  assert.equal(playback.id,id);assert.deepEqual(playback.engineEvents,playback.savedEvents,'selected Basic note data reaches the shared playback engine');
  assert.equal(await page.locator('#songSelect').isVisible(),false,'old native selector stays disabled');
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});
  await page.locator('.library-card').filter({hasText:'Cradle Song'}).locator('.v21-song-details').evaluate(el=>{el.open=true});await page.locator('.library-card').filter({hasText:'Cradle Song'}).getByRole('button',{name:'▶ Play'}).click();
  await page.waitForFunction(()=>document.querySelector('#songSelect')?.value==='cradle'&&mode==='listen');
  assert.equal(await page.locator('#songPickerButton').textContent().then(t=>t.includes('Dalmatian Cradle Song')),true,'built-in song selection updates the visible selector');
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).locator('.v21-song-details').evaluate(el=>{el.open=true});await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).locator('select').selectOption('basic');
  await page.locator('.library-card').filter({hasText:'Automatic Workshop Song'}).getByRole('button',{name:'▶ Play'}).click();
  await page.waitForFunction(expected=>document.querySelector('#songSelect')?.value===expected&&mode==='listen',id);
  assert.deepEqual(await page.evaluate(()=>EVENTS.map(n=>[n.bar,n.at,n.dur,n.midi])),playback.savedEvents,'saved song opens in playback with its selected arrangement');
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.locator('#closeMySongs').click();
  assert.match(await page.locator('#songPickerButton').textContent(),/Automatic Workshop Song/,'song selector reflects selection');
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.locator('#makeNewSong').click();await page.locator('#localSongWizard').waitFor({state:'visible'});
  await page.locator('#editSavedSong').click();await page.locator('#scoreReview').waitFor({state:'visible'});await page.locator('#cancelReview').click();
  assert.equal(await page.evaluate(expected=>window.PianoKingdomLibrary.songs[expected]?.title,id),'Automatic Workshop Song','optional edit can be canceled while keeping the saved song');
  await page.locator('#closeSongWizard').click();await page.locator('#localSongWizard').waitFor({state:'hidden'});
  const zoom=await page.locator('#keys .white').count();await page.locator('#v21Zoom').click();assert.equal(await page.locator('#keys .white').count(),8,'fixed toolbar Zoom changes the visible white key count');await page.locator('#v21Zoom').click();await page.locator('#v21Zoom').click();assert.equal(await page.locator('#keys .white').count(),zoom,'fixed toolbar Zoom cycles through its key ranges');
  assert.match(await page.locator('#speed').evaluate(e=>e.parentElement.textContent),/Speed/,'the playback slider uses the Speed label');
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.screenshot({path:`/tmp/issue25-song-selector-390x844-${sha}.png`});await page.screenshot({path:'/tmp/android-song-selector-open.png'});
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:834,height:1194},{width:1194,height:834},{width:1440,height:900}]){
   await page.setViewportSize(viewport);
   const layout=await page.evaluate(()=>({legacyNavigationRemoved:['#openMySongs','#setupKeyboard','#addSongOpen'].every(s=>!document.querySelector(s)),toolbarControls:['#v21Play','#v21Sound','#speed','#v21Zoom'].every(s=>{const e=document.querySelector(s);return e&&e.getBoundingClientRect().width>0}),dialogVisible:document.querySelector('#mySongsDialog').getBoundingClientRect().width>0}));
   console.log('unified navigation geometry',`${viewport.width}x${viewport.height}`,JSON.stringify(layout));assert.equal(layout.legacyNavigationRemoved,true,`standalone navigation is removed at ${viewport.width}x${viewport.height}`);assert.equal(layout.toolbarControls,true,`four fixed playback controls remain visible at ${viewport.width}x${viewport.height}`);
   assert.equal(layout.dialogVisible,true,`custom selector dialog remains visible at ${viewport.width}x${viewport.height}`);await page.screenshot({path:`/tmp/issue25-song-selector-${viewport.width}x${viewport.height}-${sha}.png`});
  }

  const cancelPage=await context.newPage(),cancelErrors=[];
  cancelPage.on('pageerror',e=>cancelErrors.push(e.message));
  await cancelPage.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:workerSlowStub}));
  await cancelPage.route('**/r2-install.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:"(()=>{window.AariaR2Installer={state:'ready',ensureReady:async()=>true}})()"}));
  await cancelPage.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await cancelPage.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong);
  await cancelPage.evaluate(()=>window.AariaPianoNavigation.openSongs());await cancelPage.locator('#makeNewSong').click();
  await cancelPage.locator('#scorePhotos').setInputFiles({name:'cancel-score.png',mimeType:'image/png',buffer:Buffer.from(png64,'base64')});
  const dismissed=async dialog=>{assert.match(dialog.message(),/Your pictures and completed pages will stay saved/);await dialog.dismiss()};
  cancelPage.on('dialog',dismissed);
  await cancelPage.locator('#makeSong').click();
  await cancelPage.waitForFunction(()=>/Reading notes and rhythm 1 of 1/.test(document.querySelector('#scoreImportStatus')?.textContent||''),{timeout:15000});
  assert.equal(await cancelPage.locator('#workshopProgressEta').textContent(),'Estimating time…','ETA shows an honest placeholder before enough page timings exist');
  await cancelPage.locator('#keepPlaying').click();
  await cancelPage.locator('.magic-song-bubble').waitFor({state:'visible'});
  assert.equal((await cancelPage.locator('.magic-song-bubble').textContent()).trim(),(await cancelPage.locator('#scoreImportStatus').textContent()).trim(),'the minimized bubble mirrors the real recognition stage');
  await cancelPage.locator('.magic-song-bubble').click();
  await cancelPage.locator('#cancelSongJob').click();
  assert.equal(await cancelPage.locator('#makeSong').isDisabled(),true,'dismissing cancellation leaves recognition running');
  assert.match(await cancelPage.locator('#scoreImportStatus').textContent(),/Reading notes and rhythm 1 of 1/,'dismissal preserves the current progress stage');
  cancelPage.off('dialog',dismissed);
  const accepted=async dialog=>{await dialog.accept()};
  cancelPage.on('dialog',accepted);
  await cancelPage.locator('#cancelSongJob').click();
  await cancelPage.waitForFunction(()=>/Reading paused/.test(document.querySelector('#scoreImportStatus')?.textContent||''),{timeout:15000});
  assert.match(await cancelPage.locator('#makeSong').textContent(),/Continue reading/,'confirmed cancel allows immediate safe re-entry');
  assert.equal(await cancelPage.evaluate(()=>Object.values(window.PianoKingdomLibrary.songs).some(song=>song?.title==='My song')),false,'confirmed cancel does not save a partial song');
  await cancelPage.waitForTimeout(1200);
  assert.equal(await cancelPage.evaluate(()=>Object.values(window.PianoKingdomLibrary.songs).filter(song=>song?.title==='My song').length),0,'terminated worker cannot complete late or create a duplicate partial song');
  assert.deepEqual(cancelErrors,[],'cancel flow has no uncaught browser errors');
  await cancelPage.waitForTimeout(1200);
  await cancelPage.reload();await cancelPage.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong);await cancelPage.evaluate(()=>window.AariaPianoNavigation.openSongs());await cancelPage.locator('#makeNewSong').click();await cancelPage.locator('#recoveredJob').waitFor({state:'visible'});
  assert.match(await cancelPage.locator('#recoveredJobInfo').textContent(),/0 of 1 page finished/,'the paused page count recovers from the existing IndexedDB job record');
  assert.equal(await cancelPage.locator('#workshopProgressPages').textContent(),'0 of 1 pages finished','the progress meter restores the saved completed-page count');
  await cancelPage.close();

  await page.setViewportSize({width:390,height:844});await page.locator('#closeMySongs').click();
  const importPageCount=async(count,title)=>{
   await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.locator('#makeNewSong').click();await page.locator('#localSongWizard').waitFor({state:'visible'});
   await page.locator('#scoreSongTitle').fill(title);
   const files=Array.from({length:count},(_,i)=>({name:`page-${i+1}.png`,mimeType:'image/png',buffer:Buffer.from(png64,'base64')}));
   await page.locator('#scorePhotos').setInputFiles(files);
   await page.locator('#makeSong').click();
   await page.waitForFunction(()=>/Your magical song is ready/i.test(document.querySelector('#scoreImportStatus')?.textContent||''),{timeout:60000});
   assert.equal(await page.locator('#workshopProgressBar').getAttribute('aria-valuenow'),'100',`${count}-page job reports all completed pages`);
   assert.match(await page.locator('#workshopProgressPages').textContent(),new RegExp(`${count} of ${count} pages finished`));
  };
  await importPageCount(3,'Three Page Progress Song');
  await page.locator('#localSongWizard').waitFor({state:'visible'});
  assert.equal(await page.locator('#workshopProgressEta').isHidden(),true,'ETA is omitted when the completed import has no remaining page work');
  await page.locator('#closeSongWizard').click();await page.locator('#localSongWizard').waitFor({state:'hidden'});
  await context.setOffline(true);
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#mySongsDialog').waitFor({state:'visible'});await page.locator('#makeNewSong').click();await page.locator('#localSongWizard').waitFor({state:'visible'});
  await page.locator('#scoreSongTitle').fill('Twenty Page Progress Song');
  await page.locator('#scorePhotos').setInputFiles(Array.from({length:20},(_,i)=>({name:`large-${i+1}.png`,mimeType:'image/png',buffer:Buffer.from(png64,'base64')})));
  await page.evaluate(()=>{window.__progressSamples=[];const el=document.querySelector('#workshopProgressBar');new MutationObserver(()=>window.__progressSamples.push(Number(el.getAttribute('aria-valuenow')))).observe(el,{attributes:true,attributeFilter:['aria-valuenow']})});
  await page.locator('#makeSong').click();
  await page.waitForFunction(()=>/Reading notes and rhythm 4 of 20/.test(document.querySelector('#scoreImportStatus')?.textContent||''),{timeout:30000});
  assert.equal(await page.locator('#workshopProgressPages').textContent(),'3 of 20 pages finished','page progress follows three actual completed page results');
  assert.equal(await page.locator('#workshopProgressEta').isHidden(),false,'ETA appears only after at least three observed page durations');
  assert.equal(await page.evaluate(()=>typeof window.AariaWorkshopProgress?.report),'function','Worker 2 has the shared Workshop event API');
  assert.equal(await page.evaluate(()=>window.AariaWorkshopProgress.report({stage:'recover_page',page:{current:4,total:20,completed:3},message:'Recovering page 4 of 20…'})),true,'external recovery event is accepted into the shared state');
  assert.equal(await page.locator('#workshopStage').textContent(),'Recovering a page');
  assert.equal(await page.locator('#workshopProgressPages').textContent(),'3 of 20 pages finished','recovery keeps the genuine completed-page count');
  await page.evaluate(()=>window.AariaWorkshopProgress.report({stage:'recognize_music',page:{current:4,total:20,completed:3},message:'Reading notes and rhythm 4 of 20…'}));
  await page.screenshot({path:`/tmp/magic-music-progress-portrait-${sha}.png`});
  const progressBox=await page.locator('#workshopProgress').boundingBox(),previewBox=await page.locator('#scorePhotoPreviews').boundingBox(),actionsBox=await page.locator('#workshopPrimaryActions').boundingBox();
  assert.ok(progressBox.y>=previewBox.y+previewBox.height-1,'progress sits after, and does not cover, the photo previews');
  assert.ok(actionsBox.y>=progressBox.y+progressBox.height-1,'progress does not cover Keep Playing or Cancel actions');
  const samples=await page.evaluate(()=>window.__progressSamples);assert.ok(samples.every((value,index)=>index===0||value>=samples[index-1]),'percentage does not move backwards within one attempt');
  try{await page.waitForFunction(()=>/Your magical song is ready|I couldn’t make that song yet|This device needs more free space|I need Wi-Fi/i.test(document.querySelector('#scoreImportStatus')?.textContent||''),null,{timeout:120000})}catch(error){const stalled=await page.evaluate(()=>({status:document.querySelector('#scoreImportStatus')?.textContent,stage:document.querySelector('#workshopStage')?.textContent,pages:document.querySelector('#workshopProgressPages')?.textContent,percent:document.querySelector('#workshopProgressBar')?.getAttribute('aria-valuenow'),eta:document.querySelector('#workshopProgressEta')?.textContent,busy:window.AariaSongImportIsBusy?.()}));console.log('20-page import stalled state',JSON.stringify({stalled,pageErrors:errors}));throw error}
  const largeImportStatus=await page.locator('#scoreImportStatus').textContent();console.log('20-page import terminal status',largeImportStatus,'progress',await page.locator('#workshopProgressPages').textContent(),'stage',await page.locator('#workshopStage').textContent(),'pageErrors',JSON.stringify(errors));
  assert.match(largeImportStatus,/Your magical song is ready/i,'20-page offline import completes and saves');
  await context.setOffline(false);
  await page.setViewportSize({width:844,height:390});
  const landscape=await page.locator('#workshopProgress').boundingBox(),landscapeActions=await page.locator('#workshopPrimaryActions').boundingBox();
  const landscapeDialog=await page.locator('#localSongWizard').evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
  assert.ok(landscapeDialog.rect.height<=390&&landscapeDialog.scrollHeight>landscapeDialog.clientHeight&&landscapeDialog.overflow==='auto','landscape Workshop remains viewport-bounded and scrollable');
  await page.locator('#localSongWizard').evaluate(el=>{el.scrollTop=el.scrollHeight});
  const actionsAfterScroll=await page.locator('#workshopPrimaryActions').boundingBox(),dialogAfterScroll=await page.locator('#localSongWizard').boundingBox();
  assert.ok(actionsAfterScroll.y>=dialogAfterScroll.y&&actionsAfterScroll.y+actionsAfterScroll.height<=dialogAfterScroll.y+dialogAfterScroll.height,'landscape actions remain reachable by scrolling');
  await page.screenshot({path:`/tmp/magic-music-progress-landscape-${sha}.png`});
  await page.locator('#closeSongWizard').click();await page.locator('#localSongWizard').waitFor({state:'hidden'});
  console.log('Workshop progress checks passed: one-page existing import, three-page import, 20-page offline run, monotonic page completion, measured ETA, photo/action spacing, portrait/landscape screenshots, save/retry and cancellation recovery.');
 }finally{if(!page.isClosed())await page.close();if(progressVideo)await progressVideo.saveAs(`/tmp/magic-music-progress-video-${process.env.APP_SOURCE_SHA||'local'}.webm`);await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
