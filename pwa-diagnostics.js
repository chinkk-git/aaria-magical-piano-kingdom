(function(root){
  'use strict';
  const KEY='aaria-piano-diagnostics-v1',LIMIT=200;
  const INSTALL_DIAGNOSTICS='aaria-piano-r2-install-diagnostics-v1',INSTALL_STATE='aaria-piano-r2-install-state-v1';
  const rules={
    app:['build'],
    update:['current','published','state','asset','httpStatus','category','attempt','result'],
    omrDownload:['phase','asset','bytes','totalBytes','percent','attempt','category','errorName','errorCode','reason'],
    omrImport:['stage','operation','pagesDone','pagesTotal','percent','category','pageIndex','attempt','maxAttempts','failureClass','errorName','errorCode','reason','workerAsset','line','column']
  };
  const enumValues={
    state:new Set(['checking','downloading','installing','installed','ready','failed','redundant','timeout','restarting','offline','up-to-date','idle','error']),
    phase:new Set(['preparing','downloading','verifying','ready','failed','worker-start','worker-ready','network-fetch','model-download']),
    stage:new Set(['prescan','recognition','recovery','arranging','saving','complete','failed','check_photos','prepare_photos','recognize_music','recover_page','interpret_notes','create_arrangement','save_song','prepare_reader','completed','needs_attention','paused','worker_error']),
    category:new Set(['network','http','storage','quota','integrity','worker','timeout','unsupported','unknown']),
    operation:new Set(['layout','recognise','init']),
    failureClass:new Set(['USER_CANCELLED','STORAGE_QUOTA','MODEL_INTEGRITY_FAILED','DECODE_INVALID','OMR_TIMEOUT','WORKER_START_FAILED','MUSICAL_VALIDATION_FAILED','MUSICXML_PARSE_FAILED','OMR_OUTPUT_INVALID','OMR_ATTEMPTS_EXHAUSTED','UNKNOWN']),
    result:new Set(['started','same-build','new-build','ready','failed','timeout','restarted'])
  };
  const NUMBER_KEYS=new Set(['httpStatus','attempt','maxAttempts','percent','bytes','totalBytes','pagesDone','pagesTotal','pageIndex','line','column','expectedBytes','actualBytes','chunkIndex','advertisedContentLength','verifiedAt']);
  function safeResource(value){
    if(value===null||value===undefined)return undefined;
    let text=String(value).trim().slice(0,400),host='';
    try{if(/^https?:\/\//i.test(text)){const u=new URL(text);host=u.host;text=u.pathname}}catch{return undefined}
    text=text.split(/[?#]/,1)[0].replace(/\\/g,'/');
    if(/\.(?:png|jpe?g|webp|gif|pdf|mxl|musicxml|mid)$/i.test(text))return '[user-file]';
    const result=(host?host:'')+text;
    return result.length<=180&&/^[A-Za-z0-9._/@:+-]+$/.test(result)&&!/(^|\/)\.\.(\/|$)/.test(result)?result:undefined;
  }
  function safeReason(value){
    if(value===null||value===undefined)return undefined;
    let text=String(value).replace(/[\r\n\t]+/g,' ').trim();
    text=text.replace(/https?:\/\/[^\s)]+/gi,match=>safeResource(match)||'[resource]');
    text=text.replace(/\b[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif|pdf|mxl|musicxml|mid)\b/gi,'[user-file]');
    text=text.replace(/(?:\/storage\/emulated\/0|\/data\/user\/\d+|[A-Z]:\\Users\\)[^\s)]+/gi,'[device-path]');
    text=text.replace(/[^\p{L}\p{N} .,:;()'/_-]/gu,'').slice(0,180).trim();
    return text||'Unspecified local OMR error';
  }
  function safeValue(key,value){
    if(value===null||value===undefined)return undefined;
    if(NUMBER_KEYS.has(key)){const n=Number(value);if(!Number.isFinite(n))return undefined;const rounded=Math.max(0,Math.round(n));return key==='percent'?Math.min(100,rounded):rounded}
    if(key==='asset'||key==='workerAsset'||key==='assetPath'||key==='serviceWorkerScript')return safeResource(value);
    if(key==='reason'||key==='failureReason')return safeReason(value);
    if(key==='build'||key==='current'||key==='published')return typeof value==='string'&&/^aaria-piano-v\d+\.\d+\.\d+$/.test(value)?value:undefined;
    if(key==='serviceWorkerVersion'||key==='version')return typeof value==='string'&&/^[A-Za-z0-9._-]{1,80}$/.test(value)?value:undefined;
    if(key==='expectedSha256'||key==='expectedChunkSha256'||key==='actualChunkSha256')return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():undefined;
    if(key==='errorName')return typeof value==='string'&&/^(Error|TypeError|SyntaxError|RangeError|ReferenceError|NetworkError|AbortError|NotSupportedError|SecurityError|QuotaExceededError|DataCloneError)$/.test(value)?value:undefined;
    if(key==='errorCode')return typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,60}$/.test(value)?value:undefined;
    if(key==='cacheStatus')return typeof value==='string'&&['miss','hit','not-verified','verified'].includes(value)?value:undefined;
    if(key==='contentEncoding')return typeof value==='string'&&/^[A-Za-z0-9._-]{1,32}$/.test(value)?value:undefined;
    if(key==='at')return typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)?value.slice(0,32):undefined;
    if(key==='event')return typeof value==='string'&&/^[a-z][a-z0-9-]{0,48}$/.test(value)?value:undefined;
    if(enumValues[key])return typeof value==='string'&&enumValues[key].has(value)?value:undefined;
    return undefined;
  }
  function read(){
    try{const rows=JSON.parse(root.localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.slice(-LIMIT):[]}catch{return []}
  }
  function parseStored(key){try{return JSON.parse(root.localStorage.getItem(key)||'null')}catch{return null}}
  function readOmrEngine(){
    const raw=parseStored(INSTALL_DIAGNOSTICS),saved=parseStored(INSTALL_STATE),installer={};
    if(raw&&typeof raw==='object'){
      for(const key of ['event','state','attempt','serviceWorkerVersion','at','assetPath','expectedBytes','actualBytes','expectedSha256','expectedChunkSha256','actualChunkSha256','chunkIndex','httpStatus','advertisedContentLength','contentEncoding','cacheStatus','failureReason']){
        const value=safeValue(key,raw[key]);if(value!==undefined)installer[key]=value;
      }
      if(Array.isArray(raw.transitions))installer.transitions=raw.transitions.slice(-12).map(t=>{const row={};for(const key of ['state','event','at']){const value=safeValue(key,t?.[key]);if(value!==undefined)row[key]=value}return row}).filter(row=>Object.keys(row).length);
    }
    const entries=read(),downloads=entries.filter(row=>row.type==='omrDownload'),last=downloads.at(-1),worker={status:'not-seen'};
    if(last){
      const phase=last.phase;
      worker.status=phase==='failed'?'failed':phase==='worker-ready'||phase==='ready'?'ready':['downloading','model-download','network-fetch','verifying','preparing','worker-start'].includes(phase)?'downloading':'not-seen';
      for(const key of ['phase','asset','bytes','totalBytes','percent','at','errorName','errorCode','reason'])if(last[key]!==undefined)worker[key]=last[key];
    }
    const lastFailure=entries.filter(row=>row.type==='omrImport'&&(row.stage==='failed'||row.errorCode||row.failureClass)).at(-1);
    if(lastFailure){worker.lastFailure={};for(const key of ['stage','operation','pageIndex','attempt','maxAttempts','failureClass','errorName','errorCode','reason','workerAsset','line','column','at'])if(lastFailure[key]!==undefined)worker.lastFailure[key]=lastFailure[key]}
    const r2Installer={};
    if(saved&&typeof saved==='object'){
      const value=safeValue('version',saved.version);if(value!==undefined)r2Installer.modelVersion=value;
      const bytes=safeValue('totalBytes',saved.totalBytes);if(bytes!==undefined)r2Installer.totalBytes=bytes;
      r2Installer.workerReady=saved.workerReady===true;
      const verifiedAt=safeValue('verifiedAt',saved.verifiedAt);if(verifiedAt!==undefined)r2Installer.verifiedAt=verifiedAt;
    }
    return{worker,r2Installer:Object.keys(installer).length||Object.keys(r2Installer).length?{...r2Installer,diagnostics:Object.keys(installer).length?installer:null}:null};
  }
  function log(type,details={}){
    if(!Object.prototype.hasOwnProperty.call(rules,type))return;
    const row={at:new Date().toISOString(),type};
    for(const key of rules[type]){const value=safeValue(key,details[key]);if(value!==undefined)row[key]=value}
    const rows=read();
    if(type==='omrImport'&&row.stage==='prepare_reader'){const previous=rows.slice().reverse().find(item=>item.type===type&&item.stage===row.stage&&item.pagesDone===row.pagesDone&&item.pagesTotal===row.pagesTotal&&item.attempt===row.attempt);if(previous&&Date.now()-Date.parse(previous.at)<10000)return}
    if(type==='omrDownload'&&row.asset){const previous=rows.slice().reverse().find(item=>item.type===type&&item.asset===row.asset&&item.attempt===row.attempt);if(previous){const terminal=['failed','ready','worker-ready'].includes(row.phase)||row.percent===100||row.phase!==previous.phase;const crossed=Number.isFinite(row.percent)&&Number.isFinite(previous.percent)&&Math.floor(row.percent/10)>Math.floor(previous.percent/10);if(!terminal&&!crossed)return}}
    rows.push(row);
    try{root.localStorage.setItem(KEY,JSON.stringify(rows.slice(-LIMIT)))}catch{}
  }
  function download(){
    const build=root.AariaPwaUpdateCore?.APP_BUILD;
    const payload={format:'Aaria Piano diagnostics v2',exportedAt:new Date().toISOString(),appBuild:build||'unknown',omrEngine:readOmrEngine(),entries:read()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=root.document.createElement('a');
    a.href=url;a.download='aaria-piano-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
    log('app',{build});
  }
  function categoryFor(value){
    const text=String(value||'').toLowerCase();
    if(/quota|storage|space/.test(text))return 'quota';
    if(/timed out|timeout/.test(text))return 'timeout';
    if(/integrity|checksum|hash/.test(text))return 'integrity';
    if(/\b\d{3}\b|http/.test(text))return 'http';
    if(/network|fetch|offline|connection/.test(text))return 'network';
    if(/worker|wasm|module/.test(text))return 'worker';
    return 'unknown';
  }
  if(root.navigator?.serviceWorker)root.navigator.serviceWorker.addEventListener('message',event=>{
    const data=event.data||{};if(data.type!=='AARIA_SW_INSTALL_ERROR')return;
    const detail=String(data.detail||''),marker='after 3 attempts: ',start=detail.indexOf(marker);
    const asset=start>=0?detail.slice(start+marker.length).split(' ')[0]:undefined,httpStatus=detail.match(/\((\d{3})\)/)?.[1];
    log('update',{state:'failed',asset,httpStatus,category:categoryFor(detail),result:'failed'});
  });
  root.addEventListener?.('aaria:omr-progress',event=>{
    const d=event.detail||{},reason=d.failureReason||d.reason||d.text;
    log('omrDownload',{phase:d.error?'failed':d.phase||(d.busy?'downloading':d.percent>=100?'ready':'verifying'),asset:d.assetPath||d.asset,bytes:d.done,totalBytes:d.total,percent:d.percent,attempt:d.attempt,category:d.error?categoryFor(reason):undefined,errorName:d.errorName,errorCode:d.errorCode,reason:d.error?reason:undefined});
  });
  root.addEventListener?.('aaria-workshop-progress',event=>{
    const d=event.detail||{},page=d.page||{},diag=d.diagnostic||{};
    const percent=page.total>0?Math.round(Math.min(page.completed||0,page.total)/page.total*100):undefined;
    log('omrImport',{stage:d.stage,operation:diag.operation,pagesDone:page.completed,pagesTotal:page.total,percent,category:diag.errorCode==='OMR_TIMEOUT'?'timeout':diag.reason?categoryFor(diag.reason):d.stage==='failed'?'worker':undefined,pageIndex:diag.pageIndex,attempt:diag.attempt,maxAttempts:diag.maxAttempts,failureClass:diag.failureClass,errorName:diag.errorName,errorCode:diag.errorCode,reason:diag.reason,workerAsset:diag.workerAsset,line:diag.line,column:diag.column});
    const engine=d.engine||{};
    if(engine.phase)log('omrDownload',{phase:engine.phase,asset:engine.asset,bytes:engine.bytes,totalBytes:engine.total,percent:engine.total>0?engine.bytes/engine.total*100:undefined,category:engine.category,errorName:engine.errorName,errorCode:engine.errorCode,reason:engine.reason});
    if(diag.operation||diag.errorCode||d.stage==='failed')log('omrImport',{stage:d.stage,operation:diag.operation,pagesDone:page.completed,pagesTotal:page.total,category:diag.errorCode==='OMR_TIMEOUT'?'timeout':diag.reason?categoryFor(diag.reason):undefined,pageIndex:diag.pageIndex,attempt:diag.attempt,maxAttempts:diag.maxAttempts,failureClass:diag.failureClass,errorName:diag.errorName,errorCode:diag.errorCode,reason:diag.reason,workerAsset:diag.workerAsset,line:diag.line,column:diag.column});
  });
  root.AariaDiagnostics={log,download,read};
  const button=root.document?.getElementById('downloadAppDiagnostics');
  if(button)button.addEventListener('click',download);
})(typeof window!=='undefined'?window:globalThis);
