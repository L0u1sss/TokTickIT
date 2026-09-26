import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: false }).fill(email);
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("E2E-03 requester dashboard stays owned, drills down, handles zero data, and fits target viewports", async ({ page }) => {
  if (!process.env.E2E_AUTH_PASSWORD || !process.env.E2E_API_URL) throw new Error("Run npm run test:requester-dashboard:e2e for isolated fixtures.");
  await signIn(page, "auth-browser@example.test");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const response = await page.request.get(`${process.env.E2E_API_URL}/api/dashboard/requester`);
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.metrics).toEqual({ openCount: 21, waitingForRequesterCount: 1 });
  expect(payload.recentlyUpdated).toHaveLength(5);
  expect(payload.recentlyResolved.map((ticket: { status: string }) => ticket.status)).toEqual(["Closed", "Resolved"]);

  await expect(page.getByRole("region", { name: "Ticket metrics" })).toContainText("21");
  await page.getByRole("link", { name: /Open Tickets 21/ }).click();
  await expect(page).toHaveURL(/\/tickets\?status=OPEN_GROUP$/);
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("OPEN_GROUP");
  await expect(page.getByText("Showing 1–10 of 21 tickets")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Recently Updated" })).toBeVisible();
  await page.getByRole("link", { name: /TKT-2026-000023/ }).click();
  await expect(page.getByText("Ticket Detail", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 834, height: 1112 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("region", { name: "Ticket metrics" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await signIn(page, "empty-dashboard@example.test");
  await expect(page.getByRole("heading", { name: "No Tickets yet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ticket metrics" })).toContainText("0");
  await expect(page.locator(".dashboard-zero").getByRole("link", { name: "Create Ticket" })).toHaveAttribute("href", "/tickets/new");
});
