import { expect, test } from "@playwright/test";
import {
  apiUrl,
  fillCreateTicket,
  getTicketViaApi,
  pdfFixture,
  requesterByEmail,
  requesterHeaders,
  selectRequester,
  ticketIdFromUrl,
} from "./live-support.js";

test("E2E-01 requester ticket and attachment lifecycle uses the live stack", async ({
  page,
  request,
}) => {
  const requester = await requesterByEmail(request, "jennifer.a@example.com");
  const summary = "VPN access blocked during final Lab 2 verification";
  const description =
    "The seeded requester needs VPN access restored before the final Lab 2 release review.";

  await selectRequester(page, requester);
  await fillCreateTicket(page, {
    summary,
    description,
    priority: "HIGH",
  });
  await page.getByRole("button", { name: "Create ticket" }).click();

  const successHeading = page.getByRole("heading", {
    name: /Ticket TKT-\d{4}-\d{6} was created\./,
  });
  await expect(successHeading).toBeVisible();
  const ticketNumber = (await successHeading.textContent())!.match(/TKT-\d{4}-\d{6}/)![0];
  await expect(page.getByText("New", { exact: true })).toBeVisible();
  await expect(page.getByText("High", { exact: true })).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}T/);

  await page.getByRole("button", { name: "View ticket" }).click();
  await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();
  const ticketId = ticketIdFromUrl(page);
  await expect(page.getByRole("heading", { name: summary })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Ticket metadata").getByText(requester.displayName, { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await page.getByLabel("Search tickets").fill(summary);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await expect(page.getByRole("link", { name: ticketNumber, exact: true })).toBeVisible();
  await page.getByRole("link", { name: `View details for ${ticketNumber}` }).click();
  await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();

  await page.getByLabel("Choose attachment").setInputFiles(pdfFixture);
  await page.getByRole("button", { name: "Upload attachment" }).click();
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} uploaded`);
  await expect(page.getByRole("heading", { name: "Attachments (1/5)" })).toBeVisible();

  const detailAfterUpload = await getTicketViaApi(request, requester, ticketId);
  const attachment = detailAfterUpload.attachments.find(
    (item) => item.fileName === pdfFixture.name && !item.isRemoved,
  );
  expect(attachment).toBeDefined();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: `Download ${pdfFixture.name}` }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(pdfFixture.name);
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} download started`);

  await page.getByRole("button", { name: `Remove ${pdfFixture.name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Remove attachment?" });
  await dialog.getByLabel("Removal reason").fill("Superseded after final verification");
  await dialog.getByRole("button", { name: "Remove attachment" }).click();
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} was removed`);
  await expect(page.getByRole("heading", { name: "Attachments (0/5)" })).toBeVisible();
  await page.getByText("Removed attachments (1)").click();
  await expect(page.getByText("Removed — unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Reason: Superseded after final verification")).toBeVisible();

  const blockedDownload = await request.get(
    `${apiUrl}/api/tickets/${ticketId}/attachments/${attachment!.id}/download`,
    { headers: requesterHeaders(requester.id) },
  );
  expect(blockedDownload.status()).toBe(404);
  expect((await blockedDownload.json()).error.code).toBe("ATTACHMENT_NOT_AVAILABLE");

  const repeatedRemoval = await request.patch(
    `${apiUrl}/api/tickets/${ticketId}/attachments/${attachment!.id}/remove`,
    {
      headers: requesterHeaders(requester.id),
      data: { reason: "Repeated removal must not overwrite audit fields" },
    },
  );
  expect(repeatedRemoval.status()).toBe(404);

  const finalDetail = await getTicketViaApi(request, requester, ticketId);
  const removed = finalDetail.attachments.find((item) => item.id === attachment!.id);
  expect(removed).toMatchObject({
    isRemoved: true,
    removalReason: "Superseded after final verification",
    downloadable: false,
  });
});
