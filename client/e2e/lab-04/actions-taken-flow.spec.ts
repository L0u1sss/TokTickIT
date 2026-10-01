import { mkdir } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const api = process.env.E2E_API_URL;
const password = process.env.E2E_AUTH_PASSWORD;
const tickets: Record<string, number> = JSON.parse(process.env.E2E_ACTION_TICKETS ?? "{}");
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const actions = (page: Page) => page.getByRole("region", { name: "Actions Taken", exact: true });

async function login(page: Page, email = "queue-browser@example.test") {
  if (!password || !api || !Object.keys(tickets).length) throw new Error("Run npm run test:actions:e2e for the isolated real-API fixtures.");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: false }).fill(email);
  await page.getByLabel("Password", { exact: false }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
}

async function openTicket(page: Page, name: string, requester = false) {
  await page.goto(`${requester ? "" : "/staff"}/tickets/${tickets[name]}#actions`);
  await expect(page.getByRole("heading", { level: 1, name: requester ? /^TKT-2026-/ : "Ticket Detail" })).toBeVisible();
  await expect(actions(page).getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
  await expect(actions(page).getByText(/Loading Actions/)).toHaveCount(0);
}

async function writeHeaders(page: Page) {
  const token = (await page.context().cookies()).find(cookie => cookie.name === "toktickit_csrf")?.value;
  return { Origin: new URL(page.url()).origin, ...(token ? { "X-CSRF-Token": token } : {}) };
}

async function evidence(page: Page, screen: string, viewport: string) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const focused = await page.evaluateHandle(() => document.activeElement);
  const findings = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  // Axe probes focusability. Preserve the user's focus in the captured evidence.
  await focused.evaluate(element => { if (element instanceof HTMLElement && element.isConnected) element.focus({ preventScroll: true }); });
  await focused.dispose();
  const serious = findings.violations.filter(violation => violation.impact === "serious" || violation.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  if (viewport === "mobile") {
    for (const control of await actions(page).locator("button, select, textarea").all()) {
      if (!await control.isVisible()) continue;
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
  }
  const directory = `../artifacts/lab-04/screenshots/actions-taken/${screen}`;
  await mkdir(directory, { recursive: true });
  // Fixed elements translated outside the viewport can appear inside Chromium's
  // full-page capture when it starts at a non-zero scroll offset.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/${viewport}.png`, fullPage: true });
}

async function fillCreate(page: Page, description: string, assigneeLabel = "Mali IT Staff") {
  await actions(page).getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel("Create Action Description").fill(description);
  const assignee = page.getByLabel("Create Action Assignee");
  const option = assignee.getByRole("option", { name: new RegExp(assigneeLabel) });
  await expect(option).toHaveCount(1);
  await assignee.selectOption(await option.getAttribute("value") as string);
}

for (const viewport of viewports) {
  test(`Actions Taken real-API lifecycle, validation and read-only requester at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page);
    await openTicket(page, viewport.name);
    await expect(actions(page).getByText(/No Actions have been recorded/)).toBeVisible();

    // Open and submit using the keyboard; the error must take focus to the input.
    await actions(page).getByRole("button", { name: "Add Action" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Create Action Description")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(actions(page).getByRole("button", { name: "Add Action" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Create Action", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Create Action Description")).toBeFocused();
    await expect(page.getByLabel("Create Action Description")).toHaveAttribute("aria-invalid", "true");
    await evidence(page, "validation", viewport.name);

    const description = `Replace printer cable (${viewport.name}). ${"A diagnostic detail that wraps on narrow screens. ".repeat(4)}`;
    await page.getByLabel("Create Action Description").fill(description);
    const ownOption = page.getByLabel("Create Action Assignee").getByRole("option", { name: /Mali IT Staff/ });
    await page.getByLabel("Create Action Assignee").selectOption(await ownOption.getAttribute("value") as string);
    await page.getByRole("checkbox", { name: /Follow-up required/ }).check();
    await page.getByLabel("Create Action Follow-up Note").fill("Verify stability next shift.");
    await page.getByLabel("Create Action Attachment Notes").fill(`Network report ${"verylongattachmentreference".repeat(8)}.pdf`);
    await evidence(page, "create-form", viewport.name);
    await page.getByRole("button", { name: "Create Action", exact: true }).click();
    await expect(actions(page).getByText(description.trim(), { exact: true })).toBeVisible();
    await expect(actions(page).getByRole("button", { name: "Add Action" })).toBeFocused();
    await expect(actions(page).getByText("Not completed", { exact: true })).toBeVisible();
    await evidence(page, "planned-list", viewport.name);

    await actions(page).getByRole("button", { name: "Edit Action" }).click();
    await page.getByLabel("Edit Action Result").fill("Cable replaced; printer connectivity stable.");
    await page.getByRole("checkbox", { name: /Follow-up required/ }).uncheck();
    await evidence(page, "edit-form", viewport.name);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(actions(page).getByText("Cable replaced; printer connectivity stable.", { exact: true })).toBeVisible();
    await actions(page).getByRole("button", { name: "Start Action" }).click();
    await expect(actions(page).getByText("In progress", { exact: true })).toBeVisible();
    await actions(page).getByRole("button", { name: "Complete Action" }).focus();
    await page.keyboard.press("Enter");
    await expect(actions(page).getByText("Completed", { exact: true })).toBeVisible();
    await expect(actions(page).getByRole("button", { name: /Edit Action|Reopen Action|Restore Action/ })).toHaveCount(0);

    await fillCreate(page, `Retired follow-up inspection (${viewport.name})`);
    await page.getByRole("button", { name: "Create Action", exact: true }).click();
    await expect(actions(page).getByText(`Retired follow-up inspection (${viewport.name})`, { exact: true })).toBeVisible();
    page.once("dialog", dialog => dialog.accept());
    await actions(page).getByRole("button", { name: "Cancel Action" }).click();
    await expect(actions(page).getByText("Cancelled", { exact: true })).toBeVisible();
    await evidence(page, "terminal-list", viewport.name);
    await page.reload();
    await expect(actions(page).getByText("Completed", { exact: true })).toBeVisible();
    await expect(actions(page).getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(actions(page).getByRole("button", { name: /Edit Action|Complete Action|Restore Action|Reopen Action/ })).toHaveCount(0);

    const ticketResponse = await page.request.get(`${api}/api/staff/tickets/${tickets[viewport.name]}`);
    const listResponse = await page.request.get(`${api}/api/staff/tickets/${tickets[viewport.name]}/actions`);
    expect(ticketResponse.ok()).toBe(true); expect(listResponse.ok()).toBe(true);
    const ticket = await ticketResponse.json(), list = await listResponse.json();
    expect(ticket.version).toBe(7);
    expect(list.items.map((action: { status: string }) => action.status)).toEqual(["COMPLETED", "CANCELLED"]);
    expect(list.items[0]).toMatchObject({ result: "Cable replaced; printer connectivity stable.", revision: 4, followUpRequired: false });
    expect(list.items[0].performedBy.id).toBe(list.items[0].assignee.id);
    expect(list.items[1]).toMatchObject({ revision: 2, cancellationSource: "STAFF_ACTION", followUpRequired: false });

    page.once("dialog", dialog => dialog.accept());
    await page.getByLabel("Status", { exact: true }).selectOption("RESOLVED");
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue("RESOLVED");
    await expect(actions(page).getByRole("button", { name: "Add Action" })).toHaveCount(0);
    await evidence(page, "resolved-parent", viewport.name);

    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await login(page, "auth-browser@example.test");
    await openTicket(page, viewport.name, true);
    await expect(actions(page).getByText(description.trim(), { exact: true })).toBeVisible();
    await expect(actions(page).getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Internal Notes", exact: true })).toHaveCount(0);
    await evidence(page, "requester-read-only", viewport.name);
  });
}

test("staff/admin completion identity, Ticket cascade history and requester ownership use the real API", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openTicket(page, "roles");
  await fillCreate(page, "Work assigned to an administrator", "Mali Administrator");
  await page.getByLabel("Create Action Result").fill("Administrator verified recovery.");
  await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await expect(actions(page).getByText("Work assigned to an administrator", { exact: true })).toBeVisible();
  await actions(page).getByRole("button", { name: "Start Action" }).click();
  await expect(actions(page).getByText("Only the assigned staff member can complete this Action.")).toBeVisible();
  const complete = actions(page).getByRole("button", { name: "Complete Action" });
  if (await complete.count()) await expect(complete).toBeDisabled();
  const list = await (await page.request.get(`${api}/api/staff/tickets/${tickets.roles}/actions`)).json();
  const parent = await (await page.request.get(`${api}/api/staff/tickets/${tickets.roles}`)).json();
  const deniedCompletion = await page.request.patch(`${api}/api/staff/tickets/${tickets.roles}/actions/${list.items[0].id}/status`, {
    headers: await writeHeaders(page), data: { status: "COMPLETED", expectedTicketVersion: parent.version, revision: list.items[0].revision, result: "Wrong actor" },
  });
  expect(deniedCompletion.status()).toBe(403);
  expect((await deniedCompletion.json()).error.code).toBe("ACTION_ASSIGNEE_REQUIRED");

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await login(page, "admin-browser@example.test");
  await openTicket(page, "roles");
  await actions(page).getByRole("button", { name: "Complete Action" }).click();
  await expect(actions(page).getByText("Completed", { exact: true })).toBeVisible();
  const performed = await (await page.request.get(`${api}/api/staff/tickets/${tickets.roles}/actions`)).json();
  expect(performed.items[0].performedBy.displayName).toBe("Mali Administrator");
  expect(performed.items[0].recordedBy.displayName).toBe("Mali IT Staff");

  await fillCreate(page, "Ticket cancellation preserves historical follow-up", "Mali Administrator");
  await page.getByRole("checkbox", { name: /Follow-up required/ }).check();
  await page.getByLabel("Create Action Follow-up Note").fill("Historical verification note.");
  await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await expect(actions(page).getByText("Ticket cancellation preserves historical follow-up", { exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("Status", { exact: true }).selectOption("CANCELLED");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("CANCELLED");
  await expect(actions(page).getByText("Historical follow-up", { exact: true })).toBeVisible();
  await expect(actions(page).getByText(/Yes.*Historical verification note/)).toBeVisible();
  await expect(actions(page).getByText("Ticket cancellation", { exact: true })).toBeVisible();
  await expect(actions(page).getByRole("button", { name: /Add Action|Edit Action|Restore Action/ })).toHaveCount(0);
  const cascaded = await (await page.request.get(`${api}/api/staff/tickets/${tickets.roles}/actions`)).json();
  expect(cascaded.items[1]).toMatchObject({ status: "CANCELLED", cancellationSource: "TICKET_CASCADE", followUpRequired: true, cancelledBy: { displayName: "Mali Administrator" } });
  expect(cascaded.items[1].cancelledAt).toBeTruthy();
  await evidence(page, "cascade-history", "desktop");

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await login(page, "auth-browser@example.test");
  await openTicket(page, "roles", true);
  await expect(actions(page).getByRole("button")).toHaveCount(0);
  const requesterWrite = await page.request.post(`${api}/api/staff/tickets/${tickets.roles}/actions`, { headers: await writeHeaders(page), data: {} });
  expect(requesterWrite.status()).toBe(403);
  const requesterEvents = await page.request.get(`${api}/api/staff/tickets/${tickets.roles}/actions/${list.items[0].id}/events`);
  expect(requesterEvents.status()).toBe(403);

  const otherContext = await browser.newContext({ baseURL: process.env.E2E_CLIENT_URL });
  try {
    const otherPage = await otherContext.newPage();
    await login(otherPage, "other-requester@example.test");
    const forbiddenOwnedTicket = await otherPage.request.get(`${api}/api/tickets/${tickets.roles}/actions`);
    expect(forbiddenOwnedTicket.status()).toBe(404);
    expect(await forbiddenOwnedTicket.json()).not.toHaveProperty("items");
  } finally { await otherContext.close(); }
});

test("a real concurrent edit preserves a local draft and reload rebases both versions", async ({ page }) => {
  await login(page);
  await openTicket(page, "stale");
  await fillCreate(page, "Initial inspection");
  await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await expect(actions(page).getByText("Initial inspection", { exact: true })).toBeVisible();
  await actions(page).getByRole("button", { name: "Edit Action" }).click();
  await page.getByLabel("Edit Action Description").fill("Retained local inspection draft");
  const parent = await (await page.request.get(`${api}/api/staff/tickets/${tickets.stale}`)).json();
  const list = await (await page.request.get(`${api}/api/staff/tickets/${tickets.stale}/actions`)).json();
  const concurrent = await page.request.patch(`${api}/api/staff/tickets/${tickets.stale}/actions/${list.items[0].id}`, {
    headers: await writeHeaders(page), data: { description: "Concurrent server inspection", expectedTicketVersion: parent.version, revision: list.items[0].revision },
  });
  expect(concurrent.ok()).toBe(true);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(actions(page).getByRole("alert")).toContainText(/Reload/);
  await expect(page.getByLabel("Edit Action Description")).toHaveValue("Retained local inspection draft");
  await evidence(page, "stale-draft", "desktop");
  await actions(page).getByRole("button", { name: "Reload Actions" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  await expect(page.getByLabel("Edit Action Description")).toHaveValue("Retained local inspection draft");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(actions(page).getByText("Retained local inspection draft", { exact: true })).toBeVisible();
  const updated = await (await page.request.get(`${api}/api/staff/tickets/${tickets.stale}/actions`)).json();
  expect(updated.items[0]).toMatchObject({ description: "Retained local inspection draft", revision: 3 });
  expect((await (await page.request.get(`${api}/api/staff/tickets/${tickets.stale}`)).json()).version).toBe(4);
});

test("a lost create response keeps request identity and recovers through a real idempotent replay", async ({ page }) => {
  await login(page);
  await openTicket(page, "retry");
  const requests: Record<string, unknown>[] = [];
  await page.route(`**/api/staff/tickets/${tickets.retry}/actions`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      // The real server commits the create, then the browser loses its response.
      const accepted = await route.fetch();
      expect(accepted.status()).toBe(201);
      return route.abort("failed");
    }
    await route.continue();
  });
  await fillCreate(page, "Draft retained after a temporary service failure");
  await page.getByRole("button", { name: "Create Action", exact: true }).click();
  await expect(actions(page).getByRole("alert")).toContainText(/kept|try again/i);
  await expect(page.getByLabel("Create Action Description")).toHaveValue("Draft retained after a temporary service failure");
  await evidence(page, "safe-save-error", "desktop");
  await expect(page.getByRole("button", { name: "Create Action", exact: true })).toBeDisabled();
  await actions(page).getByRole("button", { name: "Reload Actions" }).click();
  await expect(page.getByRole("button", { name: "Create Action", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Create Action Description")).toHaveValue("Draft retained after a temporary service failure");
  await page.getByRole("button", { name: "Create Action", exact: true }).dblclick();
  await expect(page.getByLabel("Create Action Description")).toHaveCount(0);
  await expect(actions(page).getByText("Draft retained after a temporary service failure", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0].clientRequestId).toBe(requests[1].clientRequestId);
  const stored = await (await page.request.get(`${api}/api/staff/tickets/${tickets.retry}/actions`)).json();
  expect(stored.items).toHaveLength(1);
});

test("a cached assignee deactivated by a real administrator is rejected and recoverable without losing the draft", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openTicket(page, "inactive");
  await fillCreate(page, "Keep the diagnostic plan after an assignee becomes inactive", "Retiring IT Staff");
  const retiringId = Number(await page.getByLabel("Create Action Assignee").inputValue());
  const adminContext = await browser.newContext({ baseURL: process.env.E2E_CLIENT_URL });
  try {
    const adminPage = await adminContext.newPage();
    await login(adminPage, "admin-browser@example.test");
    const deactivated = await adminPage.request.patch(`${api}/api/admin/users/${retiringId}`, {
      headers: await writeHeaders(adminPage), data: { isActive: false },
    });
    expect(deactivated.ok()).toBe(true);
    expect((await deactivated.json()).isActive).toBe(false);

    const rejected = page.waitForResponse(response => response.url().endsWith(`/api/staff/tickets/${tickets.inactive}/actions`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Create Action", exact: true }).click();
    const rejection = await rejected;
    expect(rejection.status()).toBe(409);
    expect((await rejection.json()).error.code).toBe("INVALID_ACTION_ASSIGNEE");
    await expect(actions(page).getByRole("alert")).toContainText(/assignee.*active|eligible/i);
    await expect(page.getByLabel("Create Action Description")).toHaveValue("Keep the diagnostic plan after an assignee becomes inactive");
    await evidence(page, "inactive-assignee", "desktop");
    await actions(page).getByRole("button", { name: "Reload assignees" }).click();
    await expect(page.getByLabel("Create Action Assignee").getByRole("option", { name: /Retiring IT Staff/ })).toHaveCount(0);
    const activeOption = page.getByLabel("Create Action Assignee").getByRole("option", { name: /Mali IT Staff/ });
    await page.getByLabel("Create Action Assignee").selectOption(await activeOption.getAttribute("value") as string);
    await page.getByRole("button", { name: "Create Action", exact: true }).click();
    await expect(page.getByLabel("Create Action Description")).toHaveCount(0);
    await expect(actions(page).getByText("Keep the diagnostic plan after an assignee becomes inactive", { exact: true })).toBeVisible();
    const stored = await (await page.request.get(`${api}/api/staff/tickets/${tickets.inactive}/actions`)).json();
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].assignee.id).not.toBe(retiringId);
    expect((await (await page.request.get(`${api}/api/staff/tickets/${tickets.inactive}`)).json()).version).toBe(2);
  } finally { await adminContext.close(); }
});
