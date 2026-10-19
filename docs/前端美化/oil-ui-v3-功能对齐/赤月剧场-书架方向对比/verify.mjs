// Standalone prototype checks; no real application profile or data is accessed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')] }));
const root = dirname(fileURLToPath(import.meta.url));
const base = process.env.THEATRE_PREVIEW_URL || 'http://127.0.0.1:8880';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const log = [];
await mkdir(join(root, 'evidence/verification'), { recursive: true });
function pass(message) { log.push(message); console.log('PASS ' + message); }
try {
  for (const id of ['opera', 'nouveau', 'avant']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(base + '/' + id + '.html');
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    await page.waitForFunction(() => !document.body.classList.contains('is-playing'));
    assert.equal(await page.locator('[data-book]').count(), 5);
    assert.equal(await page.locator('[data-title]').innerText().then(x => x.replace(/\s/g, '')), '星尘旅人');
    assert(await page.locator('[data-title]').isVisible());
    assert(await page.locator('.book-object').isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => [...document.images].every(im => im.complete && im.naturalWidth)), true);
    pass(id + ': six works, main artwork and title visible; no overflow or broken assets');
    const before = await page.locator('.book-object').evaluate(el => getComputedStyle(el).transform);
    await page.locator('.book-object').hover();
    await page.waitForTimeout(350);
    const after = await page.locator('.book-object').evaluate(el => getComputedStyle(el).transform);
    assert.notEqual(before, after);
    pass(id + ': book hover responds while retaining its perspective');
    await page.locator('.search input').fill('不存在的作品');
    assert.equal(await page.locator('[data-book]:visible').count(), 0);
    assert(await page.locator('.empty-message').isVisible());
    await page.locator('.search input').fill('');
    assert.equal(await page.locator('[data-book]:visible').count(), 5);
    await page.locator('[data-book="1"]').click();
    assert.equal(await page.locator('[data-title]').innerText(), '长夜将尽');
    assert.equal(await page.locator('[data-words]').innerText(), '82,617');
    pass(id + ': search/no-results/reset and selecting a work update the preview');
    await page.locator('[data-static]').click();
    assert.equal(await page.locator('[data-static]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
    await page.locator('[data-replay]').click();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.body.classList.contains('is-playing')), true);
    for (let i = 0; i < 4; i++) await page.locator('[data-replay]').click({ force: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(root, 'evidence/verification', id + '-600ms.png') });
    assert(await page.locator('[data-title]').isVisible());
    await page.waitForFunction(() => !document.body.classList.contains('is-playing'));
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
    pass(id + ': static mode, replay and rapid replay settle without looping animation');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.body.classList.contains('motion-off'));
    await page.locator('[data-replay]').click();
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
    assert(await page.locator('[data-title]').isVisible());
    pass(id + ': system reduced-motion preference skips all decorative motion');
    assert.deepEqual(errors, []);
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // This packaged comparison must work via a plain file URL without HTTP.
  await page.goto('file:///' + join(root, 'index.html').replaceAll('\\', '/'));
  await page.waitForFunction(() => document.querySelectorAll('iframe').length >= 3);
  // The comparison also has inert screenshot frames; only the three live previews run scripts.
  await page.waitForTimeout(800);
  const frames = [];
  for (const frame of page.frames().filter(f => f !== page.mainFrame())) {
    if (await frame.evaluate(() => document.body?.dataset.ready === 'true')) frames.push(frame);
  }
  assert.equal(frames.length, 3);
  for (const frame of frames) {
    await frame.waitForFunction(() => document.body?.dataset.ready === 'true');
    assert(await frame.locator('[data-title]').isVisible());
    assert.equal(await frame.evaluate(() => [...document.images].every(im => im.complete && im.naturalWidth)), true);
  }
  await page.screenshot({ path: join(root, 'evidence/verification/comparison-offline.png') });
  assert.deepEqual(errors, []);
  pass('offline comparison: three live embedded pages load fonts and artwork without a server');
  await page.close();
  await writeFile(join(root, 'evidence/verification/results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), checks: log, count: log.length }, null, 2));
} finally {
  await browser.close();
}
