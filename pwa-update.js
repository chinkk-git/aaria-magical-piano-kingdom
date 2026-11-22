(function(root){
  'use strict';
  const APP_BUILD='aaria-piano-v2.1.15';
  const EXPECTED_KEY='aaria-pwa-expected-build';
  const AVAILABLE_KEY='aaria-pwa-available-build';
  const CHANNEL_NAME='aaria-pwa-update-check';
  function parseBuildId(source){const match=String(source||'').match(/const\s+CACHE\s*=\s*['"]([^'"]+)['"]/);return match?.[1]||null}
  function versionParts(value){const match=String(value||'').match(/^aaria-piano-v(\d+)\.(\d+)\.(\d+)$/);return match?match.slice(1).map(Number):null}
  function compareBuilds(left,right){const a=versionParts(left),b=versionParts(right);if(!a||!b)return null;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]?1:-1;return 0}
  function loadedInterfaceBuilds(documentObject){
    const asset=(selector,attribute)=>{const element=documentObject?.querySelector(selector);const value=element?.getAttribute(attribute);if(!value)return null;try{return new URL(value,'https://app.invalid/').searchParams.get('v')}catch{return null}};
    return {updater:APP_BUILD,script:asset('script[src*="v2.1-ui.js"]','src'),style:asset('link[rel="stylesheet"][href*="v2.1-ui.css"]','href')};
  }
  function interfaceMatchesBuild(builds,target){return !!target&&!!builds&&builds.updater===target&&builds.script===target&&builds.style===target}
  function shouldRefreshStaleInterface(builds,activeBuild,publishedBuild){return !!activeBuild&&activeBuild===publishedBuild&&!interfaceMatchesBuild(builds,publishedBuild)}
  const core={APP_BUILD,parseBuildId,compareBuilds,loadedInterfaceBuilds,interfaceMatchesBuild,shouldRefreshStaleInterface};
  root.AariaPwaUpdateCore=core;
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  if(!root.document)return;
  const doc=root.document,check=doc.getElementById('checkAppUpdate'),restart=doc.getElementById('restartAppUpdate'),info=doc.getElementById('appBuildInfo'),status=doc.getElementById('appUpdateStatus');
  if(!check||!restart||!info||!status)return;
  let registration=null,busy=false,waiting=null,pendingQuery=null,lastInstallError=null;
  let persistedAvailableBuild=null;try{persistedAvailableBuild=root.localStorage?.getItem(AVAILABLE_KEY)||null}catch{}
  const state={phase:persistedAvailableBuild?'available':'checking',available:!!persistedAvailableBuild,publishedBuild:persistedAvailableBuild,installedBuild:null,message:''};
  let checkInFlight=null,lastAutomaticCheck=0;
  const AUTO_CHECK_THROTTLE=120000;
  const channel=('BroadcastChannel'in root)?new root.BroadcastChannel(CHANNEL_NAME):null;
  function renderState(message,working=false){
    state.message=message||'';
    check.textContent=state.phase==='available'?'Update Version':state.phase==='ready'?'Update Ready':state.phase==='downloading'?'Downloading…':state.phase==='checking'?'Checking…':state.phase==='failed'&&!state.available?'Try Again':'Check for Updates';
    check.disabled=state.phase==='checking'||state.phase==='downloading'||state.phase==='ready';
    restart.hidden=state.phase!=='ready';
    status.setAttribute('aria-busy',working?'true':'false');
    if(message)status.textContent=message;
    const dot=doc.querySelector('.v21-update-dot');
    const trigger=doc.querySelector('.v21-overflow-trigger');
    if(dot)dot.hidden=!state.available;
    if(trigger)trigger.setAttribute('aria-label',state.available?'More app options, update available':'More app options');
    root.dispatchEvent?.(new CustomEvent('aaria-pwa-update-state',{detail:{...state}}));
  }
  function setPhase(phase,message,options={}){
    state.phase=phase;
    if(Object.prototype.hasOwnProperty.call(options,'available'))state.available=!!options.available;
    if(Object.prototype.hasOwnProperty.call(options,'publishedBuild'))state.publishedBuild=options.publishedBuild;
    if(Object.prototype.hasOwnProperty.call(options,'installedBuild'))state.installedBuild=options.installedBuild;
    try{if(state.available&&state.publishedBuild)root.localStorage?.setItem(AVAILABLE_KEY,state.publishedBuild);else if(!state.available)root.localStorage?.removeItem(AVAILABLE_KEY)}catch{}
    renderState(message,!!options.working);
  }
  renderState('');
  function setStatus(message,working=false){status.textContent=message;status.setAttribute('aria-busy',working?'true':'false')}
  const log=(type,details)=>root.AariaDiagnostics?.log(type,details);
  function localBusy(){try{if(typeof root.AariaPianoPlaybackIsBusy!=='function'||typeof root.AariaSongImportIsBusy!=='function')return true;return !!root.AariaPianoPlaybackIsBusy()||!!root.AariaSongImportIsBusy()||!!doc.querySelector('#scoreReview:not([hidden])')}catch{return true}}
  if(channel)channel.addEventListener('message',event=>{const data=event.data||{};if(data.type==='busy-query')channel.postMessage({type:'busy-reply',requestId:data.requestId,busy:localBusy()});if(data.type==='busy-reply'&&pendingQuery&&data.requestId===pendingQuery.id)pendingQuery.busy.push(!!data.busy)});
  async function allTabsSafe(){if(localBusy())return false;if(!channel)return true;const query={id:String(Date.now())+'-'+Math.random().toString(16).slice(2),busy:[]};pendingQuery=query;channel.postMessage({type:'busy-query',requestId:query.id});await new Promise(resolve=>setTimeout(resolve,180));pendingQuery=null;return query.busy.every(value=>!value)}
  function workerBuild(worker){if(!worker||typeof MessageChannel==='undefined')return Promise.resolve(null);return new Promise(resolve=>{const port=new MessageChannel(),timer=setTimeout(()=>{port.port1.close();resolve(null)},1800);port.port1.onmessage=event=>{clearTimeout(timer);port.port1.close();resolve(event.data?.type==='AARIA_BUILD'?event.data.buildId:null)};try{worker.postMessage({type:'AARIA_GET_BUILD'},[port.port2])}catch{clearTimeout(timer);port.port1.close();resolve(null)}})}
  async function installedBuild(registrationHint){const serviceWorker=root.navigator?.serviceWorker;if(!serviceWorker)return null;let worker=serviceWorker.controller||registrationHint?.active;if(!worker){try{const reg=registrationHint||await serviceWorker.getRegistration('./');worker=reg?.active||null}catch{}}return workerBuild(worker)}
  async function latestBuild(){const url=new URL('./sw.js',root.location.href);url.searchParams.set('version-check',String(Date.now()));const response=await fetch(url.href,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});if(!response.ok)throw new Error('The current app version could not be checked.');const build=parseBuildId(await response.text());if(!build)throw new Error('The published app did not provide a readable build identifier.');return build}
  function persistExpected(build){try{root.sessionStorage.setItem(EXPECTED_KEY,build)}catch{}}
  function updateInfo(build){const loaded=loadedInterfaceBuilds(doc);info.textContent='Interface '+APP_BUILD+' · V2.1 UI '+(loaded.script||'unknown')+' · CSS '+(loaded.style||'unknown')+' · Service worker '+(build||'not verified yet')}
  async function verifyAfterReload(){
    let expected;try{expected=root.sessionStorage.getItem(EXPECTED_KEY)}catch{}
    if(!expected)return;
    const actual=await installedBuild(registration),loaded=loadedInterfaceBuilds(doc);updateInfo(actual);
    if(actual===expected&&interfaceMatchesBuild(loaded,expected)){
      try{root.sessionStorage.removeItem(EXPECTED_KEY)}catch{}
      setPhase('upToDate','Update installed and verified: '+actual,{available:false,publishedBuild:actual,installedBuild:actual});
      log('update',{state:'installed',current:actual,result:'restarted'});
    }else if(actual===expected){
      try{root.sessionStorage.removeItem(EXPECTED_KEY)}catch{}
      setPhase('failed','The service worker is '+actual+', but this screen is older. Close and reopen the app to load the updated interface.',{available:true,publishedBuild:expected,installedBuild:actual});
      log('update',{state:'verification-mismatch',current:actual,interface:loaded});
    }else if(actual){
      try{root.sessionStorage.removeItem(EXPECTED_KEY)}catch{}
      setPhase('failed','The new build could not be verified. Current build: '+actual+'. Check again when ready.',{available:true,publishedBuild:expected,installedBuild:actual});
    }
  }
  async function refreshUpdate(options={}){
    const announce=options.announce!==false;
    if(checkInFlight)return checkInFlight;
    const hadConfirmedAvailability=state.available;
    checkInFlight=Promise.resolve().then(async()=>{
      setPhase('checking',announce?'Checking for updates…':'',{available:state.available,working:announce});
      log('update',{state:'checking',result:'started',automatic:!announce});
      try{
        if(!root.navigator?.onLine){setPhase('offline','Connect to the internet to check for updates.',{available:state.available});return state}
        if(!root.navigator?.serviceWorker){setPhase('failed','This browser cannot check app updates.',{available:state.available});return state}
        const reg=await root.navigator.serviceWorker.getRegistration('./');
        if(!reg){setPhase('failed','The app update service is not ready. Reopen the app online and try again.',{available:state.available});return state}
        registration=reg;
        const [current,published]=await Promise.all([installedBuild(reg),latestBuild()]);
        if(!root.navigator.onLine){setPhase('offline',announce?'Connect to the internet to check for updates.':'',{available:state.available});return state}
        if(!current)throw new Error('The installed app build could not be confirmed. Reopen the app online and try again.');
        updateInfo(current);
        if(shouldRefreshStaleInterface(loadedInterfaceBuilds(doc),current,published)){
          persistExpected(published);
          if(!await allTabsSafe()){
            setPhase('available','The update is installed. Pause playback and finish or close song editing before refreshing.',{available:true,publishedBuild:published,installedBuild:current});
            return state
          }
          setPhase('checking','The app update is installed, but this screen is older. Refreshing the interface…',{available:true,publishedBuild:published,installedBuild:current,working:true});
          root.location.reload();return state
        }
        const comparison=compareBuilds(published,current);
        if(comparison===null)throw new Error('The app versions could not be compared safely.');
        if(comparison<0)throw new Error('The published build is older than the installed build. No update was applied.');
        if(comparison===0){
          if(root.sessionStorage?.getItem(EXPECTED_KEY)){
            await verifyAfterReload();
            if(state.available)return state
          }
          const pending=reg.waiting;
          if(pending){waiting=pending;setPhase('ready','Update ready. Restart App when you are ready.',{available:true,publishedBuild:published,installedBuild:current});return state}
          setPhase('upToDate',announce?"You're up to date: "+current:'',{available:false,publishedBuild:published,installedBuild:current});
          log('update',{state:'up-to-date',current,published,result:'same-build'});
          return state
        }
        waiting=reg.waiting||null;
        if(waiting){setPhase('ready','Update ready. Restart App when you are ready.',{available:true,publishedBuild:published,installedBuild:current});return state}
        setPhase('available',(announce||!hadConfirmedAvailability)?'Update available: '+published+'. Tap Update Version when you are ready.':'',{available:true,publishedBuild:published,installedBuild:current});
        log('update',{state:'available',current,published,result:'new-build'});
        return state
      }catch(error){
        const message=!root.navigator?.onLine?'Connect to the internet to check for updates.':String(error?.message||'Update check failed. Try again when ready.');
        setPhase('failed',message,{available:state.available});
        log('update',{state:'check-failed',result:'failed',message});
        return state
      }finally{checkInFlight=null}
    });
    return checkInFlight
  }
  async function activateWaiting(){
    if(!waiting){const reg=registration||await root.navigator?.serviceWorker?.getRegistration('./');waiting=reg?.waiting||null}
    if(!waiting){await refreshUpdate({announce:true});return}
    if(!await allTabsSafe()){setPhase('ready','Pause playback and finish or close song editing before restarting. The update is still waiting.',{available:true});return}
    let published;
    try{published=await latestBuild()}catch(error){setPhase('ready','The update is ready, but a fresh version check failed. Connect and try again.',{available:true});return}
    const current=await installedBuild(registration);
    if(!current||compareBuilds(published,current)<=0){waiting=null;await refreshUpdate({announce:true});return}
    persistExpected(published);
    setPhase('ready','Preparing to restart…',{available:true,publishedBuild:published,installedBuild:current,working:true});
    log('update',{state:'restarting',published});
    try{waiting.postMessage({type:'AARIA_ACTIVATE_UPDATE'})}catch{setPhase('ready','The update could not be started. Try Restart App again.',{available:true});return}
    setTimeout(async()=>{if((await installedBuild(registration))!==published)setPhase('ready','Restart App when you are ready.',{available:true,publishedBuild:published})},3000)
  }
  async function startUpdate(){
    if(busy)return;
    busy=true;
    try{
      await refreshUpdate({announce:true});
      if(!state.available||state.phase==='ready'||state.phase==='offline'||state.phase==='failed')return;
      if(!await allTabsSafe()){setPhase('available','Pause playback and finish or close song editing before updating.',{available:true,publishedBuild:state.publishedBuild,installedBuild:state.installedBuild});return}
      const reg=registration||await root.navigator.serviceWorker.getRegistration('./');
      if(!reg)throw new Error('The app update service is not ready. Reopen the app online and try again.');
      registration=reg;
      const [current,published]=await Promise.all([installedBuild(reg),latestBuild()]);
      if(!root.navigator.onLine){setPhase('offline','Connect to the internet to update the app.',{available:true});return}
      if(!current)throw new Error('The installed app build could not be confirmed. Reopen the app online and try again.');
      if(compareBuilds(published,current)<=0){waiting=reg.waiting||null;await refreshUpdate({announce:true});return}
      state.available=true;state.publishedBuild=published;state.installedBuild=current;
      if(reg.waiting){waiting=reg.waiting;setPhase('ready','Update ready. Restart App when you are ready.',{available:true,publishedBuild:published,installedBuild:current});return}
      lastInstallError=null;
      setPhase('downloading','Downloading app update…',{available:true,publishedBuild:published,installedBuild:current,working:true});
      log('update',{state:'downloading',current,published,result:'new-build'});
      let installTimer=null,installPoll=null,observedInstalling=null,finishInstall,installResult=null;
      const ready=new Promise(resolve=>{finishInstall=resolve});
      function completeInstall(result){if(installResult!==null)return;installResult=result;clearInterval(installPoll);clearTimeout(installTimer);reg.removeEventListener('updatefound',inspectInstall);finishInstall(result)}
      function inspectInstall(){
        if(reg.waiting){waiting=reg.waiting;setPhase('ready','Update ready. Restart App when you are ready.',{available:true,publishedBuild:published,installedBuild:current});log('update',{state:'ready',published,result:'ready'});completeInstall('ready');return}
        const worker=reg.installing;
        if(worker&&worker!==observedInstalling){
          observedInstalling=worker;log('update',{state:'installing',published});setPhase('downloading','Downloading app update…',{available:true,publishedBuild:published,installedBuild:current,working:true});
          worker.addEventListener('statechange',()=>{if(worker.state==='installed')inspectInstall();else if(worker.state==='redundant'){setPhase('failed',lastInstallError?'Update failed: '+lastInstallError:'The app update could not be installed. Check your connection and try again.',{available:true});completeInstall('failed')}})
        }
      }
      reg.addEventListener('updatefound',inspectInstall);
      installPoll=setInterval(inspectInstall,250);
      installTimer=setTimeout(()=>{setPhase('failed','The app update is taking longer than expected. Try again when ready.',{available:true});log('update',{state:'timeout',published,result:'timeout'});completeInstall('timeout')},120000);
      inspectInstall();
      reg.update().catch(()=>{if(installResult===null){setPhase('failed','The app update could not be checked. Check your connection and try again.',{available:true});completeInstall('failed')}});
      await ready
    }catch(error){
      const message=!root.navigator?.onLine?'Connect to the internet to update the app.':String(error?.message||'Update failed. Try again when ready.');
      setPhase('failed',message,{available:state.available});
      log('update',{state:'failed',category:lastInstallError?'http':'unknown',result:'failed',message})
    }finally{busy=false}
  }
  restart.addEventListener('click',activateWaiting);
  check.addEventListener('click',()=>state.available?startUpdate():refreshUpdate({announce:true}));
  root.AariaPwaUpdateState={getState:()=>({...state}),check:()=>refreshUpdate({announce:true})};
  if(root.navigator?.serviceWorker){
    root.navigator.serviceWorker.addEventListener('message',event=>{const data=event.data||{};if(data.type==='AARIA_SW_INSTALL_ERROR'){lastInstallError=String(data.detail||'Unknown service worker install error').slice(0,180);if(busy)setPhase('failed','Update failed: '+lastInstallError,{available:true});log('update',{state:'failed',category:'http',result:'failed'})}});
    root.navigator.serviceWorker.addEventListener('controllerchange',async()=>{
      let expected;try{expected=root.sessionStorage.getItem(EXPECTED_KEY)}catch{}
      if(!expected)return;
      if(!await allTabsSafe()){setPhase('ready','Update ready. Pause playback, then tap Restart App.',{available:true,publishedBuild:expected});return}
      root.location.reload()
    })
  }
  verifyAfterReload().catch(()=>{});
  installedBuild().then(build=>updateInfo(build));
  function automaticCheck(){
    if(!root.navigator?.onLine||doc.visibilityState==='hidden'||Date.now()-lastAutomaticCheck<AUTO_CHECK_THROTTLE)return;
    lastAutomaticCheck=Date.now();refreshUpdate({announce:false})
  }
  setTimeout(automaticCheck,0);
  root.addEventListener?.('online',automaticCheck);
  root.addEventListener?.('focus',automaticCheck);
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')automaticCheck()});
})(typeof window!=='undefined'?window:globalThis);
