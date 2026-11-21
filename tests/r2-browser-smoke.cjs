const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const sharedCatalog=JSON.parse(fs.readFileSync(path.join(root,'shared-song-library.json'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)})});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('aaria-piano-custom-songs-v1',JSON.stringify([{id:'custom-legacy-preserved',title:'Legacy Saved Song',events:[{bar:1,at:0,dur:2,midi:60,hand:'right'}],total:1,barLengths:[8],bpm:80,imported:true}])));
 const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 try{
  await page.route('**/omr-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* test worker intentionally waits for cancellation */'}));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PianoKingdomLibrary?.saveSong);
  const appReady=await page.evaluate(()=>({library:!!window.PianoKingdomLibrary,omr:!!window.AariaR2Music,quality:!!window.AariaR2Image}));
  assert.deepEqual(appReady,{library:true,omr:true,quality:true});
  await page.waitForFunction(()=>window.PianoKingdomLibrary.songs['custom-legacy-preserved']);
  await page.evaluate(async()=>{const events=[];for(let beat=0;beat<4;beat++){events.push({bar:1,at:beat*2,dur:2,midi:60+beat*2,hand:'right',part:'piano-rh'},{bar:1,at:beat*2,dur:2,midi:48+beat*2,hand:'left',part:'piano-lh'},{bar:1,at:beat*2,dur:2,midi:55+beat*2,hand:'left',part:'piano-lh'})}const score={events,total:1,barLengths:[8],bpm:90};const generated=window.AariaR2Music.generateArrangements(score,{scoreVerified:true});const song={id:'custom-r2-browser-smoke',title:'Release 2 Browser Check',...score,imported:true,difficulty:window.AariaR2Music.metrics(score),arrangements:generated.versions};await window.PianoKingdomLibrary.saveSong(song);window.PianoKingdomLibrary.addSong(song,{select:false})});
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());
  const dlg=page.locator('#mySongsDialog');await dlg.waitFor({state:'visible'});
  const legacy=page.locator('.library-card').filter({hasText:'Legacy Saved Song'});await legacy.waitFor();await legacy.locator('.v21-song-details summary').click();
  await legacy.getByRole('button',{name:'▶ Play'}).click();await page.waitForFunction(()=>document.querySelector('#songSelect')?.value==='custom-legacy-preserved');
  assert.equal(await dlg.evaluate(el=>el.open),false,'legacy saved song migrated and plays in this visit');
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());
  const builtIn=page.locator('.library-card').filter({hasText:'Cradle Song'});await builtIn.waitFor();await builtIn.locator('.v21-song-details summary').click();
  await builtIn.getByRole('button',{name:'▶ Play'}).click();await page.waitForFunction(()=>document.querySelector('#songSelect')?.value==='cradle');
  assert.equal(await dlg.evaluate(el=>el.open),false,'built-in song selection closes the Library');
  await page.waitForFunction(ids=>ids.every(id=>window.PianoKingdomLibrary?.songs[id]),sharedCatalog.songs.map(song=>song.id));
  await page.waitForFunction(()=>window.AariaV21Engine&&document.querySelector('.v21-dock')&&window.AariaPianoNavigation?.openSongs);
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());
  for(const song of sharedCatalog.songs){
    const card=page.locator('.library-card').filter({hasText:song.title});
    const cardCount=await card.count();
    if(cardCount!==1){
      const diagnostic=await page.evaluate(()=>({
        dialogOpen:document.querySelector('#mySongsDialog')?.open,
        dialogText:document.querySelector('#mySongsDialog')?.textContent?.slice(0,700),
        cards:[...document.querySelectorAll('#mySongsDialog .library-card')].slice(0,12).map(x=>x.querySelector('.library-title')?.textContent),
        sharedSongs:Object.values(window.PianoKingdomLibrary?.songs||{}).filter(x=>x?.sharedCatalog).map(x=>({id:x.id,title:x.title})).slice(0,12)
      }));
      assert.equal(cardCount,1,song.title+' appears once in the shared song library; runtime='+JSON.stringify(diagnostic));
    }
    assert.match(await card.locator('.library-meta').textContent(),/Built-in/,song.title+' has the same built-in library status as bundled songs');
    await card.locator('.v21-song-details summary').click();
    const actualVersions=await card.locator('.library-version option').evaluateAll(options=>options.map(option=>option.value));
    const expectedVersions=['original',...['basic','medium','advanced'].filter(level=>song.arrangements?.[level]?.events?.length)];
    assert.deepEqual(actualVersions,expectedVersions,song.title+' exposes its bundled arrangements');
  }
  await page.locator('#closeMySongs').click();
  for(const song of sharedCatalog.songs){
    await page.locator('#songPickerButton').click();
    await page.locator('#v21SongMenu').getByRole('option',{name:song.title,exact:true}).click();
    const state=await page.evaluate(id=>{
      const selected=window.PianoKingdomLibrary.songs[id];
      return {
        selected:document.querySelector('#songSelect').value,
        activeId:window.AariaV21Engine.state().songId,
        sourceEventsMatch:JSON.stringify(EVENTS)===JSON.stringify(selected.events),
        total:selected.total,
        eventCount:selected.events.length,
        hasPlaybackControls:!!document.getElementById('v21Play')&&!!document.getElementById('v21Sound')&&!!document.getElementById('speed')&&!!document.getElementById('v21Zoom'),
      };
    },song.id);
    assert.equal(state.selected,song.id,song.title+' selects from the visible V2.1 song picker');
    assert.equal(state.activeId,song.id,song.title+' opens in the V2.1 playback engine');
    assert.equal(state.sourceEventsMatch,true,song.title+' retains the catalogue event data on selection');
    assert.equal(state.total,song.total,song.title+' retains its measure count');
    assert.equal(state.eventCount,song.events.length,song.title+' retains its event count');
    assert.equal(state.hasPlaybackControls,true,song.title+' uses the V2.1 playback controls');
    await page.evaluate(()=>AariaV21Engine.setMeasure(2));
    assert.equal((await page.evaluate(()=>AariaV21Engine.state().currentMeasure)),2,song.title+' supports measure navigation');
    await page.locator('#v21Sound').click();
    assert.equal(await page.locator('#v21Sound').getAttribute('aria-pressed'),'false',song.title+' supports Sound Off');
    await page.locator('#v21Sound').click();
    assert.equal(await page.locator('#v21Sound').getAttribute('aria-pressed'),'true',song.title+' supports Sound On');
    await page.locator('#speed').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.locator('#v21Play').click();
    await page.waitForFunction(()=>mode==='countdown');
    await page.waitForFunction(()=>mode==='follow',{timeout:7000});
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>mode==='follow'&&EVENTS.length>0),true,song.title+' initializes Play Along with its notes');
    await page.evaluate(()=>AariaV21Engine.setLoop(2,2,true));
    assert.equal(await page.evaluate(()=>AariaV21Engine.state().loopEnabled),true,song.title+' can loop a selected measure');
    await page.evaluate(()=>AariaV21Engine.setLoop(1,1,false));
    await page.locator('#v21Play').click();
    await page.waitForFunction(()=>mode==='stop'&&pausedMode==='follow');
  }
  await page.evaluate(()=>window.PianoKingdomLibrary.selectSong('cradle'));
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());
  const card=page.locator('.library-card').filter({hasText:'Release 2 Browser Check'});await card.waitFor();await card.locator('.v21-song-details summary').click();
  assert.deepEqual(await card.locator('select option').evaluateAll(opts=>opts.map(o=>o.value)),['original','basic','medium']);
  await card.locator('select').selectOption('medium');await card.getByRole('button',{name:'▶ Play'}).click();
  await page.waitForFunction(()=>document.querySelector('#songSelect')?.value==='custom-r2-browser-smoke');
  assert.equal(await dlg.evaluate(el=>el.open),false,'selecting Play returns to the piano');
  await page.evaluate(async()=>{
    const song={id:'custom-play-again-state',title:'Play Again State Fixture',events:[{bar:1,at:0,dur:2,midi:60,hand:'right'},{bar:2,at:0,dur:2,midi:62,hand:'right'}],total:2,barLengths:[8,8],bpm:240,imported:true,difficulty:{level:'easy',reasons:[]},arrangements:{}};
    await window.PianoKingdomLibrary.saveSong(song);window.PianoKingdomLibrary.addSong(song,{select:false});window.PianoKingdomLibrary.selectSong(song.id);
  });
  assert.equal(await page.locator('#v21Play').isDisabled(),false,'READY exposes the available Play Along action');
  await page.locator('#speed').evaluate(el=>{el.value='120';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.locator('#v21Sound').click();assert.equal(await page.locator('#v21Sound').getAttribute('aria-pressed'),'false','Sound Off mutes sound without disabling visual playback');
  await page.locator('#v21Sound').click();assert.equal(await page.locator('#v21Sound').getAttribute('aria-pressed'),'true','Sound On restores the sound preference');
  await page.evaluate(()=>AariaV21Engine.setMeasure(2));assert.match(await page.locator('#position').textContent(),/Measure 2 of 2/,'Measure control updates the displayed measure');
  await page.evaluate(()=>AariaV21Engine.setLoop(2,2,true));
  await page.evaluate(()=>applyPianoLayout('hero',false));await page.locator('#v21Play').click();await page.waitForFunction(()=>mode==='countdown');await page.waitForFunction(()=>mode==='follow');
  await page.locator('#v21Play').click();await page.waitForFunction(()=>mode==='stop'&&pausedMode==='follow');assert.match(await page.locator('#v21Play').textContent(),/Resume/,'PLAYING to PAUSED displays Resume');
  await page.locator('#v21Play').click();await page.waitForFunction(()=>mode==='follow');assert.match(await page.locator('#v21Play').textContent(),/Pause/,'PAUSED to PLAYING displays Pause');
  await page.waitForTimeout(1900);assert.equal(await page.evaluate(()=>mode==='follow'&&bar===2),true,'loop mode repeats the selected measure instead of completing');
  await page.evaluate(()=>AariaV21Engine.setLoop(2,2,false));await page.waitForFunction(()=>mode==='completed',{timeout:10000});
  assert.match(await page.locator('#pause').textContent(),/Play Again/,'COMPLETED exposes the Play Again action');
  assert.match(await page.locator('#status').textContent(),/Song complete.*Play Again/,'completion status announces the available restart action');
  await page.screenshot({path:`/tmp/piano-playback-state-390x844-${process.env.APP_SOURCE_SHA||'local'}.png`});
  await page.locator('#v21Play').click();await page.waitForFunction(()=>mode==='follow'&&bar===1&&beat<1,{timeout:5000});
  assert.equal(await page.locator('#v21Play').isDisabled(),false,'restarted playback is active at the first measure');
  assert.equal(await page.locator('#bar').inputValue(),'1','Play Again updates the selected measure control to measure 1');
  await page.screenshot({path:`/tmp/piano-playback-restart-390x844-${process.env.APP_SOURCE_SHA||'local'}.png`});
  await page.setViewportSize({width:844,height:390});await page.locator('#v21Play').click();await page.waitForFunction(()=>mode==='stop'&&pausedMode==='follow');assert.match(await page.locator('#v21Play').textContent(),/Resume/,'playback can be paused before switching layouts');
  await page.evaluate(()=>applyPianoLayout('hero',false));
  assert.equal(await page.locator('#primaryModeButton').textContent(), '▶ Play Along','Hero remains the only exposed gameplay layout');
  assert.equal(await page.locator('#pianoLayoutSelect option[value=classic]').evaluate(el=>el.disabled),true,'Classic is unavailable while its stored preference is preserved');
  assert.equal(await page.evaluate(()=>AariaV21Engine.state().layout),'hero','the shared engine remains in Hero after the temporary layout gate');
  await page.locator('#v21Play').click();await page.waitForFunction(()=>mode==='follow',{timeout:5000});
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:`/tmp/piano-playback-state-844x390-${process.env.APP_SOURCE_SHA||'local'}.png`});

  const bounds=await page.locator('.v21-star').boundingBox();assert.ok(bounds&&bounds.width>=44&&bounds.height>=44,'Magic Star has a visible touch target');
  await page.evaluate(()=>window.AariaPianoNavigation.openSongs());await page.locator('#makeNewSong').click();
  const wizard=page.locator('#localSongWizard');await wizard.waitFor({state:'visible'});
  assert.match(await page.locator('#localSongWizardTitle').textContent(),/Add New Song/);
  assert.match(await page.locator('#makeSong').textContent(),/Make Music/);
  assert.equal(await page.locator('#readyActions').isVisible(),false,'a new import does not ask for review or approval');
  assert.equal(await page.locator('.workshop-stage-list').count(),0,'the import uses a single screen without staged review navigation');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600"><rect width="1200" height="1600" fill="white"/><g stroke="black" stroke-width="5">'+[200,220,240,260,280].map(y=>`<path d="M90 ${y}H1110"/>`).join('')+'</g><g fill="black">'+[180,340,500,660,820,980].map((x,i)=>`<ellipse cx="${x}" cy="${215+(i%5)*10}" rx="15" ry="10"/>`).join('')+'</g></svg>';
  const png64=await page.evaluate(async svg=>{const img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1600;canvas.getContext('2d').drawImage(img,0,0);URL.revokeObjectURL(url);return canvas.toDataURL('image/png').split(',')[1]},svg);
  await page.locator('#scorePhotos').setInputFiles({name:'sample-score.png',mimeType:'image/png',buffer:Buffer.from(png64,'base64')});
  await page.locator('#scorePhotoPreviews img').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-photo-action],.crop-editor,.score-photo-controls button').count(),0,'manual crop, rotate and photo-adjustment controls are absent');
  await page.locator('#makeSong').click();
  await page.waitForFunction(()=>document.querySelector('#scoreImportStatus')?.getAttribute('aria-busy')==='true');
  await page.locator('#keepPlaying').click();assert.equal(await wizard.evaluate(el=>el.open),false,'Magic Bubble minimizes the workshop');
  const bubble=page.locator('.magic-song-bubble');await bubble.waitFor({state:'visible'});await page.screenshot({path:`/tmp/r2-bubble-minimized-390x844-${process.env.APP_SOURCE_SHA||'local'}.png`});await bubble.click();assert.equal(await wizard.evaluate(el=>el.open),true,'Magic Bubble restores the workshop');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#cancelSongJob').click();await page.waitForFunction(()=>document.querySelector('#makeSong')?.textContent.includes('Continue reading'));
  const saved=await page.evaluate(async()=>new Promise((resolve,reject)=>{const req=indexedDB.open('aaria-piano-workshop',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const tx=req.result.transaction('jobs'),get=tx.objectStore('jobs').get('active');get.onsuccess=()=>resolve(get.result)}}));
  assert.equal(saved.photos.length,1);assert.ok(saved.completedPages.length===0||saved.completedPages.every(Boolean));
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.magic-song-bubble').waitFor({state:'visible'});await page.locator('.magic-song-bubble').click();await page.locator('#localSongWizard').waitFor({state:'visible'});await page.locator('#recoveredJob').waitFor({state:'visible'});
  assert.match(await page.locator('#recoveredJobInfo').textContent(),/page finished/);
  assert.ok(pageErrors.length===0,`browser runtime errors: ${pageErrors.join('; ')}`);
  console.log('R2 browser smoke passed: Library selection/playback, single-screen photo import without manual adjustment, minimization, cancel and reload recovery. OMR recognition itself is not exercised by the test worker.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error(err);process.exitCode=1});

