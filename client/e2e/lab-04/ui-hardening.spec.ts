import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

// Deterministic UI fixtures; real API/database evidence is produced by the
// existing dashboard, Action and workflow suites, never inferred from this file.
const date = "2026-10-03T10:00:00.000Z";
const longName = "ชื่อผู้ใช้งาน" + "VeryLongStaffDisplayName".repeat(4);
const person = { id: 1, displayName: longName, email: "staff@example.test", role: "IT_STAFF" };
const other = { id: 2, displayName: "Niran Support", email: "niran@example.test", role: "IT_STAFF" };
const metadata = { categories: [{ id: 1, name: "Hardware" }], relatedSystems: [{ id: 1, name: "Office network" }] };
const attachment = { id: 7, fileName: "diagnostic".repeat(20) + ".pdf", mediaType: "application/pdf", sizeBytes: 1024, uploadedAt: date, isRemoved: false, removedAt: null, removalReason: null, downloadable: true };
const ticket = { id: 42, ticketNumber: "TKT-2026-000042", summary: "Network diagnostic " + "LongSummary".repeat(16), description: "รายละเอียด " + "NetworkDiagnostic".repeat(60), version: 3, status: "OPEN", requestedPriority: "HIGH", itPriority: "HIGH", requester: { ...person, role: "REQUESTER" }, owner: null, category: metadata.categories[0], relatedSystem: metadata.relatedSystems[0], createdAt: date, updatedAt: date, resolvedAt: null, attachments: [attachment], activeAttachmentCount: 1 };
const action = { id: 10, description: "Inspect network cables", status: "PLANNED", result: null, recordedBy: other, performedBy: null, assignee: person, followUpRequired: true, followUpNote: "Verify next shift", attachmentNotes: attachment.fileName, revision: 1, createdAt: date, updatedAt: date, completedAt: null, cancelledAt: null, cancelledBy: null, cancellationSource: null };
const actions = [action, { ...action, id: 11, description: "Completed diagnostic", status: "COMPLETED", assignee: other, performedBy: other, result: "Checked the connection", followUpRequired: false, followUpNote: null, completedAt: date }, { ...action, id: 12, description: "Cancelled follow-up", status: "CANCELLED", cancelledAt: date, cancelledBy: other, cancellationSource: "TICKET_CASCADE" }];
const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const staffDashboard = { metrics: { unassignedOpenCount: 2, ownedByMeOpenCount: 1, byStatus: Object.fromEntries(statuses.map(status => [status, status === "OPEN" ? 3 : 0])), byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 3 } }, myActions: [{ ...action, ticketId: 42, ticketNumber: ticket.ticketNumber, ticketSummary: ticket.summary, attribution: ["RECORDED", "ASSIGNED"] }], recentlyUpdated: [ticket], urgentTickets: [ticket], generatedAt: date };
const requesterDashboard = { metrics: { openCount: 3, waitingForRequesterCount: 1 }, recentlyUpdated: [ticket], recentlyResolved: [], recentlyResolvedWindow: { from: "2026-09-26T10:00:00.000Z", before: date }, generatedAt: date };
const viewports = [{ name: "desktop", width: 1440, height: 900 }, { name: "tablet", width: 834, height: 1112 }, { name: "mobile", width: 390, height: 844 }, { name: "reflow", width: 720, height: 450 }] as const;
type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "http://127.0.0.1:4173", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-csrf-token", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" }, body: JSON.stringify(body) });
}
async function fixtures(page: Page, role: Role) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return json(route, {});
    if (path === "/api/auth/me") return json(route, { user: { ...person, role, mustChangePassword: false } });
    if (path === "/api/metadata") return json(route, metadata);
    if (path === "/api/dashboard/requester") return json(route, requesterDashboard);
    if (path === "/api/staff/dashboard") return json(route, staffDashboard);
    if (path === "/api/staff/assignees") return json(route, { items: [person, other] });
    if (path.endsWith("/actions")) return json(route, { items: actions });
    if (path.endsWith("/comments") || path.endsWith("/internal-notes")) return json(route, { items: [] });
    if (/\/tickets\/42$/.test(path)) return json(route, ticket);
    if (path === "/api/tickets" || path === "/api/staff/tickets") return json(route, { items: [ticket], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }, sort: { by: "createdAt", order: "desc" }, filters: { search: null, status: null, categoryId: null, relatedSystemId: null, requestedPriority: null } });
    if (path === "/api/admin/users") return json(route, { items: [{ ...person, role, isActive: true, mustChangePassword: false, createdAt: date, updatedAt: date }, { ...other, isActive: true, mustChangePassword: false, createdAt: date, updatedAt: date }] });
    throw new Error(`Unexpected fixture request: ${route.request().method()} ${path}`);
  });
}

