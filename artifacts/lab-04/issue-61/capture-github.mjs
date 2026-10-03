import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve('client/package.json'));
const { chromium } = require('playwright');
const output = path.resolve('artifacts/lab-04/issue-61/github');
await fs.mkdir(output, { recursive: true });
try { await fs.copyFile(path.join(output, 'capture-metadata.json'), path.join(output, 'capture-metadata-initial.json')); } catch {}
const targets = [
  { name: 'project-kanban', url: 'https://github.com/users/L0u1sss/projects/7' },
  { name: 'staging-ci-88', url: 'https://github.com/L0u1sss/TokTickIT/actions/runs/37129764540' },
  { name: 'pr70-merged', url: 'https://github.com/L0u1sss/TokTickIT/pull/70' },
  { name: 'pr70-approval', url: 'https://github.com/L0u1sss/TokTickIT/pull/70#pullrequestreview-5401218381' },
  { name: 'main-staging-comparison', url: 'https://github.com/L0u1sss/TokTickIT/compare/main...lab4-staging' },
];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1100 }, deviceScaleFactor: 1, colorScheme: 'light' });
const results = [];
for (const target of targets) {
  const page = await context.newPage();
  const startedAt = new Date().toISOString();
  try {
    const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    if (target.name === 'pr70-approval') {
      const review = page.locator('#pullrequestreview-5401218381').first();
      if (await review.count()) await review.scrollIntoViewIfNeeded();
    }
    const screenshotPath = path.join(output, `${target.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const title = await page.title();
    const visibleText = await page.locator('body').innerText();
    const record = { ...target, startedAt, capturedAt: new Date().toISOString(), finalUrl: page.url(), httpStatus: response?.status(), title, viewport: { width: 1920, height: 1100 }, screenshotPath: path.relative(process.cwd(), screenshotPath).replaceAll('\\', '/'), visibleText };
    results.push(record);
    console.log(JSON.stringify({ name: target.name, status: record.httpStatus, title, textLength: visibleText.length }));
  } catch (error) {
    results.push({ ...target, startedAt, completedAt: new Date().toISOString(), error: String(error) });
    console.log(JSON.stringify({ name: target.name, error: String(error) }));
  } finally { await page.close(); }
}
await fs.writeFile(path.join(output, 'capture-metadata.json'), JSON.stringify({ purpose: 'Actual read-only public GitHub pages, without modifying GitHub content or styling. Main is still prior Lab 3 at capture time.', records: results }, null, 2));
await browser.close();
