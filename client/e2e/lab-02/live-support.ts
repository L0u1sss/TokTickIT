import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3100";
export const requesterStorageKey = "toktickit.requesterId";

export interface LiveRequester {
  id: number;
  displayName: string;
  email: string;
}

export interface LiveTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  status: "New";
  attachments: LiveAttachment[];
}

export interface LiveAttachment {
  id: number;
  fileName: string;
  isRemoved: boolean;
  removalReason: string | null;
  downloadable: boolean;
}

export const pdfFixture = {
  name: "lab-02-e2e-evidence.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n% TokTickIT Lab 2 E2E fixture\n%%EOF\n"),
};

export async function getActiveRequesters(
  request: APIRequestContext,
): Promise<LiveRequester[]> {
  const response = await request.get(`${apiUrl}/api/requesters`);
  expect(response.status()).toBe(200);
  return (await response.json()) as LiveRequester[];
}

export async function requesterByEmail(
  request: APIRequestContext,
  email: string,
): Promise<LiveRequester> {
  const requester = (await getActiveRequesters(request)).find((item) => item.email === email);
  expect(requester, `Expected seeded requester ${email}`).toBeDefined();
  return requester!;
}

export function requesterHeaders(requesterId: number) {
  return { "x-requester-id": String(requesterId) };
}

export async function selectRequester(
  page: Page,
  requester: LiveRequester,
): Promise<void> {
  await page.goto("/requester-selection");
  const selector = page.getByLabel("Development Requester", { exact: true });
  await expect(selector).toBeEnabled();
  await selector.selectOption(String(requester.id));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByText(requester.displayName, { exact: true }).first()).toBeVisible();
}

export async function fillCreateTicket(
  page: Page,
  input: {
    category?: string;
    relatedSystem?: string;
    summary: string;
    priority?: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  },
): Promise<void> {
  await expect(page.getByLabel("Category")).toBeEnabled();
  await page.getByLabel("Category").selectOption({ label: input.category ?? "Account and Access" });
  await page.getByLabel("Related System").selectOption({ label: input.relatedSystem ?? "VPN" });
  await page.getByLabel("Summary").fill(input.summary);
  await page.getByLabel("Requested Priority").selectOption(input.priority ?? "HIGH");
  await page.getByLabel("Description").fill(input.description);
}

export async function createTicketViaApi(
  request: APIRequestContext,
  requester: LiveRequester,
  overrides: Partial<{
    summary: string;
    description: string;
    requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  }> = {},
): Promise<LiveTicket> {
  const metadataResponse = await request.get(`${apiUrl}/api/metadata`);
  expect(metadataResponse.status()).toBe(200);
  const metadata = (await metadataResponse.json()) as {
    categories: Array<{ id: number }>;
    relatedSystems: Array<{ id: number }>;
  };
  const response = await request.post(`${apiUrl}/api/tickets`, {
    headers: requesterHeaders(requester.id),
    data: {
      clientRequestId: crypto.randomUUID(),
      categoryId: metadata.categories[0].id,
      relatedSystemId: metadata.relatedSystems[0].id,
      summary: overrides.summary ?? "Live E2E requester-owned ticket",
      requestedPriority: overrides.requestedPriority ?? "HIGH",
      description:
        overrides.description ?? "Created through the live API for a browser ownership scenario.",
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { ticket: LiveTicket }).ticket;
}

export async function uploadAttachmentViaApi(
  request: APIRequestContext,
  requester: LiveRequester,
  ticketId: number,
): Promise<LiveAttachment> {
  const response = await request.post(`${apiUrl}/api/tickets/${ticketId}/attachments`, {
    headers: requesterHeaders(requester.id),
    multipart: { file: pdfFixture },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as LiveAttachment;
}

export async function getTicketViaApi(
  request: APIRequestContext,
  requester: LiveRequester,
  ticketId: number,
): Promise<LiveTicket> {
  const response = await request.get(`${apiUrl}/api/tickets/${ticketId}`, {
    headers: requesterHeaders(requester.id),
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as LiveTicket;
}

export function ticketIdFromUrl(page: Page): number {
  const match = new URL(page.url()).pathname.match(/^\/tickets\/(\d+)$/);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

export async function expectNoInternalDetails(page: Page): Promise<void> {
  const body = page.locator("body");
  await expect(body).not.toContainText(/Prisma|SQLSTATE|node_modules|ATTACHMENT_STORAGE_DIR/i);
  await expect(body).not.toContainText(/postgresql:\/\//i);
}

export async function setSeededRequesterState(
  email: string,
  state: "active" | "inactive",
): Promise<void> {
  const serverDirectory = process.env.E2E_SERVER_DIRECTORY;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!serverDirectory || !testDatabaseUrl) {
    throw new Error("E2E_SERVER_DIRECTORY and TEST_DATABASE_URL are required.");
  }
  const tsxEntry = fileURLToPath(
    new URL("../../../server/node_modules/tsx/dist/cli.mjs", import.meta.url),
  );
  const fixtureEntry = fileURLToPath(
    new URL("../../../server/scripts/e2e-requester-state.ts", import.meta.url),
  );
  const child = spawn(process.execPath, [tsxEntry, fixtureEntry, email, state], {
    cwd: serverDirectory,
    env: { ...process.env, TEST_DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
    windowsHide: true,
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (code !== 0) throw new Error(`Requester fixture update failed with code ${code}.`);
}

export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 40; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Keyboard focus did not reach the expected control.");
}
