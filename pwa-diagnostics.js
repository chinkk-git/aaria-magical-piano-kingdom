(function(root){
  'use strict';
  const KEY='aaria-piano-diagnostics-v1';
  const LIMIT=200;
  const rules={
    app:['build'],
    update:['current','published','state','asset','httpStatus','category','attempt','result'],
    omrDownload:['phase','bytes','totalBytes','percent','attempt','category'],
    omrImport:['stage','pagesDone','pagesTotal','percent','category']
  };
  const enumValues={
    state:new Set(['checking','downloading','installing','installed','ready','failed','redundant','timeout','restarting','offline','up-to-date']),
    phase:new Set(['preparing','downloading','verifying','ready','failed']),
    stage:new Set(['prescan','recognition','recovery','arranging','saving','complete','failed']),
    category:new Set(['network','http','storage','quota','integrity','worker','unsupported','unknown']),
    result:new Set(['started','same-build','new-build','ready','failed','timeout','restarted'])
  };
  function safeValue(key,value){
    if(value===null||value===undefined)return undefined;
    if(['httpStatus','attempt','percent','bytes','totalBytes','pagesDone','pagesTotal'].includes(key)){
      const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.round(n)):undefined;
    }
    if(typeof value!=='string')return undefined;
    const text=value.trim().slice(0,180);
    if(key==='asset')return /^\.\/[A-Za-z0-9_./?=@%-]{1,170}$/.test(text)?text:undefined;
    if(key==='build'||key==='current'||key==='published')return /^aaria-piano-v\d+\.\d+\.\d+$/.test(text)?text:undefined;
    if(enumValues[key])return enumValues[key].has(text)?text:undefined;
    return undefined;
  }
  function read(){
    try{const rows=JSON.parse(root.localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.slice(-LIMIT):[]}catch{return []}
  }
  function log(type,details={}){
    if(!Object.prototype.hasOwnProperty.call(rules,type))return;
    const row={at:new Date().toISOString(),type};
    for(const key of rules[type]){const value=safeValue(key,details[key]);if(value!==undefined)row[key]=value}
    const rows=read();rows.push(row);
    try{root.localStorage.setItem(KEY,JSON.stringify(rows.slice(-LIMIT)))}catch{}
  }
  function download(){
    const build=rules.app&&root.AariaPwaUpdateCore?.APP_BUILD;
    const payload={format:'Aaria Piano diagnostics v1',exportedAt:new Date().toISOString(),appBuild:build||'unknown',entries:read()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=root.document.createElement('a');
    a.href=url;a.download='aaria-piano-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
    log('app',{build});
  }
  function categoryFor(value){const text=String(value||'').toLowerCase();if(/quota|storage|space/.test(text))return 'quota';if(/integrity|checksum|hash/.test(text))return 'integrity';if(/\b\d{3}\b/.test(text))return 'http';if(/network|fetch|offline|connection/.test(text))return 'network';if(/worker/.test(text))return 'worker';return 'unknown'}
  if(root.navigator?.serviceWorker)root.navigator.serviceWorker.addEventListener('message',event=>{const data=event.data||{};if(data.type!=='AARIA_SW_INSTALL_ERROR')return;const detail=String(data.detail||'');const marker='after 3 attempts: ';const start=detail.indexOf(marker);const asset=start>=0?detail.slice(start+marker.length).split(' ')[0]:undefined;const httpStatus=detail.match(/\((\d{3})\)/)?.[1];log('update',{state:'failed',asset,httpStatus,category:categoryFor(detail),result:'failed'})});
  root.addEventListener?.('aaria:omr-progress',event=>{const d=event.detail||{};const category=d.error?categoryFor(d.text):undefined;log('omrDownload',{phase:d.error?'failed':d.busy?'downloading':d.percent>=100?'ready':'verifying',bytes:d.done,totalBytes:d.total,percent:d.percent,category})});
  root.AariaDiagnostics={log,download,read};
  const button=root.document?.getElementById('downloadAppDiagnostics');
  if(button)button.addEventListener('click',download);
})(typeof window!=='undefined'?window:globalThis);
