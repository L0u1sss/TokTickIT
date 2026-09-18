import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("staff queue: live search, ownership, pagination, detail, browser history and responsive views", async ({ page }) => {
  if (!process.env.E2E_AUTH_PASSWORD) throw new Error("Run node scripts/run-auth-e2e.mjs --staff-queue");
  await page.goto("/staff/tickets");
  await page.getByLabel("Email", { exact: false }).fill("queue-browser@example.test");
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("23 tickets");
  await mkdir("../artifacts/lab-03/screenshots/staff-queue", { recursive: true });
  for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 834, 1112], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
    await expect(page.getByRole("link", { name: /View ticket/ }).first()).toBeVisible();
    await page.screenshot({ path: `../artifacts/lab-03/screenshots/staff-queue/${name}.png` });
    if (name !== "desktop") {
      await page.locator(".staff-cards article").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `../artifacts/lab-03/screenshots/staff-queue/${name}-results.png` });
    }
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Page 2 of 2");
  await page.getByLabel("Search", { exact: true }).fill("printer");
  await page.getByLabel("Owner", { exact: true }).selectOption("me");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("status")).toContainText("1 tickets");
  await expect(page).toHaveURL(/page=1/);
  await page.reload(); await expect(page.getByLabel("Search", { exact: true })).toHaveValue("printer");
  await page.getByRole("link", { name: /View ticket/ }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail", exact: true })).toBeVisible();
  await expect(page.getByText("The office printer cannot be reached from the shared network.")).toBeVisible();
  await page.goBack(); await expect(page.getByLabel("Search", { exact: true })).toHaveValue("printer");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("status")).toContainText("23 tickets");
  await page.getByLabel("Search", { exact: true }).fill("no-such-ticket");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No results match your filters.")).toBeVisible();
  await page.goto("/staff/tickets?page=bad");
  await expect(page.getByRole("alert")).toContainText("Invalid queue query");
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByRole("status")).toContainText("23 tickets");
  await page.getByLabel("Search", { exact: true }).focus(); await page.keyboard.press("Tab");
  await expect(page.getByLabel("Status", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect((await page.request.get(`${process.env.E2E_API_URL}/api/staff/tickets`)).status()).toBe(401);
});
