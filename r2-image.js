(function(root){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  // Operates on a bounded thumbnail generated locally from the immutable source.
  // Metrics are advisory signals; they are not calibrated OCR confidence.
  function inspectPixels(data,width,height,sourceWidth,sourceHeight){
    const count=Math.floor(data.length/4),luminance=new Float32Array(count);let sum=0,edge=0,edgeCount=0;
    for(let i=0,p=0;i<data.length;i+=4,p++){const y=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];luminance[p]=y;sum+=y}
    const mean=sum/Math.max(1,count);let variance=0;for(const y of luminance)variance+=(y-mean)**2;const contrast=Math.sqrt(variance/Math.max(1,count));
    const rowInk=[];for(let y=0;y<height;y++){let ink=0;for(let x=0;x<width;x++){const i=y*width+x;if(luminance[i]<150)ink++;if(x+1<width){edge+=Math.abs(luminance[i]-luminance[i+1]);edgeCount++}if(y+1<height){edge+=Math.abs(luminance[i]-luminance[i+width]);edgeCount++}}rowInk.push(ink/Math.max(1,width))}
    const edgeEnergy=edge/Math.max(1,edgeCount),warnings=[];
    if(Math.max(sourceWidth,sourceHeight)<1000)warnings.push({code:'small',message:'This picture is small; the music may be hard to read.'});
    if(mean<72)warnings.push({code:'dark',message:'This picture looks quite dark. More light may help.'});
    if(mean>246)warnings.push({code:'bright',message:'This picture looks very bright. Reduce glare if you can.'});
    if(contrast<24)warnings.push({code:'contrast',message:'The page and notes do not have much contrast.'});
    if(edgeEnergy<5)warnings.push({code:'blur',message:'The notes may look soft or blurry. Hold the camera steady and retake if needed.'});
    const lineRows=rowInk.filter(r=>r>=.28&&r<=.92).length;
    if(lineRows>0&&lineRows<4&&edgeEnergy>=5)warnings.push({code:'staff-lines',message:'Staff lines are hard to distinguish; check the page preview before continuing.'});
    const band=Math.max(1,Math.ceil(height*.02)),inkRatio=(from,to)=>{let ink=0,total=0;for(let y=from;y<to;y++)for(let x=0;x<width;x++){if(luminance[y*width+x]<150)ink++;total++}return ink/Math.max(1,total)};
    const edgeInk=Math.max(inkRatio(0,band),inkRatio(height-band,height)),innerInk=inkRatio(band,height-band);
    if(edgeInk>.48&&edgeInk-innerInk>.26&&mean>80)warnings.push({code:'edge-risk',message:'Music may reach the photo edge. Check that no notes or staff lines are cut off.'});
    return{mean,contrast,edgeEnergy,staffLineRows:lineRows,edgeInk,warnings};
  }

  function classifyFailure(error){
    const code=String(error?.code||'').toUpperCase(),message=String(error?.message||error||'');
    if(code==='USER_CANCELLED'||/cancelled|canceled/i.test(message))return 'USER_CANCELLED';
    if(code==='STORAGE_QUOTA'||/quota|storage.*space|not enough.*space/i.test(message))return 'STORAGE_QUOTA';
    if(code==='MODEL_INTEGRITY_FAILED'||/integrity|checksum|model.*verified/i.test(message))return 'MODEL_INTEGRITY_FAILED';
    if(code==='DECODE_INVALID'||/could not be opened|decode|unsupported image/i.test(message))return 'DECODE_INVALID';
    if(code==='OMR_TIMEOUT'||/timed? ?out|timeout/i.test(message))return 'OMR_TIMEOUT';
    if(code==='WORKER_START_FAILED'||/worker.*(start|stopped|crash|terminated)|could not start|temporary|transient|networkerror/i.test(message))return 'WORKER_START_FAILED';
    if(code==='MUSICAL_VALIDATION_FAILED'||/needs correction|playable notes|recognized score/i.test(message))return 'MUSICAL_VALIDATION_FAILED';
    if(code==='MUSICXML_PARSE_FAILED'||/unreadable score|musicxml|no measures|no piano notes|no music was found/i.test(message))return 'MUSICXML_PARSE_FAILED';
    if(code==='OMR_OUTPUT_INVALID')return 'OMR_OUTPUT_INVALID';
    return 'UNKNOWN';
  }

  function chooseRecovery({failureClass,attempt,maxAttempts=3,variant='original',adaptationRecommended=false,restartAlreadyUsed=false}){
    if(attempt>=maxAttempts||['USER_CANCELLED','STORAGE_QUOTA','MODEL_INTEGRITY_FAILED','DECODE_INVALID','QUALITY_UNREADABLE'].includes(failureClass))return{retry:false,reason:null};
    if(['WORKER_START_FAILED','OMR_TIMEOUT'].includes(failureClass)&&!restartAlreadyUsed)return{retry:true,variant,restartWorker:true,reason:'transient-worker'};
    if(['OMR_OUTPUT_INVALID','MUSICXML_PARSE_FAILED','MUSICAL_VALIDATION_FAILED'].includes(failureClass)&&adaptationRecommended&&variant==='original')return{retry:true,variant:'balanced',restartWorker:false,reason:'image-variant'};
    return{retry:false,reason:null};
  }

  function validatePage(page,music){
    if(!page||!Array.isArray(page.events)||!Array.isArray(page.barLengths)||!page.barLengths.length||page.barLengths.some(n=>!Number.isFinite(n)||n<=0))throw Object.assign(new Error('The recognized page has incomplete measure structure.'),{code:'MUSICAL_VALIDATION_FAILED'});
    const score={events:page.events,total:page.barLengths.length,barLengths:page.barLengths};
    try{music.validateScore(score)}catch(error){error.code='MUSICAL_VALIDATION_FAILED';throw error}
    for(let i=0;i<page.events.length;i++){
      const event=page.events[i];
      if(!Number.isInteger(event.bar)||event.bar<1||event.bar>page.barLengths.length||!Number.isFinite(event.at)||event.at<0||event.at>=page.barLengths[event.bar-1]+1e-6||!Number.isFinite(event.dur)||event.dur<=0||!Number.isInteger(event.midi)||event.midi<21||event.midi>108)throw Object.assign(new Error('The recognized page needs correction before it can be used.'),{code:'MUSICAL_VALIDATION_FAILED'});
      if(i){const previous=page.events[i-1];if(previous.bar>event.bar||(previous.bar===event.bar&&(previous.at>event.at||(previous.at===event.at&&previous.midi>event.midi))))throw Object.assign(new Error('The recognized notes are not in a valid time order.'),{code:'MUSICAL_VALIDATION_FAILED'})}
    }
    return true;
  }

  root.AariaR2Image={inspectPixels,classifyFailure,chooseRecovery,validatePage};
})(typeof globalThis!=='undefined'?globalThis:this);
