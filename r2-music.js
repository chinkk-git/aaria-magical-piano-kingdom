(function(root){
  'use strict';
  const cloneEvent=e=>({bar:e.bar,at:e.at,dur:e.dur,midi:e.midi,hand:e.hand||'right',part:e.part||'piano-rh'});
  function validateScore(score){
    if(!score||!Array.isArray(score.events)||!score.events.length||!Array.isArray(score.barLengths)||!score.barLengths.length)throw new Error('No playable notes were found.');
    const total=score.barLengths.length;
    if(score.events.length>3000||total>1000||score.events.some(e=>!Number.isInteger(e.bar)||e.bar<1||e.bar>total||!Number.isFinite(e.at)||e.at<0||!Number.isFinite(e.dur)||e.dur<=0||!Number.isInteger(e.midi)||e.midi<21||e.midi>108))throw new Error('The recognized score needs correction before it can be used.');
    return true;
  }
  function grouped(score){
    const groups=new Map();
    for(const e of score.events){const key=`${e.bar}:${Math.round(e.at*1000)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)}
    return [...groups.entries()].map(([key,events])=>({key,bar:events[0].bar,at:events[0].at,events})).sort((a,b)=>a.bar-b.bar||a.at-b.at);
  }
  function metrics(score){
    validateScore(score);
    const bars=score.barLengths.length,events=score.events,groups=grouped(score),midi=events.map(e=>e.midi),hands=new Set(events.map(e=>e.hand||'right'));
    const perBar=Array(bars).fill(0);for(const e of events)perBar[e.bar-1]++;
    const maxChord=Math.max(1,...groups.map(g=>g.events.length));
    let leaps=[];for(const hand of hands){const notes=events.filter(e=>(e.hand||'right')===hand).sort((a,b)=>a.bar-b.bar||a.at-b.at||a.midi-b.midi);for(let i=1;i<notes.length;i++)if(notes[i].bar!==notes[i-1].bar||notes[i].at!==notes[i-1].at)leaps.push(Math.abs(notes[i].midi-notes[i-1].midi))}
    const offbeat=events.filter(e=>Math.abs((e.at/2)-Math.round(e.at/2))>0.01).length/Math.max(1,events.length);
    let scoreValue=0;const reasons=[];const avg=events.length/bars,range=Math.max(...midi)-Math.min(...midi),maxLeap=Math.max(0,...leaps);
    if(avg>8){scoreValue+=2;reasons.push('Many notes appear in each measure.')}else if(avg>4){scoreValue++;reasons.push('Several notes appear in each measure.')}
    if(maxChord>=4){scoreValue+=2;reasons.push('Some notes are played together in larger chords.')}else if(maxChord>=2){scoreValue++;reasons.push('Some notes are played together.')}
    if(hands.size>1){scoreValue+=2;reasons.push('The score uses both hands.')} 
    if(range>=25){scoreValue+=2;reasons.push('The notes cover a wide range of the piano.')}else if(range>=16){scoreValue++;reasons.push('The notes cover several piano positions.')}
    if(maxLeap>=16){scoreValue+=2;reasons.push('Some jumps between notes are large.')}else if(maxLeap>=10){scoreValue++;reasons.push('Some jumps between notes need hand movement.')}
    if(offbeat>.45){scoreValue+=2;reasons.push('Many notes fall between the main beats.')}else if(offbeat>.18){scoreValue++;reasons.push('Some notes fall between the main beats.')}
    if(!reasons.length)reasons.push('The detected notes have a small range and few simultaneous notes.');
    const level=scoreValue>=8?'Advanced':scoreValue>=4?'Medium':'Basic';
    return{level,score:scoreValue,reasons,measures:bars,noteCount:events.length,range,maxChord,offbeatRatio:offbeat,method:'early-rule-estimate',limitations:['This is an app estimate, not a formal exam grade.','The reader does not provide calibrated note confidence.','Key-signature, tempo, ornaments, and notation-specific difficulty are not fully assessed.']};
  }
  function makeVersion(score,events,label){return{label,events:events.map(cloneEvent),total:score.barLengths.length,barLengths:score.barLengths.slice(),bpm:score.bpm||72,source:label==='Advanced'?'recognized-original':'generated-rule-based',validation:'structural-only'};}
  function generateArrangements(score){
    validateScore(score);const groups=grouped(score),original=score.events.map(cloneEvent),versions={};const estimate=metrics(score);if(estimate.level==='Advanced')versions.advanced=makeVersion(score,original,'Advanced');
    const basic=[];
    for(let bar=1;bar<=score.barLengths.length;bar++){
      const inBar=groups.filter(g=>g.bar===bar);const byBeat=new Map();
      for(const g of inBar){const beat=Math.floor(g.at/2+1e-7),candidate=g.events.slice().sort((a,b)=>b.midi-a.midi)[0];if(!byBeat.has(beat))byBeat.set(beat,candidate);else if(candidate.midi>byBeat.get(beat).midi)byBeat.set(beat,candidate)}
      for(const source of byBeat.values()){const e=cloneEvent(source);while(e.midi<48)e.midi+=12;while(e.midi>84)e.midi-=12;e.hand='right';e.part='piano-rh';basic.push(e)}
    }
    basic.sort((a,b)=>a.bar-b.bar||a.at-b.at||a.midi-b.midi);
    if(basic.length>0&&basic.length<original.length&&basic.every(e=>e.midi>=21&&e.midi<=108))versions.basic=makeVersion(score,basic,'Basic');
    const medium=[];
    for(const g of groups){
      const left=g.events.filter(e=>e.hand==='left').sort((a,b)=>a.midi-b.midi),right=g.events.filter(e=>e.hand!=='left').sort((a,b)=>b.midi-a.midi);
      const keep=[];if(right.length)keep.push(right[0]);if(left.length)keep.push(left[0]);if(!keep.length)keep.push(g.events.slice().sort((a,b)=>b.midi-a.midi)[0]);
      medium.push(...keep.map(cloneEvent));
    }
    medium.sort((a,b)=>a.bar-b.bar||a.at-b.at||a.midi-b.midi);
    if(medium.length>0&&medium.length<original.length&&medium.every(e=>e.midi>=21&&e.midi<=108))versions.medium=makeVersion(score,medium,'Medium');
    return{versions,unavailable:['basic','medium','advanced'].filter(k=>!versions[k])};
  }
  root.AariaR2Music={validateScore,metrics,generateArrangements};
})(typeof globalThis!=='undefined'?globalThis:this);
