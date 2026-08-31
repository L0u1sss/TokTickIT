import { expect, type Locator, type Page, type Route, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const evidenceDirectory = fileURLToPath(
  new URL("../../../docs/lab-02/evidence/", import.meta.url),
);

const requesters = [
  { id: 1, displayName: "Alex Morgan", email: "alex.morgan@example.test" },
  { id: 2, displayName: "Narin Development Requester", email: "narin@example.test" },
];

const metadata = {
  categories: [
    { id: 1, name: "Hardware" },
    { id: 2, name: "Software" },
  ],
  relatedSystems: [
    { id: 1, name: "Employee Portal" },
    { id: 2, name: "Finance Platform" },
  ],
};

const createdAt = "2026-08-30T06:30:00.000Z";
const updatedAt = "2026-08-30T07:15:00.000Z";

const activeAttachment = {
  id: 71,
  fileName: "quarterly-access-review-with-a-long-descriptive-file-name.pdf",
  mediaType: "application/pdf",
  sizeBytes: 245_760,
  uploadedAt: createdAt,
  isRemoved: false,
  removedAt: null,
  removalReason: null,
  downloadable: true,
};

const removedAttachment = {
  id: 72,
  fileName: "superseded-network-diagram.png",
  mediaType: "image/png",
  sizeBytes: 81_920,
  uploadedAt: createdAt,
  isRemoved: true,
  removedAt: updatedAt,
  removalReason: "Replaced with the approved architecture diagram.",
  downloadable: false,
};

const ticketDetail = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "VPN access fails after the security policy update",
  description:
    "The requester can sign in to the employee portal, but the VPN client stops during policy validation. This deterministic description verifies that long content wraps without clipping or horizontal page overflow.",
  requestedPriority: "HIGH",
  status: "New",
  requester: requesters[0],
  category: metadata.categories[1],
  relatedSystem: metadata.relatedSystems[0],
  activeAttachmentCount: 1,
  attachments: [activeAttachment, removedAttachment],
  createdAt,
  updatedAt,
};

function ticketSummary(index: number) {
  const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
  return {
    id: index === 1 ? 42 : 42 + index,
    ticketNumber: `TKT-2026-${String(41 + index).padStart(6, "0")}`,
    summary:
      index === 1
        ? ticketDetail.summary
        : `Deterministic requester ticket ${index} with wrapping summary text`,
    requestedPriority: priorities[(index - 1) % priorities.length],
    status: "New",
    category: metadata.categories[(index - 1) % metadata.categories.length],
    relatedSystem: metadata.relatedSystems[(index - 1) % metadata.relatedSystems.length],
    activeAttachmentCount: index === 1 ? 1 : 0,
    createdAt: new Date(Date.parse(createdAt) - index * 60_000).toISOString(),
    updatedAt,
  };
}

const firstTicketPage = Array.from({ length: 10 }, (_, index) => ticketSummary(index + 1));

interface MockState {
  requesterStatus: number;
  requesterDelay: number;
  requesterBody: typeof requesters;
  metadataStatus: number;
  metadataBody: typeof metadata;
  ticketsStatus: number;
  ticketsBody: ReturnType<typeof ticketListBody>;
  detailStatus: number;
  detailDelay: number;
  createDelay: number;
}

function ticketListBody(items = firstTicketPage, totalItems = 12) {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 10,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / 10),
    },
    sort: { by: "createdAt", order: "desc" },
    filters: {
      search: null,
      status: null,
      requestedPriority: null,
      categoryId: null,
      relatedSystemId: null,
    },
  };
}

function defaultMockState(): MockState {
  return {
    requesterStatus: 200,
    requesterDelay: 0,
    requesterBody: requesters,
    metadataStatus: 200,
    metadataBody: metadata,
    ticketsStatus: 200,
    ticketsBody: ticketListBody(),
    detailStatus: 200,
    detailDelay: 0,
    createDelay: 0,
  };
}

