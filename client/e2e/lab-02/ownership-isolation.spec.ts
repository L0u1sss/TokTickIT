import { expect, test } from "@playwright/test";
import {
  apiUrl,
  createTicketViaApi,
  getTicketViaApi,
  requesterByEmail,
  requesterHeaders,
  selectRequester,
  uploadAttachmentViaApi,
} from "./live-support.js";

test("E2E-02 requester switching clears stale state and protects owned resources", async ({
  page,
  request,
}) => {
  const requesterA = await requesterByEmail(request, "jennifer.a@example.com");
  const requesterB = await requesterByEmail(request, "michael.b@example.com");
  const summary = "Requester A private ownership evidence";
  const ticket = await createTicketViaApi(request, requesterA, { summary });
  const attachment = await uploadAttachmentViaApi(request, requesterA, ticket.id);

  await selectRequester(page, requesterA);

  let releaseDelayedList!: () => void;
  const delayedList = new Promise<void>((resolve) => {
    releaseDelayedList = resolve;
  });
  let signalListStarted!: () => void;
  const listStarted = new Promise<void>((resolve) => {
    signalListStarted = resolve;
  });
  let delayed = false;

  await page.route(`${apiUrl}/api/tickets?**`, async (route) => {
    if (!delayed && route.request().headers()["x-requester-id"] === String(requesterA.id)) {
      delayed = true;
      signalListStarted();
      await delayedList;
      try {
        await route.continue();
      } catch {
        // Changing requester aborts the obsolete request as designed.
      }
      return;
    }
    await route.continue();
  });

  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await listStarted;
  await page.getByRole("button", { name: "Change Requester" }).click();
  await expect(page.getByRole("heading", { name: "Select a Development Requester" })).toBeVisible();
  await page.getByLabel("Development Requester", { exact: true }).selectOption(String(requesterB.id));
  await page.getByRole("button", { name: "Continue" }).click();
  releaseDelayedList();

  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tickets yet" })).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toHaveCount(0);
  await expect(page.getByText(`Tickets owned by ${requesterB.displayName}`)).toBeVisible();

  await page.goto(`/tickets/${ticket.id}`);
  await expect(page.getByText("You don't have permission to view this ticket.")).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toHaveCount(0);

  const detailAsB = await request.get(`${apiUrl}/api/tickets/${ticket.id}`, {
    headers: requesterHeaders(requesterB.id),
  });
  expect(detailAsB.status()).toBe(403);

  const downloadAsB = await request.get(
    `${apiUrl}/api/tickets/${ticket.id}/attachments/${attachment.id}/download`,
    { headers: requesterHeaders(requesterB.id) },
  );
  expect(downloadAsB.status()).toBe(403);
  expect(downloadAsB.headers()["content-disposition"]).toBeUndefined();

  const removeAsB = await request.patch(
    `${apiUrl}/api/tickets/${ticket.id}/attachments/${attachment.id}/remove`,
    {
      headers: requesterHeaders(requesterB.id),
      data: { reason: "Foreign requester must not remove this file" },
    },
  );
  expect(removeAsB.status()).toBe(403);

  const ownerDetail = await getTicketViaApi(request, requesterA, ticket.id);
  expect(ownerDetail.attachments).toContainEqual(
    expect.objectContaining({ id: attachment.id, isRemoved: false, downloadable: true }),
  );
});
