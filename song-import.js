(()=>{
'use strict';
const KEY='aaria-piano-custom-songs-v1';
const $=id=>document.getElementById(id);
const dialog=$('songWizard'),photo=$('scorePhoto'),preview=$('scorePreview'),savePhoto=$('saveScorePhoto'),xmlFile=$('scoreMusicXml'),titleInput=$('scoreSongTitle'),status=$('scoreImportStatus'),summary=$('scoreReviewSummary'),reviewWrap=$('scoreReviewWrap'),rows=$('scoreReviewRows'),save=$('saveScannedSong');
let imageUrl='',draft=null;
$('addSongOpen').addEventListener('click',()=>dialog.showModal());
photo.addEventListener('change',()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);const f=photo.files?.[0];if(!f){preview.hidden=true;return}imageUrl=URL.createObjectURL(f);preview.src=imageUrl;preview.hidden=false;savePhoto.hidden=false;status.textContent='Photo selected. Save it if needed, then choose that photo in the scanner tab.'});
savePhoto.addEventListener('click',()=>{const f=photo.files?.[0];if(!f||!imageUrl)return;const a=document.createElement('a');a.href=imageUrl;a.download=(f.name||'music-sheet-photo').replace(/[^a-z0-9._-]+/gi,'-');a.click()});
const children=(el,name)=>Array.from(el?.children||[]).filter(x=>x.localName===name);
const child=(el,name)=>children(el,name)[0]||null;
const text=(el,name)=>child(el,name)?.textContent?.trim()||'';
const descendants=(el,name)=>Array.from(el?.getElementsByTagName(name)||[]);
function parseMusicXML(source){
 const doc=new DOMParser().parseFromString(source,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('This file is not valid MusicXML. Export an uncompressed .musicxml or .xml file.');
 const root=doc.documentElement;if(root.localName!=='score-partwise')throw Error('Use a partwise MusicXML export (.musicxml or .xml). Compressed MXL files are not supported yet.');
 const partNames=new Map(children(child(root,'part-list'),'score-part').map(p=>[p.getAttribute('id'),text(p,'part-name')]));
 const parts=children(root,'part');if(!parts.length)throw Error('No piano parts were found in that MusicXML file.');
 const byBar=[];let bpm=0,notesSeen=0;
 for(let pi=0;pi<parts.length;pi++){
  const part=parts[pi],id=part.getAttribute('id')||`part-${pi+1}`,partName=partNames.get(id)||'';let divisions=1,beats=4,beatType=4;
  for(const [mi,measure] of children(part,'measure').entries()){
   let attrs=child(measure,'attributes');if(attrs){const d=Number(text(attrs,'divisions'));if(d>0)divisions=d;const time=child(attrs,'time');if(time){const b=text(time,'beats'),bt=Number(text(time,'beat-type'));const n=b.split('+').map(Number).reduce((a,x)=>a+(Number.isFinite(x)?x:0),0);if(n>0)beats=n;if(bt>0)beatType=bt}}
   for(const sound of descendants(measure,'sound')){const t=Number(sound.getAttribute('tempo'));if(!bpm&&t>0)bpm=t}for(const per of descendants(measure,'per-minute')){const t=Number(per.textContent);if(!bpm&&t>0)bpm=t}
   let cursor=0,lastOnset=0,measureEnd=0;const pending=[];
   for(const node of Array.from(measure.children)){
    if(node.localName==='attributes'){const d=Number(text(node,'divisions'));if(d>0)divisions=d;const time=child(node,'time');if(time){const b=text(time,'beats'),bt=Number(text(time,'beat-type'));const n=b.split('+').map(Number).reduce((a,x)=>a+(Number.isFinite(x)?x:0),0);if(n>0)beats=n;if(bt>0)beatType=bt}}
    else if(node.localName==='backup'){cursor=Math.max(0,cursor-(Number(text(node,'duration'))||0))}
    else if(node.localName==='forward'){cursor+=Number(text(node,'duration'))||0;measureEnd=Math.max(measureEnd,cursor)}
    else if(node.localName==='note'){
     const duration=Number(text(node,'duration'))||0,chord=!!child(node,'chord'),grace=!!child(node,'grace'),rest=!!child(node,'rest');const onset=chord?lastOnset:cursor;const pitch=child(node,'pitch');
     if(pitch&&!rest&&duration>0){const step=text(pitch,'step').toUpperCase(),oct=Number(text(pitch,'octave')),alter=Number(text(pitch,'alter'))||0;const pcs={C:0,D:2,E:4,F:5,G:7,A:9,B:11};if(!(step in pcs)||!Number.isFinite(oct))throw Error('A note pitch could not be read.');const midi=12*(oct+1)+pcs[step]+alter;const staff=Number(text(node,'staff'))||1;const hand=staff>=2?'left':'right';const tieNodes=[...children(node,'tie'),...descendants(child(node,'notations'),'tied')];pending.push({bar:mi+1,at:onset*2/divisions,dur:duration*2/divisions,midi,hand,part:`piano-${hand==='left'?'lh':'rh'}`,partKey:`${id}:${staff}`,tieStart:tieNodes.some(x=>x.getAttribute('type')==='start'),tieStop:tieNodes.some(x=>x.getAttribute('type')==='stop')});notesSeen++}
     if(!chord&&!grace){lastOnset=cursor;cursor+=duration;measureEnd=Math.max(measureEnd,cursor)}
    }
   }
   const expected=beats*8/beatType;const length=measure.getAttribute('implicit')==='yes'?Math.max(measureEnd*2/divisions,.25):Math.max(expected,measureEnd*2/divisions);byBar[mi]=Math.max(byBar[mi]||0,length);byBar[`${mi+1}_events`]=[...(byBar[`${mi+1}_events`]||[]),...pending];
  }
 }
 const barLengths=byBar.filter((_,i)=>typeof i==='number');if(!barLengths.length)throw Error('No measures were found in that score.');
 const events=barLengths.flatMap((_,i)=>byBar[`${i+1}_events`]||[]).sort((a,b)=>a.bar-b.bar||a.at-b.at||a.midi-b.midi);
 let absolute=0;const starts=[0];for(const len of barLengths)starts.push(starts.at(-1)+len);for(const e of events)e.absoluteStart=starts[e.bar-1]+e.at;
 const pendingTies=new Map(),merged=[];for(const e of events){const k=`${e.partKey}:${e.midi}`,previous=pendingTies.get(k);if(e.tieStop&&previous){previous.dur=e.absoluteStart+e.dur-previous.absoluteStart;if(e.tieStart)pendingTies.set(k,previous);else pendingTies.delete(k);continue}merged.push(e);if(e.tieStart)pendingTies.set(k,e)}
 const playable=merged.filter(e=>e.midi>=48&&e.midi<=84);if(playable.length!==merged.length){const outside=merged.filter(e=>e.midi<48||e.midi>84).slice(0,8).map(e=>e.midi).join(', ');throw Error(`This song includes notes outside the current keyboard range C3–C6 (MIDI 48–84: ${outside}). It was not imported so no notes are silently lost.`)}
 if(playable.length>3000)throw Error('This score has more than 3,000 notes. Import a shorter selection or one movement at a time.');
 const finalEvents=playable.map(({absoluteStart,partKey,tieStart,tieStop,...e})=>e);if(!finalEvents.length)throw Error('No pitched piano notes were found. Check the photo and MusicXML export.');
 return{events:finalEvents,barLengths,bpm:Math.max(30,Math.min(240,Math.round(bpm||72))),partNames:[...partNames.values()],rawCount:notesSeen};
}
function noteLabel(m){const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];return names[((m%12)+12)%12]+(Math.floor(m/12)-1)}
function renderReview(){rows.replaceChildren();draft.events.forEach((e,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${e.bar}</td><td><span>${noteLabel(e.midi)}</span> <input type="number" min="48" max="84" step="1" value="${e.midi}" aria-label="MIDI pitch for note ${i+1}" data-i="${i}" data-f="midi"></td><td><input type="number" min="0" step="0.125" value="${e.at}" aria-label="Start time for note ${i+1}" data-i="${i}" data-f="at"></td><td><input type="number" min="0.125" step="0.125" value="${e.dur}" aria-label="Length for note ${i+1}" data-i="${i}" data-f="dur"></td><td><select aria-label="Hand for note ${i+1}" data-i="${i}" data-f="hand"><option value="right" ${e.hand==='right'?'selected':''}>R Right</option><option value="left" ${e.hand==='left'?'selected':''}>L Left</option></select></td>`;rows.appendChild(tr)});summary.hidden=false;reviewWrap.hidden=false;summary.textContent=`${draft.events.length} notes • ${draft.events.filter(e=>e.hand==='right').length} right hand • ${draft.events.filter(e=>e.hand==='left').length} left hand • ${draft.barLengths.length} measures • ${draft.bpm} BPM. Durations and rests came from MusicXML.`;save.disabled=false}
xmlFile.addEventListener('change',async()=>{draft=null;save.disabled=true;summary.hidden=true;reviewWrap.hidden=true;rows.replaceChildren();const file=xmlFile.files?.[0];if(!file)return;try{if(file.size>20*1024*1024)throw Error('MusicXML is larger than 20 MB.');const parsed=parseMusicXML(await file.text());draft={...parsed};titleInput.value=titleInput.value.trim()||file.name.replace(/\.(musicxml|xml)$/i,'').replace(/[_-]+/g,' ');renderReview();status.textContent='Score imported. Check the notes, timing, and hand assignments below.'}catch(err){status.textContent=err.message}});
rows.addEventListener('change',e=>{const input=e.target;if(!input.matches('[data-i][data-f]')||!draft)return;const i=Number(input.dataset.i),field=input.dataset.f;let value=input.value;if(field==='midi'||field==='at'||field==='dur')value=Number(value);if(field==='midi'&&(value<48||value>84)){input.value=draft.events[i].midi;status.textContent='Keep pitches within the currently playable C3–C6 keyboard range.';return}if(['at','dur'].includes(field)&&(!Number.isFinite(value)||value<0||(field==='dur'&&value===0))){input.value=draft.events[i][field];return}draft.events[i][field]=value;if(field==='midi')input.title=noteLabel(value)});
save.addEventListener('click',()=>{if(!draft)return;const title=titleInput.value.trim();if(!title){status.textContent='Enter a song name first.';titleInput.focus();return}const id=`custom-${Date.now().toString(36)}`,song={id,title,events:draft.events.map(e=>({...e,part:e.hand==='left'?'piano-lh':'piano-rh'})),total:draft.barLengths.length,barLengths:draft.barLengths,bpm:draft.bpm,imported:true};try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(saved))throw Error();saved.push(song);localStorage.setItem(KEY,JSON.stringify(saved))}catch{status.textContent='Could not save this song on the device. Browser storage may be full or unavailable.';return}window.PianoKingdomLibrary.addSong(song);status.textContent='Song added to this device’s library.';dialog.close();photo.value='';xmlFile.value='';savePhoto.hidden=true;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl='';preview.hidden=true;draft=null;save.disabled=true});
})();