const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:4173",
  "access-control-allow-headers": "content-type,x-requester-id",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
};

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

async function installApiMocks(page: Page, state: MockState) {
  await page.route("http://localhost:3000/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.pathname === "/api/requesters") {
      if (state.requesterDelay) {
        await new Promise((resolve) => setTimeout(resolve, state.requesterDelay));
      }
      await json(
        route,
        state.requesterStatus,
        state.requesterStatus === 200
          ? state.requesterBody
          : errorBody("INTERNAL_ERROR", "Unable to load requesters"),
      );
      return;
    }

    if (url.pathname === "/api/metadata") {
      await json(
        route,
        state.metadataStatus,
        state.metadataStatus === 200
          ? state.metadataBody
          : errorBody("INTERNAL_ERROR", "Unable to load metadata"),
      );
      return;
    }

    if (url.pathname === "/api/tickets" && request.method() === "GET") {
      await json(
        route,
        state.ticketsStatus,
        state.ticketsStatus === 200
          ? state.ticketsBody
          : errorBody("INTERNAL_ERROR", "Unable to load tickets"),
      );
      return;
    }

    if (url.pathname === "/api/tickets" && request.method() === "POST") {
      if (state.createDelay) await page.waitForTimeout(state.createDelay);
      await json(route, 201, { ticket: ticketDetail, replayed: false });
      return;
    }

    if (url.pathname === "/api/tickets/42" && request.method() === "GET") {
      if (state.detailDelay) await page.waitForTimeout(state.detailDelay);
      await json(
        route,
        state.detailStatus,
        state.detailStatus === 200
          ? ticketDetail
          : errorBody("INTERNAL_ERROR", "Unable to load ticket"),
      );
      return;
    }

    if (url.pathname.endsWith("/remove") && request.method() === "PATCH") {
      await json(route, 200, {
        ...activeAttachment,
        isRemoved: true,
        removedAt: updatedAt,
        removalReason: "Removed during responsive verification.",
        downloadable: false,
      });
      return;
    }

    if (url.pathname.includes("/attachments") && request.method() === "POST") {
      await json(route, 201, { ...activeAttachment, id: 73, fileName: "new-evidence.pdf" });
      return;
    }

    await json(route, 404, errorBody("NOT_FOUND", "Resource not found"));
  });
}

async function startWithRequester(page: Page, path: string) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("toktickit.requesterId", "1");
  });
  await page.goto(path);
}

