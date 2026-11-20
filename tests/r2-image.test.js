const assert = require('node:assert/strict');
require('../r2-image.js');
const {inspectPixels,classifyFailure,chooseRecovery,validatePage}=globalThis.AariaR2Image;
function flat(value){const d=new Uint8ClampedArray(96*96*4);for(let i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=value;d[i+3]=255}return d}
const dark=inspectPixels(flat(40),96,96,1600,2200);assert.ok(dark.warnings.some(w=>w.code==='dark'));assert.ok(dark.warnings.some(w=>w.code==='contrast'));
const low=inspectPixels(flat(180),96,96,600,800);assert.ok(low.warnings.some(w=>w.code==='small'));
const checker=new Uint8ClampedArray(96*96*4);for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4,v=(x+y)%2?25:235;checker[i]=checker[i+1]=checker[i+2]=v;checker[i+3]=255}const clear=inspectPixels(checker,96,96,1600,2200);assert.equal(clear.warnings.length,0);
const banner=flat(255);for(let y=6;y<18;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4;banner[i]=banner[i+1]=banner[i+2]=16}assert.ok(inspectPixels(banner,96,96,1600,2200).warnings.some(w=>w.code==='screen-capture'));
assert.equal(classifyFailure(Object.assign(Error('late'),{code:'OMR_TIMEOUT'})),'OMR_TIMEOUT');
assert.equal(classifyFailure(Object.assign(Error('decode'),{code:'DECODE_INVALID'})),'DECODE_INVALID');
assert.deepEqual(chooseRecovery({failureClass:'OMR_TIMEOUT',attempt:1}),{retry:true,variant:'original',restartWorker:true,reason:'transient-worker'});
assert.equal(chooseRecovery({failureClass:'OMR_TIMEOUT',attempt:2,restartAlreadyUsed:true}).retry,false);
assert.deepEqual(chooseRecovery({failureClass:'MUSICXML_PARSE_FAILED',attempt:1,variant:'original',adaptationRecommended:true}),{retry:true,variant:'balanced',restartWorker:false,reason:'image-variant'});
assert.equal(chooseRecovery({failureClass:'MUSICXML_PARSE_FAILED',attempt:1,variant:'original',adaptationRecommended:false}).retry,false);
assert.equal(chooseRecovery({failureClass:'STORAGE_QUOTA',attempt:1,adaptationRecommended:true}).retry,false);
const music={validateScore(score){if(!score.events.length)throw Error('empty')}};
assert.equal(validatePage({events:[{bar:1,at:0,dur:2,midi:60}],barLengths:[8]},music),true);
assert.throws(()=>validatePage({events:[{bar:2,at:0,dur:2,midi:60}],barLengths:[8]},music),{code:'MUSICAL_VALIDATION_FAILED'});
console.log('R2 image quality and bounded recovery tests passed');
