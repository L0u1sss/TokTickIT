import { mkdir, readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function evidence(page: import("@playwright/test").Page, state: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const findings = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(findings.violations.filter(item => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  const directory = "../artifacts/lab-04/screenshots/requester-dashboard";
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${state}.png`, fullPage: true });
}

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
  const database = JSON.parse(await readFile("../artifacts/lab-04/screenshots/requester-dashboard/database-counts.json", "utf8"));
  expect(payload.metrics).toEqual(database.metrics);
  expect(JSON.stringify(payload)).not.toContain("Another requester private ticket");
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
  await page.getByRole("link", { name: /Waiting for You 1/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/status=WAITING_FOR_REQUESTER$/);
  await expect(page.getByText(/Showing 1.1 of 1 tickets/)).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  const resolvedLink = page.getByRole("link", { name: "View recently resolved tickets" });
  const exactLink = await resolvedLink.getAttribute("href");
  await resolvedLink.click();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(exactLink);
  const bounds = new URL(page.url()).searchParams;
  expect(bounds.get("resolvedFrom")).toMatch(/Z$/);
  expect(bounds.get("resolvedBefore")).toMatch(/Z$/);
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("RESOLVED_GROUP");
  await expect(page.getByText(/Showing 1.2 of 2 tickets/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("RESOLVED_GROUP");
  await page.getByRole("link", { name: "Dashboard" }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 834, height: 1112 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("region", { name: "Ticket metrics" })).toBeVisible();
    await evidence(page, `nonzero-${viewport.width}`);
  }

  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/dashboard/requester", async route => { await gate; await route.continue(); });
  await page.reload();
  try {
    await expect(page.getByRole("status", { name: "Loading dashboard" })).toBeVisible();
    await evidence(page, "loading-mobile");
  } finally { release(); }
  await expect(page.getByRole("region", { name: "Ticket metrics" })).toBeVisible();
  await page.unroute("**/api/dashboard/requester");
  await page.route("**/api/dashboard/requester", route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "postgres://admin:secret@private" } }) }));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("We couldn't load your dashboard. Try again.");
  await evidence(page, "safe-failure-mobile");
  await page.unroute("**/api/dashboard/requester");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("region", { name: "Ticket metrics" })).toContainText("21");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await signIn(page, "empty-dashboard@example.test");
  await expect(page.getByRole("heading", { name: "No Tickets yet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ticket metrics" })).toContainText("0");
  await evidence(page, "zero-mobile");
  await expect(page.locator(".dashboard-zero").getByRole("link", { name: "Create Ticket" })).toHaveAttribute("href", "/tickets/new");
});


test("Requester dashboard denies staff and administrators in the UI and direct API", async ({ page }) => {
  for (const email of ["queue-browser@example.test", "admin-browser@example.test"]) {
    await signIn(page, email);
    await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Forbidden" })).toBeVisible();
    expect((await page.request.get(`${process.env.E2E_API_URL}/api/dashboard/requester`)).status()).toBe(403);
    await evidence(page, email.startsWith("admin") ? "forbidden-admin" : "forbidden-staff");
    await page.getByRole("button", { name: "Logout", exact: true }).click();
  }
});
