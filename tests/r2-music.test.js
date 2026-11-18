const assert = require('node:assert/strict');
require('../r2-music.js');
const music = globalThis.AariaR2Music;

function scoreFixture() {
  return {
    title: 'Arrangement fixture', bpm: 90, barLengths: [8, 8],
    events: [
      {bar:1,at:0,dur:2,midi:60,hand:'right'}, {bar:1,at:0,dur:2,midi:48,hand:'left'}, {bar:1,at:0,dur:2,midi:55,hand:'left'},
      {bar:1,at:1,dur:1,midi:62,hand:'right'}, {bar:1,at:2,dur:2,midi:64,hand:'right'}, {bar:1,at:2,dur:2,midi:52,hand:'left'},
      {bar:1,at:4,dur:2,midi:65,hand:'right'}, {bar:2,at:0,dur:2,midi:67,hand:'right'}, {bar:2,at:0,dur:2,midi:55,hand:'left'},
      {bar:2,at:2,dur:2,midi:69,hand:'right'}, {bar:2,at:2,dur:2,midi:57,hand:'left'}, {bar:2,at:4,dur:2,midi:72,hand:'right'}, {bar:2,at:4,dur:2,midi:60,hand:'left'}
    ]
  };
}

const source = scoreFixture();
const before = JSON.stringify(source.events);
const estimate = music.metrics(source);
const generated = music.generateArrangements(source);
assert.ok(['Basic', 'Medium', 'Advanced'].includes(estimate.level));
assert.equal(estimate.method, 'early-rule-estimate');
assert.ok(estimate.reasons.length > 0);
assert.equal(generated.versions.advanced, undefined, 'a Medium estimate must not be mislabeled Advanced');
assert.ok(generated.versions.basic.events.length < source.events.length);
assert.ok(generated.versions.medium.events.length < source.events.length);
assert.equal(generated.versions.basic.total, source.barLengths.length);
assert.ok(generated.versions.basic.events.every(event => event.hand === 'right' && event.midi >= 48 && event.midi <= 84), 'Basic stays in an accessible right-hand range');
assert.equal(generated.versions.medium.total, source.barLengths.length);
assert.deepEqual(generated.unavailable, ['advanced']);
assert.equal(JSON.stringify(source.events), before, 'generation must preserve the original');
const advancedScore={barLengths:[8,8],events:[]};for(let bar=1;bar<=2;bar++)for(let at=0;at<8;at++)for(const midi of [48,55,60,72,88,40])advancedScore.events.push({bar,at,dur:1,midi,hand:midi<60?'left':'right'});const advanced=music.generateArrangements(advancedScore);assert.equal(music.metrics(advancedScore).level,'Advanced');assert.equal(advanced.versions.advanced.events.length,advancedScore.events.length);
for (const version of Object.values(generated.versions)) {
  assert.ok(version.events.every(event => event.midi >= 21 && event.midi <= 108));
  assert.ok(version.events.every(event => event.bar >= 1 && event.bar <= version.total));
}
assert.throws(() => music.generateArrangements({events: [], barLengths: []}), /No playable notes/);
assert.throws(() => music.validateScore({...source, events: [{bar:3,at:0,dur:1,midi:60}]}), /needs correction/);
console.log('R2 music tests passed');
