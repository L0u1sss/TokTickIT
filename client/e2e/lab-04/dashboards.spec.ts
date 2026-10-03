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
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
}

test("E2E-03 requester dashboard stays owned, drills down, handles zero data, and fits target viewports", async ({ page }) => {
  if (!process.env.E2E_AUTH_PASSWORD || !process.env.E2E_API_URL || !process.env.E2E_DATABASE_EVIDENCE || !process.env.E2E_EVIDENCE_RUN_ID || !process.env.E2E_FIXTURE_SCHEMA) throw new Error("Run npm run test:requester-dashboard:e2e for isolated fixtures and fresh database evidence.");
  const database = JSON.parse(await readFile(process.env.E2E_DATABASE_EVIDENCE, "utf8"));
  expect(database.runId).toBe(process.env.E2E_EVIDENCE_RUN_ID);
  expect(database.fixtureSchema).toBe(process.env.E2E_FIXTURE_SCHEMA);
  expect(database.sourceSha).toMatch(/^[a-f0-9]{40}$/);
  expect(Date.now() - Date.parse(database.generatedAt)).toBeGreaterThanOrEqual(0);
  expect(Date.now() - Date.parse(database.generatedAt)).toBeLessThan(5 * 60_000);
  await signIn(page, "auth-browser@example.test");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const response = await page.request.get(`${process.env.E2E_API_URL}/api/dashboard/requester`);
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.metrics).toEqual(database.metrics);
  expect(JSON.stringify(payload)).not.toContain("Another requester private ticket");
  expect(payload.recentlyUpdated).toHaveLength(5);
  expect(payload.recentlyResolved.map((ticket: { status: string }) => ticket.status)).toEqual(["Closed", "Resolved"]);

  await expect(page.getByRole("region", { name: "Ticket metrics" })).toContainText(String(database.metrics.openCount));
  await page.getByRole("link", { name: new RegExp(`Open Tickets ${database.metrics.openCount}`) }).click();
  await expect(page).toHaveURL(/\/tickets\?status=OPEN_GROUP$/);
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("OPEN_GROUP");
  await expect(page.getByText(`Showing 1–10 of ${database.metrics.openCount} tickets`, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Recently Updated" })).toBeVisible();
  await page.getByRole("link", { name: /TKT-2026-000023/ }).click();
  await expect(page.getByText("Ticket Detail", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("link", { name: /Waiting for You 1/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/status=WAITING_FOR_REQUESTER$/);
  await expect(page.getByText("Showing 1–1 of 1 tickets", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  const resolvedLink = page.getByRole("link", { name: "View recently resolved tickets" });
  const exactLink = await resolvedLink.getAttribute("href");
  await resolvedLink.click();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(exactLink);
  const bounds = new URL(page.url()).searchParams;
  expect(bounds.get("resolvedFrom")).toMatch(/Z$/);
  expect(bounds.get("resolvedBefore")).toMatch(/Z$/);
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("RESOLVED_GROUP");
  await expect(page.getByText("Showing 1–2 of 2 tickets", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("RESOLVED_GROUP");
  expect(new URL(page.url()).searchParams.get("resolvedFrom")).toBe(bounds.get("resolvedFrom"));
  expect(new URL(page.url()).searchParams.get("resolvedBefore")).toBe(bounds.get("resolvedBefore"));
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
  // This injected response proves client safe-error UX; backend redaction is an API test.
  await expect(page.locator("body")).not.toContainText("postgres://admin:secret@private");
  await evidence(page, "safe-failure-mobile");
  await page.unroute("**/api/dashboard/requester");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("region", { name: "Ticket metrics" })).toContainText(String(database.metrics.openCount));
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await signIn(page, "empty-dashboard@example.test");
  await expect(page.getByRole("heading", { name: "No Tickets yet" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ticket metrics" })).toContainText("0");
  await evidence(page, "zero-mobile");
  await expect(page.locator(".dashboard-zero").getByRole("link", { name: "Create Ticket" })).toHaveAttribute("href", "/tickets/new");
});


test("Requester dashboard redirects staff and administrators to their role home; direct API denies access", async ({ page }) => {
  for (const email of ["queue-browser@example.test", "admin-browser@example.test"]) {
    await signIn(page, email);
    await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/staff\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Forbidden" })).toHaveCount(0);
    expect((await page.request.get(`${process.env.E2E_API_URL}/api/dashboard/requester`)).status()).toBe(403);
    await evidence(page, email.startsWith("admin") ? "role-redirect-admin" : "role-redirect-staff");
    await page.getByRole("button", { name: "Logout", exact: true }).click();
  }
});

test("Legacy My Tickets queries preserve filters, paging, refresh, and browser Back/Forward", async ({ page }) => {
  await signIn(page, "auth-browser@example.test");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  const dashboard = await (await page.request.get(`${process.env.E2E_API_URL}/api/dashboard/requester`)).json();
  const sample = dashboard.recentlyUpdated[0];
  const legacyQuery = new URLSearchParams({ search: "Office workstation", status: "New", requestedPriority: "HIGH", categoryId: String(sample.category.id), relatedSystemId: String(sample.relatedSystem.id), sortBy: "summary", sortOrder: "asc", page: "1", pageSize: "20" });
  await page.goto(`/tickets?${legacyQuery}`);
  await expect(page.getByText("Showing 1–9 of 9 tickets", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("New");
  await expect(page.getByRole("searchbox", { name: "Search tickets" })).toHaveValue("Office workstation");
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveValue(String(sample.category.id));
  await expect(page.getByRole("combobox", { name: "Related System" })).toHaveValue(String(sample.relatedSystem.id));
  await expect(page.getByRole("combobox", { name: "Requested Priority" })).toHaveValue("HIGH");
  await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("summary:asc");
  await expect(page.getByRole("combobox", { name: "Tickets per page" })).toHaveValue("20");
  const legacyApi = await page.request.get(`${process.env.E2E_API_URL}/api/tickets?${legacyQuery}`);
  expect(legacyApi.status()).toBe(200);
  const result = await legacyApi.json();
  expect(result.filters.status).toBe("New");
  expect(result.items.every((item: { status: string }) => item.status === "New")).toBe(true);
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(9);
  const legacyUrl = page.url();
  await page.reload();
  await expect(page.getByText("Showing 1–9 of 9 tickets", { exact: true })).toBeVisible();
  expect(page.url()).toBe(legacyUrl);

  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.getByText("Showing 1–10 of 23 tickets", { exact: true })).toBeVisible();
  const firstPageTickets = await page.getByRole("table").locator("tbody tr td:first-child").allTextContents();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Showing 11–20 of 23 tickets", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  const secondPageUrl = page.url();
  const secondPageTickets = await page.getByRole("table").locator("tbody tr td:first-child").allTextContents();
  expect(secondPageTickets.some(number => firstPageTickets.includes(number))).toBe(false);
  await page.reload();
  await expect(page.getByText("Showing 11–20 of 23 tickets", { exact: true })).toBeVisible();
  expect(page.url()).toBe(secondPageUrl);
  await page.goBack();
  await expect(page.getByText("Showing 1–10 of 23 tickets", { exact: true })).toBeVisible();
  expect(await page.getByRole("table").locator("tbody tr td:first-child").allTextContents()).toEqual(firstPageTickets);
  await page.goForward();
  await expect(page.getByText("Showing 11–20 of 23 tickets", { exact: true })).toBeVisible();
  expect(await page.getByRole("table").locator("tbody tr td:first-child").allTextContents()).toEqual(secondPageTickets);
  await page.getByRole("combobox", { name: "Status" }).selectOption("New");
  await expect(page.getByText("Showing 1–9 of 9 tickets", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
  const newFilterUrl = page.url();
  await page.goBack();
  await expect(page.getByText("Showing 11–20 of 23 tickets", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("");
  await page.goForward();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue("New");
  await expect(page.getByText("Showing 1–9 of 9 tickets", { exact: true })).toBeVisible();
  expect(page.url()).toBe(newFilterUrl);
});

async function staffEvidence(page: import("@playwright/test").Page, state: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const findings = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(findings.violations.filter(item => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  const directory = "../artifacts/lab-04/screenshots/staff-dashboard";
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${state}.png`, fullPage: true });
}

test("E2E-04 staff and administrator dashboards match database metrics, attribution, drill-down, states and viewports", async ({ page }) => {
  if (!process.env.E2E_DATABASE_EVIDENCE) throw new Error("Run npm run test:dashboards:e2e for fresh database fixtures.");
  const database = JSON.parse(await readFile(process.env.E2E_DATABASE_EVIDENCE, "utf8"));
  expect(database.runId).toBe(process.env.E2E_EVIDENCE_RUN_ID);
  expect(database.fixtureSchema).toBe(process.env.E2E_FIXTURE_SCHEMA);
  const labels = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, character => character.toUpperCase());
  for (const email of ["queue-browser@example.test", "admin-browser@example.test"]) {
    await signIn(page, email);
    await expect(page).toHaveURL(/\/staff\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "User Management", exact: true })).toHaveCount(email.startsWith("admin") ? 1 : 0);
    const response = await page.request.get(`${process.env.E2E_API_URL}/api/staff/dashboard`);
    expect(response.status()).toBe(200);
    const payload = await response.json(), expected = database.staff[email];
    expect(payload.metrics).toEqual(expected.metrics);
    for (const list of ["recentlyUpdated", "urgentTickets"]) expect(payload[list].map((row: { id: number }) => row.id)).toEqual(expected[list]);
    const highPriority = page.getByRole("heading", { name: "High Priority Tickets", exact: true }).locator("..");
    await expect(page.getByRole("heading", { name: "Urgent Tickets", exact: true })).toHaveCount(0);
    expect(payload.urgentTickets.every((row: { itPriority: string }) => row.itPriority === "HIGH")).toBe(true);
    await expect(highPriority.getByRole("link")).toHaveCount(payload.urgentTickets.length);
    for (const [index, ticket] of payload.urgentTickets.entries()) await expect(highPriority.getByRole("link").nth(index)).toHaveAttribute("href", `/staff/tickets/${ticket.id}`);
    await expect(page.getByText(/Last refreshed/).locator("time")).toHaveAttribute("datetime", payload.generatedAt);
    expect(payload.myActions.map((row: { id: number; attribution: string[] }) => ({ id: row.id, attribution: row.attribution }))).toEqual(expected.myActions);
    expect(payload.myActions).toHaveLength(5);
    expect(new Set(payload.myActions.map((row: { id: number }) => row.id)).size).toBe(5);
    await expect(page.getByRole("region", { name: "Operational metrics" })).toContainText(String(expected.metrics.ownedByMeOpenCount));
    const actions = page.locator(".staff-dashboard-actions");
    for (const action of payload.myActions) {
      const row = actions.getByRole("link").filter({ hasText: action.description });
      await expect(row).toHaveAttribute("href", `/staff/tickets/${action.ticketId}#actions`);
      for (const attribution of action.attribution) await expect(row).toContainText(labels(attribution));
    }
    for (const [name, query, count] of [
      [`Unassigned Open ${expected.metrics.unassignedOpenCount}`, "ownerId=unassigned&status=OPEN_GROUP", expected.metrics.unassignedOpenCount],
      [`Owned by Me ${expected.metrics.ownedByMeOpenCount}`, "ownerId=me&status=OPEN_GROUP", expected.metrics.ownedByMeOpenCount],
      ...Object.entries(expected.metrics.byStatus).map(([status, count]) => [`${labels(status)} ${count}`, `status=${status}`, count]),
      ...Object.entries(expected.metrics.byItPriority).map(([priority, count]) => [`${labels(priority)} ${count}`, `itPriority=${priority}`, count]),
    ] as Array<[string, string, number]>) {
      await page.getByRole("link", { name: name.startsWith("Unassigned") || name.startsWith("Owned") ? new RegExp(name) : name, exact: true }).click();
      expect(new URL(page.url()).search).toBe(`?${query}`);
      await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
      await expect(page.getByRole("status")).toContainText(`${count} tickets`);
      for (const [key, value] of new URLSearchParams(query)) await expect(page.getByRole("combobox", { name: key === "ownerId" ? "Owner" : key === "itPriority" ? "IT Priority" : "Status", exact: true })).toHaveValue(value);
      await page.getByRole("link", { name: "Dashboard", exact: true }).click();
      await expect(page.locator(".staff-dashboard-actions")).toContainText(payload.myActions[0].description);
    }
    const recent = page.getByRole("heading", { name: "Recently Updated Open Tickets" }).locator("..");
    await recent.getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Ticket Detail", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await page.locator(".staff-dashboard-actions").getByRole("link").first().click();
    await expect(page).toHaveURL(/#actions$/);
    await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
    await expect.poll(async () => page.locator("#actions").evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(150);
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 834, height: 1112 }, { width: 390, height: 844 }, { width: 720, height: 450 }]) {
      await page.setViewportSize(viewport);
      await staffEvidence(page, `${email.startsWith("admin") ? "administrator" : "staff"}-nonzero-${viewport.width}`);
    }
    await page.getByRole("button", { name: "Logout", exact: true }).click();
  }
  await signIn(page, "queue-browser@example.test");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/staff/dashboard", async route => { await gate; await route.continue(); });
  await page.reload();
  try {
    await expect(page.getByRole("status", { name: "Loading staff dashboard" })).toBeVisible();
    await staffEvidence(page, "loading");
  } finally { release(); }
  await expect(page.getByRole("region", { name: "Operational metrics" })).toBeVisible();
  await page.unroute("**/api/staff/dashboard");
  await page.route("**/api/staff/dashboard", route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "postgres://admin:secret@private" } }) }));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("We couldn't load the operational dashboard. Try again.");
  await expect(page.locator("body")).not.toContainText("postgres://admin:secret@private");
  await staffEvidence(page, "safe-failure");
  await page.unroute("**/api/staff/dashboard");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("region", { name: "Operational metrics" })).toBeVisible();
  // UI-only zero fixture; the API suite separately verifies a real empty migrated schema.
  await page.route("**/api/staff/dashboard", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ metrics: { unassignedOpenCount: 0, ownedByMeOpenCount: 0, byStatus: Object.fromEntries(Object.keys(database.staff["queue-browser@example.test"].metrics.byStatus).map(key => [key, 0])), byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 } }, myActions: [], recentlyUpdated: [], urgentTickets: [], generatedAt: new Date().toISOString() }) }));
  await page.reload();
  await expect(page.getByText("No open Tickets.")).toBeVisible();
  await expect(page.getByText("No high-priority Tickets.")).toBeVisible();
  await expect(page.getByText("No Actions recorded by, assigned to, or performed by you.")).toBeVisible();
  await staffEvidence(page, "zero-ui-fixture");
  await page.unroute("**/api/staff/dashboard");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await signIn(page, "auth-browser@example.test");
  await page.goto("/staff/dashboard");
  await expect(page.getByRole("heading", { name: "Forbidden", exact: true })).toBeVisible();
  expect((await page.request.get(`${process.env.E2E_API_URL}/api/staff/dashboard`)).status()).toBe(403);
  await staffEvidence(page, "requester-forbidden");
});
