const assert=require('node:assert/strict');
const {measure,projectLane,backingSize}=require('../piano-geometry.js');
const canvas={left:100,top:50,right:500,bottom:350,width:400,height:300};
const keys=[
 {pitch:60,isBlack:false,rect:{left:100,top:350,right:150,bottom:470}},
 {pitch:61,isBlack:true,rect:{left:135,top:350,right:165,bottom:420}},
 {pitch:62,isBlack:false,rect:{left:150,top:350,right:200,bottom:470}}
];
const g=measure(canvas,keys,2);
assert.equal(g.width,400); assert.equal(g.height,300); assert.equal(g.landingY,300);
assert.equal(g.low,60); assert.equal(g.high,62);
for(const key of keys){
 const lane=projectLane(g,key.pitch,g.landingY,200);
 const rect=g.keys.get(key.pitch);
 assert.equal(lane.center,rect.center,'landing center must equal actual key center');
 assert.equal(lane.width,rect.width,'landing width must equal actual key width');
 assert.equal(lane.left,rect.left,'landing left must equal actual key edge');
 assert.equal(lane.isBlack,key.isBlack);
}
const blackNearHorizon=projectLane(g,61,0,200);
assert.equal(blackNearHorizon.center,200);
assert.ok(blackNearHorizon.width<g.keys.get(61).width);
const resized=measure({...canvas,right:900,width:800,bottom:650,height:600},keys.map(k=>({...k,rect:{...k.rect,left:100+(k.rect.left-100)*2,right:100+(k.rect.right-100)*2}})),1.5);
const resizedBlack=projectLane(resized,61,resized.landingY,400);
assert.equal(resizedBlack.center,100); assert.equal(resizedBlack.width,60);
assert.deepEqual(backingSize(g),{width:800,height:600});
console.log('hero geometry deterministic tests: PASS');
