const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = process.env.SONG_SETTINGS_ARTIFACT_DIR || path.join(root, 'song-settings-evidence');
const viewports = [
  { name: 'android-portrait', width: 390, height: 844 },
  { name: 'android-landscape', width: 844, height: 390 },
  { name: 'ipad-portrait', width: 834, height: 1194 },
  { name: 'ipad-landscape', width: 1194, height: 834 },
  { name: 'desktop', width: 1440, height: 900 },
];
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

function serve(dir) {
  const base = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(base, '.' + pathname);
    if (!file.startsWith(base + path.sep) && file !== base) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return res.writeHead(404).end('not found');
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

async function tapMagicSegment(page, key) {
  const point = await page.evaluate(key => {
    const path = document.querySelector(`.v21-wheel-hit[data-key="${key}"]`);
    if (!path) throw Error('Magic Star action path not found: ' + key);
    const box = path.getBBox(), matrix = path.getScreenCTM();
    for (let yi = 1; yi < 24; yi++) for (let xi = 1; xi < 24; xi++) {
      const p = new DOMPoint(box.x + box.width * xi / 24, box.y + box.height * yi / 24);
      if (!path.isPointInFill(p)) continue;
      const screen = p.matrixTransform(matrix), top = document.elementFromPoint(screen.x, screen.y);
      // The central hit circle overlaps the path geometry. Only accept a
      // coordinate where the named segment is the actual topmost target.
      const action = top?.closest?.('.v21-wheel-action');
      if (top === path || action?.dataset.key === key) return { x: screen.x, y: screen.y };
    }
    throw Error('No topmost interactive tap point found for ' + key);
  }, key);
  await page.mouse.click(point.x, point.y);
}

async function openSettings(page) {
  // closeWheel keeps the wheel mounted during its exit transition. Wait for
  // that transition to finish before attempting to reopen it; otherwise a
  // fast sequence after Cancel can click the exiting wheel layer.
  await page.waitForFunction(() => document.querySelector('#v21Wheel')?.hidden === true);
  await page.locator('.v21-star').click();
  await page.waitForFunction(() => document.querySelector('#v21Wheel')?.dataset.state === 'open');
  // The opening screenshot uses a physical-coordinate segment tap. Reopens
  // use the segment's documented keyboard activation so the acceptance flow
  // is not biased by an overlapping neighboring SVG hit path.
  const segment = page.locator('.v21-wheel-hit[data-key="songSettings"]');
  await segment.focus();
  await page.keyboard.press('Enter');
  const state = await page.evaluate(() => {
    const panel = document.querySelector('.v21-practice-panel'), wheel = document.querySelector('#v21Wheel');
    return { panelHidden: panel?.hidden, panelKind: panel?.dataset.panelKind, wheelHidden: wheel?.hidden,
      wheelState: wheel?.dataset.state, activeSong: document.querySelector('#songSelect')?.value,
      focused: document.activeElement?.outerHTML?.slice(0, 180), settingsButtonPressed: document.querySelector('.v21-wheel-action[data-key="songSettings"]')?.getAttribute('aria-pressed') };
  });
  assert.equal(state.panelHidden, false, `Song Settings action did not open its panel: ${JSON.stringify(state)}`);
  assert.equal(state.panelKind, 'songSettings', `Wrong Magic Star panel opened: ${JSON.stringify(state)}`);
  await page.locator('#v21SongSettingsForm').waitFor({ state: 'visible' });
}

async function getSongLevelGeometry(page) {
  return page.locator('.v21-level-button').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { label: button.textContent.trim(), disabled: button.disabled, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, clientWidth: button.clientWidth, scrollWidth: button.scrollWidth, fontSize: getComputedStyle(button).fontSize };
  }));
}

function assertSongLevelGeometry(buttons, viewport, context) {
  assert.deepEqual(buttons.map(button => button.label), ['Original', 'Basic', 'Medium', 'Advanced']);
  for (const button of buttons) {
    assert.ok(button.width >= 40 && button.height >= 40, `${context} ${button.label} touch target is too small: ${JSON.stringify(button)}`);
    assert.ok(button.scrollWidth <= button.clientWidth + 1, `${context} ${button.label} label overflows its button: ${JSON.stringify(button)}`);
    assert.ok(button.x >= 0 && button.y >= 0 && button.right <= viewport.width && button.bottom <= viewport.height, `${context} ${button.label} exceeds viewport: ${JSON.stringify(button)}`);
  }
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
    const a = buttons[i], b = buttons[j];
    const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    assert.ok(overlapX <= 0 || overlapY <= 0, `${context} ${a.label} overlaps ${b.label}`);
  }
}