async function capture(page: Page, folder: string, state: string, viewport: string) {
  const focus = await page.evaluateHandle(() => document.activeElement);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  await focus.evaluate(element => { if (element instanceof HTMLElement && element.isConnected) element.focus({ preventScroll: true }); });
  await focus.dispose();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  const layout = await page.evaluate(() => {
    const visible = (element: HTMLElement) => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
    const surface = document.querySelector('[role="dialog"], dialog[open]') ?? document;
    const controls = [...surface.querySelectorAll<HTMLElement>("button, input:not([type=checkbox]), textarea, select, .app-navigation-link, .dashboard-metric, .dashboard-list a")].filter(visible);
    const bounds = controls.map(element => ({ name: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 60) || element.id, rect: element.getBoundingClientRect().toJSON(), outline: getComputedStyle(element).outlineStyle }));
    const outside = bounds.filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1);
    const overlaps = bounds.flatMap((a, index) => bounds.slice(index + 1).filter(b => a.rect.left < b.rect.right - 1 && a.rect.right > b.rect.left + 1 && a.rect.top < b.rect.bottom - 1 && a.rect.bottom > b.rect.top + 1).map(b => [a.name, b.name]));
    const clipped = [...document.querySelectorAll<HTMLElement>(".app-header-inner strong, .dashboard-heading p, .action-description, .action-metadata dd, .staff-queue h2, .attachment-name")].filter(visible).filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent?.slice(0, 60));
    return { pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, outside, overlaps, clipped, bounds, primary: getComputedStyle(document.documentElement).getPropertyValue("--zen-primary").trim() };
  });
  expect(layout.primary).toBe("#006b3c");
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.outside).toEqual([]);
  expect(layout.overlaps).toEqual([]);
  expect(layout.clipped).toEqual([]);
  if (viewport === "mobile") for (const control of layout.bounds) {
    expect(control.rect.width, control.name).toBeGreaterThanOrEqual(44);
    expect(control.rect.height, control.name).toBeGreaterThanOrEqual(44);
  }
  const directory = `../artifacts/lab-04/screenshots/${folder}/issue-60`;
  await mkdir(directory, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  const modal = await page.locator('[role="dialog"], dialog[open]').count() > 0;
  await page.screenshot({ path: `${directory}/${state}-${viewport}.png`, fullPage: !modal });
  await writeFile(`${directory}/${state}-${viewport}.json`, JSON.stringify({ evidence: "Deterministic UI fixture", state, viewport, axeViolations: axe.violations, layout }, null, 2) + "\n");
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // HTTP failure console messages are expected in injected safe-failure tests.
  page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(message.text()); });
  Object.assign(page, { uiErrors: errors });
});
test.afterEach(async ({ page }) => { expect((page as Page & { uiErrors: string[] }).uiErrors).toEqual([]); });

