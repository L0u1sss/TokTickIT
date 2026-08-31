import { expect, test } from "@playwright/test";
import {
  apiUrl,
  createTicketViaApi,
  expectNoInternalDetails,
  pdfFixture,
  requesterByEmail,
  selectRequester,
} from "./live-support.js";

test("E2E-05 empty, no-results, and live operation failures recover safely", async ({
  page,
  request,
}) => {
  const requester = await requesterByEmail(request, "michael.b@example.com");
  await selectRequester(page, requester);
  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tickets yet" })).toBeVisible();

  const ticket = await createTicketViaApi(request, requester, {
    summary: "State recovery live ticket",
    description: "Used to verify retry behavior without exposing internal server information.",
  });

  let abortList = true;
  await page.route(`${apiUrl}/api/tickets?**`, async (route) => {
    if (abortList && route.request().method() === "GET") {
      abortList = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.reload();
  await expect(page.getByText("We couldn't load your tickets.")).toBeVisible();
  await expectNoInternalDetails(page);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("link", { name: ticket.ticketNumber, exact: true })).toBeVisible();

  await page.getByLabel("Search tickets").fill("definitely-no-matching-ticket");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByRole("heading", { name: "No tickets match your search or filters" }),
  ).toBeVisible();
  await page
    .locator(".ticket-list-state")
    .getByRole("button", { name: "Reset filters" })
    .click();
  await expect(page.getByRole("link", { name: ticket.ticketNumber, exact: true })).toBeVisible();

  let abortDetail = true;
  await page.route(new RegExp(`${apiUrl}/api/tickets/${ticket.id}$`), async (route) => {
    if (abortDetail && route.request().method() === "GET") {
      abortDetail = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByRole("link", { name: `View details for ${ticket.ticketNumber}` }).click();
  await expect(page.getByText("We couldn't load this ticket.")).toBeVisible();
  await expectNoInternalDetails(page);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: ticket.ticketNumber })).toBeVisible();

  let abortUpload = true;
  await page.route(new RegExp(`${apiUrl}/api/tickets/${ticket.id}/attachments$`), async (route) => {
    if (abortUpload && route.request().method() === "POST") {
      abortUpload = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByLabel("Choose attachment").setInputFiles(pdfFixture);
  await page.getByRole("button", { name: "Upload attachment" }).click();
  await expect(page.getByText("We couldn't upload this attachment. Try again.")).toBeVisible();
  await expect(page.getByText(pdfFixture.name, { exact: true })).toBeVisible();
  await expectNoInternalDetails(page);
  await page.getByRole("button", { name: "Retry upload" }).click();
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} uploaded`);

  let abortDownload = true;
  await page.route(
    new RegExp(`${apiUrl}/api/tickets/${ticket.id}/attachments/\\d+/download$`),
    async (route) => {
      if (abortDownload && route.request().method() === "GET") {
        abortDownload = false;
        await route.abort("failed");
        return;
      }
      await route.continue();
    },
  );
  await page.getByRole("button", { name: `Download ${pdfFixture.name}` }).click();
  await expect(page.getByText("We couldn't download this attachment. Try again.")).toBeVisible();
  await expectNoInternalDetails(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Retry download" }).click();
  await downloadPromise;
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} download started`);

  let abortRemoval = true;
  await page.route(
    new RegExp(`${apiUrl}/api/tickets/${ticket.id}/attachments/\\d+/remove$`),
    async (route) => {
      if (abortRemoval && route.request().method() === "PATCH") {
        abortRemoval = false;
        await route.abort("failed");
        return;
      }
      await route.continue();
    },
  );
  await page.getByRole("button", { name: `Remove ${pdfFixture.name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Remove attachment?" });
  const reason = "Recovery keeps this removal reason";
  await dialog.getByLabel("Removal reason").fill(reason);
  await dialog.getByRole("button", { name: "Remove attachment" }).click();
  await expect(dialog.getByText("We couldn't remove this attachment. Try again.")).toBeVisible();
  await expect(dialog.getByLabel("Removal reason")).toHaveValue(reason);
  await expectNoInternalDetails(page);
  await dialog.getByRole("button", { name: "Remove attachment" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} was removed`);
});
