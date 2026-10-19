import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')] }));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
for (const width of [1440, 1080]) {
 await page.setViewportSize({ width, height: 900 });
 for (const name of ['characters-01', 'characters-03', 'world', 'world-detail']) {
  await page.goto('http://127.0.0.1:8895/%E4%BA%BA%E7%89%A9%E6%B7%B1%E5%8C%96%E4%B8%8E%E8%AE%BE%E5%AE%9A%E9%87%8D%E7%BB%98-v6/' + name + '.html', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
  await page.screenshot({ path: join(root, 'screenshots', name + '-' + width + '.png') });
  console.log(name + ' ' + width + '×900 saved');
 }
}
await browser.close();

