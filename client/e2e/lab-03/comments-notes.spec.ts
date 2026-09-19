import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("staff/requester communicate with private notes and resolution indication", async ({ page }) => {
  const password = process.env.E2E_AUTH_PASSWORD;
  if (!password) throw new Error("Run node scripts/run-auth-e2e.mjs --communications");
  async function login(email: string) {
    await page.goto("/"); await page.getByLabel("Email", { exact: false }).fill(email);
    await page.getByLabel("Password", { exact: false }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
  }
  await login("queue-browser@example.test");
  await page.getByRole("link", { name: /View ticket/ }).first().click();
  const id = page.url().split("/").pop()!;
  await page.getByLabel("Public Comment", { exact: true }).fill("Please try the printer again. <script>alert(1)</script>");
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText("Public Comment posted.")).toBeVisible();
  await page.getByLabel("Internal Note", { exact: true }).fill("Private diagnostic: cable replaced.");
  await page.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(page.getByText("Internal Note posted.")).toBeVisible();
  await page.reload(); await expect(page.getByText("Private diagnostic: cable replaced.")).toBeVisible();
  await mkdir("../artifacts/lab-03/screenshots/comments-notes", { recursive: true });
  for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 834, 1112], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.getByRole("region", { name: "Public Comments", exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../artifacts/lab-03/screenshots/comments-notes/staff-${name}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await login("auth-browser@example.test"); await page.goto(`/tickets/${id}`);
  await expect(page.getByText("Please try the printer again. <script>alert(1)</script>")).toBeVisible();
  await expect(page.getByText("Private diagnostic: cable replaced.")).toHaveCount(0);
  await expect(page.getByLabel("Internal Note", { exact: true })).toHaveCount(0);
  expect((await page.request.get(`${process.env.E2E_API_URL}/api/staff/tickets/${id}/internal-notes`)).status()).toBe(403);
  await page.getByLabel("Public Comment", { exact: true }).fill("The printer works now.");
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText("Public Comment posted.")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Problem Appears Resolved", exact: true }).click();
  await expect(page.getByText(/Reported at/)).toBeVisible();
  await page.reload(); await expect(page.getByText(/Reported at/)).toBeVisible();
  await expect(page.locator(".status-badge")).toHaveText("Open");
  for (const [name, width, height] of [["desktop", 1440, 1000], ["tablet", 834, 1112], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../artifacts/lab-03/screenshots/comments-notes/requester-${name}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await login("queue-browser@example.test"); await page.goto(`/staff/tickets/${id}`);
  await expect(page.getByText(/Requester reports the problem appears resolved/)).toBeVisible();
  await expect(page.getByText("The printer works now.")).toBeVisible();
});
