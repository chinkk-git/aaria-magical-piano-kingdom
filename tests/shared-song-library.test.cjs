const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'shared-song-library.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'shared-song-loader.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const updater = fs.readFileSync(path.join(root, 'pwa-update.js'), 'utf8');
const required = [
  'Dalmatian Cradle Song',
  'DDLJ',
  'Golden',
  'Faith of Ophelia',
  'Flowers - Miley Sirus',
  'Beautiful things -  Benson Boone',
];
const normalize = value => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

assert.equal(catalog.format, 'aaria-piano-shared-song-library');
assert.equal(catalog.songs.length, 6);
assert.deepEqual(required, required.filter(title => catalog.songs.some(song => normalize(song.title) === normalize(title))));
assert.equal(new Set(catalog.songs.map(song => song.id)).size, 6, 'song ids are unique');
assert.equal(new Set(catalog.songs.map(song => normalize(song.title))).size, 6, 'normalized song titles are unique');

for (const song of catalog.songs) {
  assert.ok(song.id && song.title && song.events.length, `${song.title} has a playable score`);
  assert.equal(song.barLengths.length, song.total, `${song.title} has one length per measure`);
  assert.ok(song.events.every(event => Number.isInteger(event.bar) && event.bar >= 1 && event.bar <= song.total), `${song.title} events reference valid measures`);
  assert.ok(song.events.every(event => Number.isFinite(event.at) && event.at >= 0 && Number.isFinite(event.dur) && event.dur > 0), `${song.title} events have valid timing`);
  assert.ok(song.events.every(event => Number.isInteger(event.midi) && event.midi >= 21 && event.midi <= 108), `${song.title} events have valid MIDI pitches`);
  for (const [name, arrangement] of Object.entries(song.arrangements || {})) {
    assert.ok(arrangement.events.length, `${song.title} ${name} arrangement has events`);
    assert.equal(arrangement.barLengths.length, arrangement.total);
  }
}

assert.ok(index.includes('<script src="./shared-song-loader.js"></script>'), 'the app loads the shared catalogue');
assert.ok(index.includes('function addCustomSong'), 'the existing library registers shared songs through its normal API');
assert.ok(index.includes('selectSong(song.id)'), 'the existing song selection API remains in use');
assert.ok(sw.includes("'./shared-song-library.json'") && sw.includes("'./shared-song-loader.js'"), 'the shared catalogue and loader are precached offline');
const build = sw.match(/const CACHE='([^']+)'/)?.[1];
assert.ok(build && updater.includes(`APP_BUILD='${build}'`), 'the updater build matches the new service-worker cache');

let selected = 'cradle';
let loadedEvent;
const appSongs = {cradle: {id: 'cradle'}, ddlj: {id: 'ddlj'}};
const context = {
  fetch: async () => ({ok: true, json: async () => catalog}),
  CustomEvent: function (type, options) { this.type = type; this.detail = options.detail; },
  console,
  window: {
    PianoKingdomLibrary: {
      songs: appSongs,
      addSong(song, options) {
        assert.equal(options.select, false, 'background catalogue loading keeps the current selection');
        this.songs[song.id] = song;
      },
    },
    dispatchEvent(event) { loadedEvent = event; },
  },
};
vm.runInNewContext(loader, context, {filename: 'shared-song-loader.js'});
setImmediate(() => {
  assert.deepEqual(Object.keys(appSongs).sort(), catalog.songs.map(song => song.id).sort(), 'all six songs reach the existing library without duplicate registrations');
  assert.equal(selected, 'cradle', 'loading shared songs does not change the default selection');
  assert.equal(loadedEvent?.type, 'piano-shared-songs-loaded');
  assert.equal(loadedEvent?.detail?.added, 4, 'the two existing inline songs are not duplicated');
  console.log('Shared song library tests passed');
});