async function assertNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function assertInsideViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function assertMobileTouchTargets(page: Page) {
  const undersized = await page
    .locator(
      'main button:not(:disabled), main a[href], main select:not(:disabled), main input:not(:disabled), main textarea:not(:disabled), header button:not(:disabled), header a[href], main summary',
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return [];
        }
        if (rect.width >= 43.5 && rect.height >= 43.5) return [];
        return [
          `${element.tagName.toLowerCase()}[${element.getAttribute("aria-label") ?? element.textContent?.trim() ?? ""}] ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        ];
      }),
    );
  expect(undersized).toEqual([]);
}

async function assertZenGreenTokens(page: Page) {
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        "--zen-primary",
        "--zen-secondary",
        "--zen-pale",
        "--zen-page",
        "--zen-text",
        "--zen-error",
        "--color-warning",
        "--color-warning-bg",
      ].map((name) => [name, style.getPropertyValue(name).trim().toLowerCase()]),
    );
  });
  expect(tokens).toEqual({
    "--zen-primary": "#006b3c",
    "--zen-secondary": "#0b7a46",
    "--zen-pale": "#eaf6ef",
    "--zen-page": "#f5f7f6",
    "--zen-text": "#1a2e22",
    "--zen-error": "#d32f2f",
    "--color-warning": "#8a5500",
    "--color-warning-bg": "#fff4d6",
  });
}

async function capture(page: Page, screen: string, viewport: string) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  await page.screenshot({
    path: `${evidenceDirectory}${screen}-${viewport}.png`,
    animations: "disabled",
    caret: "hide",
    fullPage: false,
  });
}

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`RV-01–RV-04 baseline at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    const state = defaultMockState();
    await installApiMocks(page, state);
    await page.setViewportSize(viewport);

    await page.goto("/requester-selection");
    await expect(page.getByRole("heading", { name: "Select a Development Requester" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("not secure authentication");
    await assertZenGreenTokens(page);
    await assertNoPageOverflow(page);
    await page.getByLabel("Development Requester", { exact: true }).selectOption("1");
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await expect(page.getByText("alex.morgan@example.test", { exact: true })).toBeVisible();
    await assertInsideViewport(page, page.locator(".requester-card"));
    if (viewport.name === "mobile") await assertMobileTouchTargets(page);
    await capture(page, "requester-selection", viewport.name);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Ticket" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    const focusStyle = await skipLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.outlineWidth, color: style.outlineColor };
    });
    expect(focusStyle).toEqual({ width: "3px", color: "rgb(0, 107, 60)" });
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
    await expect(page.getByLabel("Category")).toBeEnabled();
    await expect(page.getByLabel("Related System")).toBeEnabled();
    await expect(page.getByLabel("Requested Priority")).toBeVisible();
    await expect(page.getByText("* Required", { exact: true })).toBeVisible();
    const createColumns = await page
      .locator(".create-ticket-grid")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(createColumns).toBe(viewport.name === "mobile" ? 1 : 2);
    await assertNoPageOverflow(page);
    if (viewport.name === "mobile") await assertMobileTouchTargets(page);
    await capture(page, "create-ticket", viewport.name);

    await page.getByRole("link", { name: "My Tickets" }).click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByText("Showing 1–10 of 12 tickets")).toBeVisible();
    await expect(page.getByRole("link", { name: "My Tickets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (viewport.name === "mobile") {
      await expect(page.locator(".ticket-card-list")).toBeVisible();
      await expect(page.locator(".ticket-table-region")).toHaveCount(0);
      await expect(
        page.locator(".ticket-card-list").getByText("High", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.locator(".ticket-card-list").getByText("New", { exact: true }).first(),
      ).toBeVisible();
      await assertMobileTouchTargets(page);
    } else {
      await expect(page.locator(".priority-badge", { hasText: "High" }).first()).toBeVisible();
      await expect(page.locator(".status-badge").first()).toHaveText("New");
      const tableRegion = page.getByRole("region", { name: /Ticket results/ });
      await expect(tableRegion).toBeVisible();
      const tableWidths = await tableRegion.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }));
      if (viewport.name === "tablet") expect(tableWidths.scroll).toBeGreaterThan(tableWidths.client);
      else expect(tableWidths.scroll).toBeLessThanOrEqual(tableWidths.client + 1);
    }
    await assertNoPageOverflow(page);
    await capture(page, "my-tickets", viewport.name);

    await page.getByRole("link", { name: "View details for TKT-2026-000042" }).click();
    await expect(page.getByRole("heading", { name: "TKT-2026-000042" })).toBeVisible();
    await expect(page.getByText("High", { exact: true })).toBeVisible();
    await expect(page.getByText("New", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(activeAttachment.fileName, { exact: true })).toBeVisible();
    await page.getByText("Removed attachments (1)").click();
    await expect(page.getByText("Removed — unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Download ${removedAttachment.fileName}` })).toHaveCount(0);
    const detailColumns = await page
      .locator(".ticket-detail-layout")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(detailColumns).toBe(viewport.name === "desktop" ? 2 : 1);
    await assertNoPageOverflow(page);
    if (viewport.name === "mobile") await assertMobileTouchTargets(page);
    await capture(page, "ticket-detail", viewport.name);
  });
}

test("loading, empty, error, busy, warning, and focus recovery states are explicit", async ({ page }) => {
  const state = defaultMockState();
  state.requesterDelay = 400;
  await installApiMocks(page, state);
  await page.setViewportSize(viewports[2]);

  await page.goto("/requester-selection");
  await expect(page.getByRole("status")).toContainText("Loading requesters");
  await expect(page.getByLabel("Development Requester", { exact: true })).toBeEnabled();

  state.requesterBody = [];
  await page.reload();
  await expect(page.getByText("No active requesters are available.")).toBeVisible();
  await expect(page.getByLabel("Development Requester", { exact: true })).toHaveCount(0);

  state.requesterBody = requesters;
  state.requesterStatus = 500;
  await page.reload();
  const requesterRetry = page.getByRole("button", { name: "Retry" });
  await expect(requesterRetry).toBeVisible();
  await expect(requesterRetry).toBeFocused();
  state.requesterStatus = 200;
  state.requesterDelay = 0;
  await requesterRetry.click();
  await expect(page.getByLabel("Development Requester", { exact: true })).toBeEnabled();

  await page.getByLabel("Development Requester", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Continue" }).click();
  state.metadataBody = { categories: [], relatedSystems: [] };
  await page.reload();
  await expect(page.getByText("No active categories are available.")).toBeVisible();
  await expect(page.getByText("No active related systems are available.")).toBeVisible();
  const warningColors = await page.locator(".form-state-warning").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(warningColors).toEqual({ color: "rgb(138, 85, 0)", background: "rgb(255, 244, 214)" });

  state.metadataBody = metadata;
  await page.reload();
  await page.getByLabel("Category").selectOption("1");
  await page.getByLabel("Related System").selectOption("1");
  await page.getByLabel("Summary").fill("VPN access failure");
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Description").fill("VPN access fails after the approved policy update.");
  state.createDelay = 600;
  await page.getByRole("button", { name: "Create ticket" }).click();
  const creating = page.getByRole("button", { name: /Creating ticket/ });
  await expect(creating).toBeDisabled();
  await expect(page.locator(".create-ticket-form")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText(/Ticket TKT-2026-000042 was created/)).toBeVisible();

  state.ticketsStatus = 500;
  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByText("We couldn't load your tickets.")).toBeVisible();
  state.ticketsStatus = 200;
  state.ticketsBody = ticketListBody([], 0);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "No tickets yet" })).toBeVisible();

  await page.goto("/tickets?search=no-match");
  await expect(
    page.getByRole("heading", { name: "No tickets match your search or filters" }),
  ).toBeVisible();

  state.metadataStatus = 500;
  await page.reload();
  const metadataWarning = page.getByRole("alert", { name: "Filter options unavailable" });
  await expect(metadataWarning).toContainText("We couldn't load filter options.");
  await expect(metadataWarning.getByRole("button", { name: "Retry" })).toBeVisible();

  state.detailStatus = 500;
  state.detailDelay = 300;
  await page.goto("/tickets/42");
  await expect(page.getByRole("status")).toContainText("Loading ticket");
  const detailRetry = page.getByRole("button", { name: "Retry" });
  await expect(detailRetry).toBeVisible();
  await expect(page.locator("main#main-content")).toBeFocused();
  state.detailStatus = 200;
  state.detailDelay = 0;
  await detailRetry.click();
  await expect(page.getByRole("heading", { name: "TKT-2026-000042" })).toBeVisible();
});

test("removal dialog keyboard flow traps, dismisses, and restores focus", async ({ page }) => {
  const state = defaultMockState();
  await installApiMocks(page, state);
  await page.setViewportSize(viewports[2]);
  await startWithRequester(page, "/tickets/42");
  await expect(page.getByRole("heading", { name: "TKT-2026-000042" })).toBeVisible();

  const removeTrigger = page.getByRole("button", { name: `Remove ${activeAttachment.fileName}` });
  await removeTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Remove attachment?" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByLabel("Removal reason")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(removeTrigger).toBeFocused();
});
