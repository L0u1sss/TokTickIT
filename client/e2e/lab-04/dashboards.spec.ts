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

test("E2E-03 staff and administrator dashboards match operational scope and drill down", async ({ page }) => {
  if (!process.env.E2E_AUTH_PASSWORD || !process.env.E2E_API_URL) throw new Error("Run npm run test:dashboards:e2e for isolated fixtures.");
  await signIn(page, "queue-browser@example.test");
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");

  const response = await page.request.get(`${process.env.E2E_API_URL}/api/staff/dashboard`);
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.metrics.unassignedOpenCount).toBe(10);
  expect(payload.metrics.ownedByMeOpenCount).toBe(11);
  expect(payload.metrics.byStatus.OPEN).toBe(11);
  expect(payload.metrics.byStatus.NEW).toBe(9);
  expect(payload.metrics.byItPriority).toEqual({ LOW: 0, MEDIUM: 11, HIGH: 12 });
  expect(payload.myActions).toHaveLength(5);
  expect(payload.recentlyUpdated).toHaveLength(5);
  expect(payload.urgentTickets).toHaveLength(5);

  await page.getByRole("link", { name: /Unassigned Open 10/ }).click();
  await expect(page).toHaveURL(/ownerId=unassigned&status=OPEN_GROUP/);
  await expect(page.getByText(/10 tickets/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Owner" })).toHaveValue("unassigned");
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("OPEN_GROUP");

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const actions = page.getByRole("heading", { name: "My Active Actions" }).locator("..");
  await expect(actions.getByRole("listitem")).toHaveCount(5);
  await actions.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/staff\/tickets\/\d+#actions$/);
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 834, height: 1112 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("region", { name: "Operational metrics" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await signIn(page, "admin-browser@example.test");
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
  await expect(page.getByText("Administrator dashboard Action")).toBeVisible();

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await signIn(page, "auth-browser@example.test");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  expect((await page.request.get(`${process.env.E2E_API_URL}/api/staff/dashboard`)).status()).toBe(403);
});
