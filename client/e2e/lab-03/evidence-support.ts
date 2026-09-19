import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

export async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

export async function screenEvidence(page: Page, screen: string) {
  const directory = `../artifacts/lab-03/screenshots/${screen}`;
  await mkdir(directory, { recursive: true });
  for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 834, 1112], ["mobile", 390, 844], ["reflow", 720, 450]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await page.locator(".auth-card button, .staff-operation-controls select").all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await accessible(page);
    await page.getByRole("main").focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
