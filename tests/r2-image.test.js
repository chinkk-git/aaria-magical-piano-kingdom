const assert = require('node:assert/strict');
require('../r2-image.js');
const {inspectPixels}=globalThis.AariaR2Image;
function flat(value){const d=new Uint8ClampedArray(96*96*4);for(let i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=value;d[i+3]=255}return d}
const dark=inspectPixels(flat(40),96,96,1600,2200);assert.ok(dark.warnings.some(w=>w.code==='dark'));assert.ok(dark.warnings.some(w=>w.code==='contrast'));
const low=inspectPixels(flat(180),96,96,600,800);assert.ok(low.warnings.some(w=>w.code==='small'));
const checker=new Uint8ClampedArray(96*96*4);for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4,v=(x+y)%2?25:235;checker[i]=checker[i+1]=checker[i+2]=v;checker[i+3]=255}const clear=inspectPixels(checker,96,96,1600,2200);assert.equal(clear.warnings.length,0);
console.log('R2 image quality tests passed');
