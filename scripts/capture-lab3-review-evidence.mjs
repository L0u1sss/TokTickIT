import { chromium } from '../client/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const documentPath = new URL('../docs/lab-03/reviewer.md', import.meta.url);
const output = new URL('../docs/lab-03/evidence/reviews/', import.meta.url);
await mkdir(output, { recursive: true });
const document = await readFile(documentPath, 'utf8');
const urls = [...new Set(document.match(/https:\/\/github\.com\/[^\s)]+#pullrequestreview-\d+/g))];
const groups = Map.groupBy(urls, url => url.split('#')[0]);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'en-US', timezoneId: 'Asia/Bangkok' });
const page = await context.newPage();
const records = [];
try {
  for (const [pr, reviews] of groups) {
    const response = await page.goto(pr, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!response?.ok()) throw new Error(`GitHub returned ${response?.status()} for ${pr}`);
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5000))]));
    for (const url of reviews) {
      const id = url.split('#')[1];
      const review = page.locator(`[id="${id}"]`).first();
      await review.waitFor({ state: 'visible', timeout: 15000 });
      const height = await review.evaluate(element => element.getBoundingClientRect().height);
      await page.setViewportSize({ width: 1600, height: Math.max(1100, Math.ceil(height) + 500) });
      // Keep the complete review below GitHub's sticky PR header without altering the page.
      await review.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().top - 200));
      const text = await review.innerText();
      if (text.length < 50 || !/approved|requested changes|reviewed|commented|left a comment/i.test(text)) {
        throw new Error(`Review content missing: ${url}`);
      }
      const filename = `${new URL(pr).pathname.split('/').filter(Boolean).join('-')}-${id}.png`;
      const png = await review.screenshot({ path: fileURLToPath(new URL(filename, output)), animations: 'disabled' });
      records.push({ url, pr, filename, title: await page.title(), capturedAt: new Date().toISOString(), sha256: createHash('sha256').update(png).digest('hex'), text });
      await writeFile(new URL('manifest.json', output), JSON.stringify({ method: 'Unmodified GitHub review DOM element screenshot using Playwright Chromium; public unauthenticated pages.', records }, null, 2) + '\n');
      console.log(`Captured ${records.length}/${urls.length}: ${url}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`Completed: ${records.length} review screenshots.`);
