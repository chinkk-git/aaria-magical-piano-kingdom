'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { MessageChannel } = require('node:worker_threads');

class Element {
  constructor(){this.hidden=false;this.disabled=false;this.textContent='';this.attributes={};this.listeners={};}
  addEventListener(type,fn){(this.listeners[type] ||= []).push(fn)}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==fn)}
  fire(type='click'){return Promise.all((this.listeners[type]||[]).map(fn=>fn({type,target:this})))}
  setAttribute(key,value){this.attributes[key]=String(value)}
  getAttribute(key){return this.attributes[key]||null}
}
function makeRuntime(source, fixtures){
  const nodes={checkAppUpdate:new Element(),restartAppUpdate:new Element(),appBuildInfo:new Element(),appUpdateStatus:new Element()};
  const dot=new Element(),trigger=new Element();
  let controllerChanges=[];
  const doc={
    visibilityState:'visible',
    getElementById:id=>nodes[id]||null,
    querySelector(selector){if(selector==='.v21-update-dot')return dot;if(selector==='.v21-overflow-trigger')return trigger;if(selector.startsWith('script'))return {getAttribute:()=> './v2.1-ui.js?v='+fixtures.interfaceBuild};if(selector.startsWith('link'))return {getAttribute:()=> './v2.1-ui.css?v='+fixtures.interfaceBuild};return null},
    addEventListener(){}
  };
  const storage=fixtures.storage;
  const makeWorker=build=>({state:'activated',listeners:{},addEventListener(type,fn){(this.listeners[type] ||= []).push(fn)},postMessage(message,ports){if(message.type==='AARIA_GET_BUILD')setTimeout(()=>ports[0].postMessage({type:'AARIA_BUILD',buildId:fixtures.currentBuild}),0);if(message.type==='AARIA_ACTIVATE_UPDATE'){fixtures.currentBuild=build;fixtures.registration.active=this;fixtures.registration.waiting=null;setTimeout(()=>controllerChanges.forEach(fn=>fn()),0)}}});
  const registration={
    active:makeWorker(fixtures.currentBuild),waiting:null,installing:null,listeners:{},
    addEventListener(type,fn){(this.listeners[type] ||= []).push(fn)},
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==fn)},
    async update(){
      const worker=makeWorker(fixtures.publishedBuild);worker.state='installing';this.installing=worker;
      for(const fn of this.listeners.updatefound||[])fn();
      setTimeout(()=>{worker.state='installed';this.installing=null;this.waiting=worker;for(const fn of worker.listeners.statechange||[])fn()},15);
    }
  };
  fixtures.registration=registration;
  const serviceWorker={
    get controller(){return registration.active},
    async getRegistration(){return registration},
    listeners:{},
    addEventListener(type,fn){if(type==='controllerchange')controllerChanges.push(fn);(this.listeners[type] ||= []).push(fn)}
  };
  const win={
    document:doc,navigator:{onLine:true,serviceWorker,AariaPianoPlaybackIsBusy:()=>fixtures.playbackBusy,AariaSongImportIsBusy:()=>false},
    location:{href:'https://app.test/',reload(){fixtures.reloads++}},
    sessionStorage:storage,localStorage:fixtures.localStorage,
    addEventListener(){},dispatchEvent(){},
    AariaPianoPlaybackIsBusy:()=>fixtures.playbackBusy,AariaSongImportIsBusy:()=>false,
    AariaDiagnostics:{log(){}}
  };
  const context={window:win,document:doc,navigator:win.navigator,location:win.location,URL,MessageChannel,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},console,
    setTimeout,clearTimeout,setInterval,clearInterval,
    fetch:async()=>{if(fixtures.fetchFails)throw new Error('fixture network failure');return {ok:true,text:async()=>`const CACHE='${fixtures.publishedBuild}';`}}
  };
  vm.runInNewContext(source,context,{filename:'pwa-update.js'});
  return {win,nodes,dot,trigger,registration,serviceWorker};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const source=fs.readFileSync(require.resolve('../pwa-update.js'),'utf8');
  const storage=new Map();const local=new Map();const localStorage={getItem:key=>local.get(key)||null,setItem:(key,val)=>local.set(key,String(val)),removeItem:key=>local.delete(key)};const session={getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,String(val)),removeItem:key=>storage.delete(key)};
  const oldClientSource=source.replace("const APP_BUILD='aaria-piano-v2.1.17'","const APP_BUILD='aaria-piano-v2.1.16'");
  const fixture={currentBuild:'aaria-piano-v2.1.16',publishedBuild:'aaria-piano-v2.1.16',interfaceBuild:'aaria-piano-v2.1.16',storage:session,localStorage,playbackBusy:false,reloads:0,fetchFails:false};
  let app=makeRuntime(oldClientSource,fixture);
  await app.win.AariaPwaUpdateState.check();
  assert.equal(app.win.AariaPwaUpdateState.getState().phase,'upToDate');
  assert.equal(app.dot.hidden,true,'same installed and published build has no dot');

  fixture.publishedBuild='aaria-piano-v2.1.17';
  await app.win.AariaPwaUpdateState.check();
  assert.equal(app.dot.hidden,false,'confirmed newer build shows the notification dot');
  assert.equal(app.nodes.checkAppUpdate.textContent,'Update Version');
  assert.equal(local.get('aaria-pwa-available-build'),'aaria-piano-v2.1.17','confirmed availability persists across app opens');
  app=makeRuntime(oldClientSource,fixture);
  assert.equal(app.dot.hidden,false,'reopening the app restores the confirmed update dot');

  await app.nodes.checkAppUpdate.fire();
  await delay(40);
  assert.equal(app.win.AariaPwaUpdateState.getState().phase,'ready');
  assert.equal(app.nodes.restartAppUpdate.hidden,false,'ready update offers Restart App');

  fixture.playbackBusy=true;
  await app.nodes.restartAppUpdate.fire();
  assert.equal(fixture.reloads,0,'active playback blocks the restart');
  assert.equal(app.nodes.restartAppUpdate.hidden,false,'restart remains available after the busy warning');
  fixture.playbackBusy=false;
  await app.nodes.restartAppUpdate.fire();
  await delay(30);
  assert.equal(fixture.reloads,1,'safe restart activates the waiting worker');

  fixture.interfaceBuild='aaria-piano-v2.1.17';
  const releaseSource=source;
  app=makeRuntime(releaseSource,fixture);
  await delay(30);
  assert.equal(app.win.AariaPwaUpdateState.getState().phase,'upToDate');
  assert.equal(app.dot.hidden,true,'post-reload service worker and interface verification clears the dot');
  assert.match(app.nodes.appUpdateStatus.textContent,/Update installed and verified: aaria-piano-v2\.1\.17/,'background auto-check preserves the verified restart confirmation');

  app.win.navigator.onLine=false;
  await app.win.AariaPwaUpdateState.check();
  assert.equal(app.win.AariaPwaUpdateState.getState().phase,'offline');
  assert.equal(app.dot.hidden,true,'offline checks do not claim an update');

  app.win.navigator.onLine=true;fixture.fetchFails=true;
  await delay(80);
  await app.win.AariaPwaUpdateState.check();
  assert.equal(app.win.AariaPwaUpdateState.getState().phase,'failed');
  assert.equal(app.dot.hidden,true,'failed checks do not claim an unconfirmed update');
  console.log('PWA update state acceptance passed (same build, update available, ready, busy restart guard, verified install, offline and failed check).');
})().catch(error=>{console.error(error);process.exitCode=1});