for (const viewport of viewports) {
  for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) {
    test(`${role} final screens, long text and keyboard at ${viewport.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await fixtures(page, role);
      const staff = role !== "REQUESTER", folder = staff ? "staff-dashboard" : "requester-dashboard";
      await page.goto(staff ? "/staff/dashboard?source=audit#overview" : "/dashboard");
      await expect(page.locator(".dashboard-metrics")).toBeVisible();
      await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
      await capture(page, folder, role.toLowerCase(), viewport.name);
      await page.getByRole("link", { name: "Dashboard", exact: true }).focus();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      const metric = page.locator(".dashboard-metric").first();
      await metric.focus();
      expect(await metric.evaluate(element => getComputedStyle(element).outlineStyle)).toBe("solid");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/status=OPEN_GROUP/);
      await expect(page.getByRole("link", { name: staff ? "Ticket Queue" : "My Tickets", exact: true })).toHaveAttribute("aria-current", "page");
      await capture(page, "workflow-screens", `${role.toLowerCase()}-queue`, viewport.name);
      await page.goto(staff ? "/staff/tickets/42#actions" : "/tickets/42");
      await expect(page.locator(".action-card")).toHaveCount(3);
      await expect(page.getByText("Historical follow-up", { exact: true })).toBeVisible();
      await capture(page, "actions-taken", `${role.toLowerCase()}-list`, viewport.name);
      if (staff) {
        await page.getByRole("button", { name: "Add Action", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(page.getByLabel("Create Action Description")).toBeFocused();
        await page.getByRole("button", { name: "Create Action", exact: true }).click();
        await expect(page.getByLabel("Create Action Description")).toBeFocused();
        await capture(page, "actions-taken", `${role.toLowerCase()}-validation`, viewport.name);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "Add Action" })).toBeFocused();
        const comment = page.getByRole("region", { name: "Public Comments", exact: true });
        await comment.getByRole("button", { name: "Post Public Comment" }).click();
        await expect(page.getByLabel("Public Comment", { exact: true })).toBeFocused();
        await expect(page.getByLabel("Public Comment", { exact: true })).toHaveAttribute("aria-invalid", "true");
        await capture(page, "workflow-screens", `${role.toLowerCase()}-communication-validation`, viewport.name);
      } else {
        await expect(page.getByRole("button", { name: /Add Action|Edit Action|Complete Action/ })).toHaveCount(0);
        const remove = page.getByRole("button", { name: /Remove diagnostic/ });
        await remove.focus(); await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: "Remove attachment?" });
        await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(dialog.getByLabel("Removal reason")).toBeFocused();
        await capture(page, "workflow-screens", "attachment-dialog", viewport.name);
        await page.keyboard.press("Escape"); await expect(remove).toBeFocused();
      }
      if (role === "ADMINISTRATOR") {
        await page.goto("/admin/users?source=audit");
        await expect(page.getByRole("link", { name: "User Management" })).toHaveAttribute("aria-current", "page");
        const trigger = page.getByRole("button", { name: "Create user", exact: true });
        await trigger.focus(); await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: "Create user" });
        await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
        await capture(page, "workflow-screens", "admin-dialog", viewport.name);
        await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
      }
    });
  }
}

test("safe failure and conflict retain Action and communication drafts; recovery prevents repeated writes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(viewports[2]);
  await fixtures(page, "IT_STAFF");
  await page.goto("/staff/tickets/42#actions");
  await expect(page.locator(".action-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel("Create Action Description").fill("Keep my diagnostic draft");
  await page.getByLabel("Create Action Assignee").selectOption("1");
  const bodies: Record<string, unknown>[] = [];
  let responseCode = "INTERNAL_ERROR";
  await page.route("**/api/staff/tickets/42/actions", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    bodies.push(route.request().postDataJSON());
    await json(route, { error: { code: responseCode, message: "private-stack-trace" } }, responseCode === "INTERNAL_ERROR" ? 500 : 409);
  });
  await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await expect(page.getByText(/Your entries have been kept/)).toBeVisible();
  await expect(page.getByLabel("Create Action Description")).toHaveValue("Keep my diagnostic draft");
  await expect(page.getByRole("button", { name: "Create Action", exact: true })).toBeDisabled();
  await expect(page.locator("body")).not.toContainText("private-stack-trace");
  await capture(page, "actions-taken", "safe-failure", "mobile");
  await page.getByRole("button", { name: "Reload Actions" }).click();
  await expect(page.getByRole("button", { name: "Create Action", exact: true })).toBeEnabled();
  responseCode = "STALE_TICKET";
  await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await expect(page.getByText(/This Ticket changed after you opened it/)).toBeVisible();
  expect(bodies[0].clientRequestId).toBe(bodies[1].clientRequestId);
  await capture(page, "actions-taken", "conflict", "mobile");
  await page.getByRole("button", { name: "Reload Actions" }).click();
  await expect(page.getByLabel("Create Action Description")).toHaveValue("Keep my diagnostic draft");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.route("**/api/staff/tickets/42/comments", async route => route.request().method() === "POST" ? json(route, { error: { code: "INTERNAL_ERROR", message: "private-stack-trace" } }, 500) : route.fallback());
  await page.getByLabel("Public Comment", { exact: true }).fill("Keep my public draft");
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText(/Unable to post. Your draft has been kept/)).toBeVisible();
  await expect(page.getByLabel("Public Comment", { exact: true })).toHaveValue("Keep my public draft");
  await capture(page, "workflow-screens", "communication-safe-failure", "mobile");
});