async function openSongMenu(page) {
  await page.locator('#songPickerButton').click();
  await page.locator('#v21SongMenu').waitFor({ state: 'visible' });
}

async function chooseVersion(page, title, level) {
  const label = `${title} — ${{ original: 'Original', basic: 'Basic', medium: 'Medium', advanced: 'Advanced' }[level]}`;
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function appState(page, id, level) {
  return page.evaluate(({ id, level }) => {
    const song = window.PianoKingdomLibrary.songs[id];
    const arrangement = level === 'original' ? song : song.arrangements[level];
    return {
      selected: document.querySelector('#songSelect').value,
      engineSong: window.AariaV21Engine.state().songId,
      mode,
      eventsMatch: JSON.stringify(EVENTS) === JSON.stringify(arrangement.events),
      eventCount: EVENTS.length,
      measureCount: TOTAL,
      storedLevel: window.PianoKingdomLibrary.getSelectedArrangement(id),
      pickerText: document.querySelector('#songPickerButton').textContent.trim(),
    };
  }, { id, level });
}

async function main() {
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(output, 'recordings'), { recursive: true });
  const current = await serve(root);
  let baseline, browser;
  const results = [], geometry = [];
  try {
    if (process.env.BASELINE_DIR && fs.existsSync(process.env.BASELINE_DIR)) baseline = await serve(process.env.BASELINE_DIR);
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    if (baseline) {
      const baseContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      const basePage = await baseContext.newPage();
      await basePage.goto(baseline.url + '/index.html', { waitUntil: 'domcontentloaded' });
      await basePage.waitForFunction(() => window.AariaV21Engine && window.PianoKingdomLibrary);
      await basePage.locator('.v21-star').click();
      await basePage.waitForFunction(() => document.querySelector('#v21Wheel')?.dataset.state === 'open');
      await tapMagicSegment(basePage, 'songSettings');
      await basePage.locator('#v21SongSettingsForm').waitFor({ state: 'visible' });
      await basePage.screenshot({ path: path.join(output, 'screenshots/00-original-song-settings-defect-390x844.png') });
      await baseContext.close();
    }

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true, serviceWorkers: 'block',
      recordVideo: { dir: path.join(output, 'recordings'), size: { width: 780, height: 1688 } },
    });
    const page = await context.newPage(), pageErrors = [];
    await context.addInitScript(() => {
      const saved = {
        id: 'custom-song-settings-acceptance', title: 'Owner Saved Test Song',
        events: [{ bar: 1, at: 0, dur: 1, midi: 60 }], total: 1, barLengths: [4], bpm: 80, imported: true,
        arrangements: { basic: { events: [{ bar: 1, at: 0, dur: 2, midi: 62 }], total: 1, barLengths: [4], bpm: 80 } },
      };
      if (!localStorage.getItem('aaria-piano-custom-songs-v1')) localStorage.setItem('aaria-piano-custom-songs-v1', JSON.stringify([saved, { id: 'custom-song-settings-legacy', title: 'Legacy Local Song', events: [{ bar: 1, at: 0, dur: 2, midi: 55 }], total: 1, barLengths: [4], bpm: 72, imported: true }]));
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(current.url + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.AariaV21Engine && window.PianoKingdomLibrary?.getSelectedArrangement);
    await page.waitForFunction(() => {
      const songs = window.PianoKingdomLibrary.songs;
      return songs['custom-56bdf66342e6d08d7aee9e106153cd4b77b04dac93699334815aba8a6f984725'] &&
        songs['custom-05080f3486f84fb6d99c2ecb466b778160d50d9ee842b19e0ae2f7c371ac21df'] &&
        songs['custom-song-settings-acceptance'] && songs['custom-song-settings-legacy'];
    });

    const threeId = 'custom-56bdf66342e6d08d7aee9e106153cd4b77b04dac93699334815aba8a6f984725';
    const threeTitle = 'Beautiful things -  Benson Boone';
    const oneId = 'custom-05080f3486f84fb6d99c2ecb466b778160d50d9ee842b19e0ae2f7c371ac21df';
    const oneTitle = 'Flowers - Miley Sirus';
    const originalCatalog = await page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const song = window.PianoKingdomLibrary.songs[id];
      return [id, { events: song.events, arrangements: song.arrangements, meta: { title: song.title, total: song.total, bpm: song.bpm, barLengths: song.barLengths } }];
    })), [threeId, oneId]);

    await page.locator('.v21-star').click();
    await page.waitForFunction(() => document.querySelector('#v21Wheel')?.dataset.state === 'open');
    await page.screenshot({ path: path.join(output, 'screenshots/01-expanded-wheel-390x844.png') });
    await tapMagicSegment(page, 'songSettings');
    await page.locator('#v21SongSettingsForm').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(output, 'screenshots/02-song-settings-opaque-no-overlap-390x844.png') });
    const modal = await page.locator('.v21-practice-panel').evaluate(el => {
      const r = el.getBoundingClientRect(), style = getComputedStyle(el), music = getComputedStyle(document.querySelector('.v21-make-music'));
      return { rect: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }, bg: style.backgroundColor, image: style.backgroundImage, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, musicVisibility: music.visibility, ariaModal: el.getAttribute('aria-modal'), mainInert: document.querySelector('main').inert, starInert: document.querySelector('.v21-star-assembly').inert };
    });
    assert.equal(modal.bg, 'rgb(36, 16, 63)');
    assert.notEqual(modal.image, 'none');
    assert.equal(modal.musicVisibility, 'hidden');
    assert.equal(modal.ariaModal, 'true');
    assert.equal(modal.mainInert, true, 'background app is inert while modal is open');
    assert.equal(modal.starInert, true, 'Magic Star cannot receive background input while modal is open');
    const portraitLevels = await getSongLevelGeometry(page);
    assertSongLevelGeometry(portraitLevels, { width: 390, height: 844 }, 'Android portrait');
    assert.ok(modal.rect.x >= 0 && modal.rect.y >= 0 && modal.rect.right <= 390 && modal.rect.bottom <= 844);
    geometry.push({ viewport: 'android-portrait', width: 390, height: 844, modal, levelButtons: portraitLevels });
    await page.locator('#v21CancelSongSettings').click();
    await page.waitForFunction(() => document.querySelector('.v21-practice-panel')?.hidden);
    assert.equal(await page.locator('.v21-make-music').evaluate(el => getComputedStyle(el).visibility), 'visible');
    await page.screenshot({ path: path.join(output, 'screenshots/03-make-music-restored-after-close-390x844.png') });

    await openSongMenu(page);
    await page.screenshot({ path: path.join(output, 'screenshots/04-song-dropdown-expanded-390x844.png') });
    const menu = await page.evaluate(() => {
      const el = document.querySelector('#v21SongMenu'), r = el.getBoundingClientRect();
      return {
        rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
        items: [...el.querySelectorAll('.v21-song-choice-group')].map(group => ({
          title: group.getAttribute('aria-label'),
          versions: [...group.querySelectorAll('.v21-song-version-choice')].map(button => ({ label: button.textContent, disabled: button.disabled })),
        })),
      };
    });
    assert.ok(menu.rect.x >= 0 && menu.rect.right <= 390 && menu.rect.bottom <= 844);
    assert.deepEqual(menu.items.find(item => item.title === threeTitle).versions.map(item => item.label), ['Original', 'Basic', 'Medium', 'Advanced']);
    assert.deepEqual(menu.items.find(item => item.title === oneTitle).versions.map(item => item.label), ['Original', 'Basic']);
    assert.deepEqual(menu.items.find(item => item.title === 'Legacy Local Song').versions.map(item => item.label), ['Original'], 'legacy data without difficulty metadata is shown as its original score only');
    await page.screenshot({ path: path.join(output, 'screenshots/05-three-level-song-390x844.png') });
    const legacyOriginal = page.getByRole('option', { name: 'Legacy Local Song — Original', exact: true });
    await legacyOriginal.focus(); await page.keyboard.press('Enter');
    assert.equal((await appState(page, 'custom-song-settings-legacy', 'original')).eventsMatch, true, 'legacy original can be selected with keyboard activation');
    results.push({ action: 'keyboard: legacy song Original', result: 'PASS' });
    await openSongMenu(page);

    await chooseVersion(page, threeTitle, 'medium');
    let state = await appState(page, threeId, 'medium');
    assert.equal(state.selected, threeId); assert.equal(state.engineSong, threeId);
    assert.equal(state.eventsMatch, true); assert.equal(state.mode, 'stop'); assert.equal(state.storedLevel, 'medium');
    assert.match(state.pickerText, /Medium/);
    await page.screenshot({ path: path.join(output, 'screenshots/06-medium-selected-390x844.png') });
    results.push({ action: 'dropdown: Beautiful things — Medium', state, result: 'PASS' });

    await openSettings(page);
    assert.equal(await page.locator('[data-level="medium"]').getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: path.join(output, 'screenshots/07-medium-reflected-in-song-settings-390x844.png') });
    await page.locator('[data-level="advanced"]').click();
    await page.locator('#v21CancelSongSettings').click();
    await openSettings(page);
    assert.equal(await page.locator('[data-level="medium"]').getAttribute('aria-pressed'), 'true', 'Cancel discards uncommitted level change');
    await page.locator('[data-level="basic"]').click();
    await page.locator('#v21SaveSongSettings').click();
    await page.waitForFunction(id => window.PianoKingdomLibrary.getSelectedArrangement(id) === 'basic', threeId);
    state = await appState(page, threeId, 'basic');
    assert.match(state.pickerText, /Basic/);
    await page.screenshot({ path: path.join(output, 'screenshots/08-song-settings-saved-basic-390x844.png') });
    await page.locator('#v21WheelClose').click();
    await page.waitForFunction(() => document.querySelector('.v21-practice-panel')?.hidden);

    await openSongMenu(page);
    await page.screenshot({ path: path.join(output, 'screenshots/09-one-level-song-390x844.png') });
    assert.equal(await page.getByRole('option', { name: `${oneTitle} — Advanced`, exact: true }).count(), 0);
    await chooseVersion(page, oneTitle, 'basic');
    state = await appState(page, oneId, 'basic');
    assert.equal(state.eventsMatch, true); assert.equal(state.mode, 'stop');
    results.push({ action: 'dropdown: Flowers — Basic', state, result: 'PASS' });

    await openSongMenu(page);
    await chooseVersion(page, threeTitle, 'medium');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PianoKingdomLibrary?.getSelectedArrangement);
    await openSongMenu(page);
    await page.getByRole('option', { name: threeTitle, exact: true }).click();
    await page.waitForFunction(id => window.PianoKingdomLibrary?.getSelectedArrangement?.(id) === 'medium' &&
      JSON.stringify(EVENTS) === JSON.stringify(window.PianoKingdomLibrary.songs[id].arrangements.medium.events), threeId);
    state = await appState(page, threeId, 'medium');
    assert.equal(state.eventsMatch, true); assert.equal(state.storedLevel, 'medium');
    await page.screenshot({ path: path.join(output, 'screenshots/10-medium-persisted-after-reload-390x844.png') });
    results.push({ action: 'reload persistence: Beautiful things — Medium', state, result: 'PASS' });

    await openSettings(page);
    assert.equal(await page.locator('#v21SongName').isDisabled(), true, 'shared song name is read-only');
    await page.locator('#v21CancelSongSettings').click();
    assert.equal(await page.evaluate(id => window.PianoKingdomLibrary.songs[id].title, threeId), threeTitle, 'shared song name remains protected');
    await openSongMenu(page);
    await chooseVersion(page, 'Owner Saved Test Song', 'basic');
    await openSettings(page);
    await page.locator('#v21SongName').fill('Owner Saved Test Song Renamed');
    await page.locator('#v21SaveSongSettings').click();
    await page.waitForFunction(() => window.PianoKingdomLibrary.songs['custom-song-settings-acceptance']?.title === 'Owner Saved Test Song Renamed' &&
      JSON.parse(localStorage.getItem('aaria-piano-custom-songs-v1') || '[]').some(song => song.id === 'custom-song-settings-acceptance' && song.title === 'Owner Saved Test Song Renamed'));
    assert.equal(await page.evaluate(() => window.PianoKingdomLibrary.songs['custom-song-settings-acceptance'].events[0].midi), 60);
    const localSong = await page.evaluate(() => JSON.parse(localStorage.getItem('aaria-piano-custom-songs-v1') || '[]').find(song => song.id === 'custom-song-settings-acceptance'));
    assert.equal(localSong.title, 'Owner Saved Test Song Renamed');
    results.push({ action: 'Song Settings saves local rename without changing notes', result: 'PASS' });
    await page.locator('#v21WheelClose').click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.v21-make-music')).visibility === 'visible');
    const currentCatalog = await page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const song = window.PianoKingdomLibrary.songs[id];
      return [id, { events: song.events, arrangements: song.arrangements, meta: { title: song.title, total: song.total, bpm: song.bpm, barLengths: song.barLengths } }];
    })), [threeId, oneId]);
    assert.deepEqual(currentCatalog, originalCatalog, 'song events, arrangements, timing and metadata remain unchanged');

    for (const viewport of viewports.slice(1)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openSongMenu(page);
      const menuRect = await page.locator('#v21SongMenu').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
      assert.ok(menuRect.x >= 0 && menuRect.right <= viewport.width && menuRect.y >= 0 && menuRect.bottom <= viewport.height, `${viewport.name} dropdown fits viewport`);
      await page.screenshot({ path: path.join(output, `screenshots/viewport-${viewport.name}-dropdown.png`) });
      await chooseVersion(page, threeTitle, 'basic');
      assert.equal((await appState(page, threeId, 'basic')).eventsMatch, true, `${viewport.name} loads selected arrangement`);
      await openSettings(page);
      const bounds = await page.locator('.v21-practice-panel').evaluate(el => {
        const r = el.getBoundingClientRect(), style = getComputedStyle(el);
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, bg: style.backgroundColor, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
      });
      assert.equal(bounds.bg, 'rgb(36, 16, 63)');
      const levelButtons = await getSongLevelGeometry(page);
      assertSongLevelGeometry(levelButtons, viewport, `${viewport.name} Song Settings`);
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height,
        `${viewport.name} settings exceeds viewport ${viewport.width}x${viewport.height}: ${JSON.stringify(bounds)}`);
      geometry.push({ viewport: viewport.name, width: viewport.width, height: viewport.height, menu: menuRect, modal: bounds, levelButtons });
      await page.screenshot({ path: path.join(output, `screenshots/viewport-${viewport.name}-song-settings.png`) });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('.v21-practice-panel')?.hidden);
      assert.equal(await page.locator('.v21-make-music').evaluate(el => getComputedStyle(el).visibility), 'visible');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await context.setOffline(true);
    await openSongMenu(page); await chooseVersion(page, threeTitle, 'medium');
    assert.equal((await appState(page, threeId, 'medium')).eventsMatch, true, 'loaded local arrangement remains selectable offline');
    await context.setOffline(false);
    results.push({ action: 'offline post-load song/level selection', result: 'PASS' });
    assert.deepEqual(pageErrors, [], 'no browser JavaScript errors');

    fs.writeFileSync(path.join(output, 'geometry-report.json'), JSON.stringify({ viewports: geometry, androidPortraitMenu: menu, browserEmulated: true, physicalDeviceValidation: false }, null, 2));
    fs.writeFileSync(path.join(output, 'interaction-results.md'), `# Song Settings and integrated selector results\n\nAll captures are Chromium browser emulation on this PR source. No physical Android or iPad device was tested.\n\n| Check | Result | Evidence |\n|---|---|---|\n| Original transparent panel defect | Captured from base source | 00-original-song-settings-defect-390x844.png |\n| Opaque settings panel; Make Music hidden beneath it | PASS | 02-song-settings-opaque-no-overlap-390x844.png |\n| Make Music restored after close | PASS | 03-make-music-restored-after-close-390x844.png |\n| Three available levels; exact Medium arrangement | PASS | 04-song-dropdown-expanded-390x844.png; 06-medium-selected-390x844.png |\n| One available level; unavailable levels omitted | PASS | 09-one-level-song-390x844.png |\n| Legacy song without level metadata; keyboard activation | PASS | automated assertion |\n| Settings synchronization and Cancel semantics | PASS | 07-medium-reflected-in-song-settings-390x844.png; 08-song-settings-saved-basic-390x844.png |\n| Save local name and protect shared name | PASS | automated assertion and local-song data check |\n| Per-song level persistence after reload | PASS | 10-medium-persisted-after-reload-390x844.png |\n| Responsive geometry and keyboard dismissal | PASS | viewport screenshots and geometry-report.json |\n| Offline loaded-song selection | PASS | automated assertion |\n| Keyboard selection | PASS | automated assertion |\n| Arrangement/catalogue musical data unchanged | PASS | deep comparison of source events and metadata |\n\n## Measurements\n\n\`${JSON.stringify(geometry, null, 2)}\`\n`);
    fs.writeFileSync(path.join(output, 'test-results.json'), JSON.stringify({ result: 'PASS', baseSha: process.env.BASE_SHA || null, headSha: process.env.APP_SOURCE_SHA || null, results, pageErrors, sourceCatalogueUnchanged: true, physicalDeviceValidation: false }, null, 2));
    await context.close();
    const video = await page.video()?.path();
    if (video && fs.existsSync(video)) fs.renameSync(video, path.join(output, 'recordings/song-settings-selector-interaction.webm'));
    execFileSync('zip', ['-qr', path.join(root, 'AARIA_SONG_SETTINGS_SELECTOR_OWNER_REVIEW.zip'), '.'], { cwd: output });
    console.log(JSON.stringify({ result: 'PASS', screenshots: fs.readdirSync(path.join(output, 'screenshots')), recording: path.join(output, 'recordings/song-settings-selector-interaction.webm'), zip: path.join(root, 'AARIA_SONG_SETTINGS_SELECTOR_OWNER_REVIEW.zip'), geometry }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => current.server.close(resolve));
    if (baseline) await new Promise(resolve => baseline.server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
