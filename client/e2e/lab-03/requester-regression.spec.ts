import { expect, test } from "@playwright/test";
import {
  apiUrl, createTicketViaApi, fillCreateTicket, pdfFixture,
  requesterByEmail, selectRequester, ticketIdFromUrl, uploadAttachmentViaApi,
} from "../lab-02/live-support.js";

test("Issue #36 authenticated requester keeps the Lab 2 workflow and role boundaries", async ({ page, request }) => {
  const owner = await requesterByEmail(request, "jennifer.a@example.com");
  const other = await requesterByEmail(request, "michael.b@example.com");
  const foreign = await createTicketViaApi(request, other, { summary: "Private ticket belonging to another requester" });
  const foreignAttachment = await uploadAttachmentViaApi(request, other, foreign.id);
  await page.addInitScript(() => sessionStorage.setItem("toktickit.requesterId", "999999"));
  await selectRequester(page, owner);
  expect(await page.evaluate(() => sessionStorage.getItem("toktickit.requesterId"))).toBeNull();
  await expect(page.getByText(/Development Requester|Change Requester/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Ticket Queue|User Management/ })).toHaveCount(0);
  await fillCreateTicket(page, { summary: "Authenticated requester regression", description: "Preserve creation, attachments and collaboration after migration." });
  await page.getByRole("button", { name: "Create ticket", exact: true }).click();
  await expect(page.getByRole("heading", { name: /was created/ })).toBeVisible();
  await page.getByRole("button", { name: "View ticket", exact: true }).click();
  const id = ticketIdFromUrl(page);
  await page.getByLabel("Choose attachment").setInputFiles(pdfFixture);
  await page.getByRole("button", { name: "Upload attachment" }).click();
  await expect(page.getByRole("heading", { name: "Attachments (1/5)" })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: `Download ${pdfFixture.name}` }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(pdfFixture.name);
  await page.getByLabel("Public Comment", { exact: true }).fill("Service works again. <script>alert(1)</script>");
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  await expect(page.getByText("Public Comment posted.")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Problem Appears Resolved", exact: true }).click();
  await expect(page.getByText(/Reported at/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Service works again. <script>alert(1)</script>")).toBeVisible();
  await expect(page.getByText(/Reported at/)).toBeVisible();
  await expect(page.locator(".status-badge")).toHaveText("New");
  await expect(page.getByLabel("Internal Note", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await expect(page.getByText("Authenticated requester regression", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(foreign.summary, { exact: true })).toHaveCount(0);
  expect((await page.request.get(`${apiUrl}/api/tickets/${foreign.id}`)).status()).toBe(404);
  expect((await page.request.get(`${apiUrl}/api/tickets/${foreign.id}/attachments/${foreignAttachment.id}/download`)).status()).toBe(404);
  await page.goto(`/tickets/${foreign.id}`);
  await expect(page.getByText(foreign.summary, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveText(/Ticket not found\./);
  for (const path of ["/staff/tickets", `/staff/tickets/${id}`, "/admin/users"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Forbidden", exact: true })).toBeVisible();
    expect((await page.request.get(`${apiUrl}/api${path}`)).status()).toBe(403);
  }
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.goto(`/tickets/${id}`);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  expect((await page.request.get(`${apiUrl}/api/tickets/${id}`)).status()).toBe(401);
});
