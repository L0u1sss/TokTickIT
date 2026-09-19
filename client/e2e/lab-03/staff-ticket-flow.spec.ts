import { test, expect } from "@playwright/test";
import { screenEvidence } from "./evidence-support.js";

test("E2E-02 staff workflow persists ownership, priorities, statuses and separate communications", async ({ page }) => {
  if (!process.env.E2E_AUTH_PASSWORD) throw new Error("Run npm run test:staff:e2e for isolated fixtures.");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: false }).fill("queue-browser@example.test");
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "User Management", exact: true })).toHaveCount(0);
  await page.getByLabel("Search", { exact: true }).fill("TKT-2026-000002");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("status")).toContainText("1 tickets");
  await page.getByRole("link", { name: /View ticket/ }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail", exact: true })).toBeVisible();
  const ticketId = page.url().split("/").pop();
  const endpoint = `${process.env.E2E_API_URL}/api/staff/tickets/${ticketId}`;
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === "toktickit_csrf")!.value;
  const headers = { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrf };
  await expect(page.getByRole("button", { name: "Post Public Comment" })).toBeEnabled();
  for (const control of await page.locator(".staff-operation-controls select").all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download existing.pdf" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("existing.pdf");
  expect(await download.failure()).toBeNull();
  const attachment = (await (await page.request.get(endpoint)).json()).attachments[0];
  const bytes = await page.request.get(`${endpoint}/attachments/${attachment.id}/download`);
  expect((await bytes.body()).toString()).toBe("%PDF-1.4\nStaff attachment continuity\n%%EOF");
  await screenEvidence(page, "staff-ticket-detail");

  const claim = page.getByRole("button", { name: "Claim Ticket" });
  await claim.focus(); await page.keyboard.press("Enter");
  await expect(claim).toBeDisabled();
  await expect(page.getByLabel("Ticket Owner", { exact: true }).locator("option:checked")).toHaveText("Mali IT Staff");
  await page.getByLabel("Ticket Owner", { exact: true }).selectOption({ label: "Niran IT Staff" });
  await expect(page.getByLabel("Ticket Owner", { exact: true }).locator("option:checked")).toHaveText("Niran IT Staff");
  await page.getByLabel("IT Priority", { exact: true }).selectOption("LOW");
  await expect(page.getByLabel("IT Priority", { exact: true })).toHaveValue("LOW");
  await page.reload();
  await expect(page.getByLabel("IT Priority", { exact: true })).toHaveValue("LOW");
  expect((await (await page.request.get(endpoint)).json()).requestedPriority).toBe("HIGH");
  for (const status of ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER"]) {
    await page.getByLabel("Status", { exact: true }).selectOption(status);
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue(status);
  }
  const publicText = "Please confirm the printer now works.", privateText = "Private diagnostic: replaced the network cable.";
  await page.getByLabel("Public Comment", { exact: true }).fill(publicText);
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByRole("region", { name: "Public Comments" }).getByText(publicText)).toBeVisible();
  await page.getByLabel("Internal Note", { exact: true }).fill(privateText);
  await page.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(page.getByRole("region", { name: "Internal Notes" }).getByText(privateText)).toBeVisible();

  // A network failure is deliberately injected; all normal workflow uses the real API.
  await page.route("**/api/staff/tickets/*/it-priority", route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "private database detail" } }) }));
  await page.getByLabel("IT Priority", { exact: true }).selectOption("MEDIUM");
  await expect(page.getByRole("alert")).toContainText("Unable to save");
  await expect(page.getByText("private database detail")).toHaveCount(0);
  await expect(page.getByLabel("IT Priority", { exact: true })).toHaveValue("LOW");
  await page.unroute("**/api/staff/tickets/*/it-priority");

  page.once("dialog", dialog => dialog.dismiss());
  await page.getByLabel("Status", { exact: true }).selectOption("RESOLVED");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("WAITING_FOR_REQUESTER");
  for (const status of ["RESOLVED", "CLOSED", "REOPENED"]) {
    page.once("dialog", dialog => dialog.accept());
    await page.getByLabel("Status", { exact: true }).selectOption(status);
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue(status);
    if (status === "CLOSED") {
      await expect(claim).toBeDisabled();
      const detail = await (await page.request.get(endpoint)).json();
      expect(detail.owner).toBeNull(); expect(detail.lastOwner.displayName).toBe("Niran IT Staff");
      expect((await page.request.post(`${endpoint}/claim`, { headers, data: {} })).status()).toBe(409);
    }
  }
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByLabel("Email", { exact: false }).fill("auth-browser@example.test");
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();
  const requester = await page.request.get(`${process.env.E2E_API_URL}/api/tickets/${ticketId}`);
  expect(requester.status()).toBe(200); expect(JSON.stringify(await requester.json())).not.toContain(privateText);
  expect((await page.request.get(`${endpoint}/internal-notes`)).status()).toBe(403);
  await page.goto(`/staff/tickets/${ticketId}`);
  await expect(page.getByRole("heading", { name: "Forbidden", exact: true })).toBeVisible();
});
