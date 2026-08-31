import { expect, test } from "@playwright/test";
import {
  apiUrl,
  fillCreateTicket,
  requesterByEmail,
  requesterHeaders,
  selectRequester,
} from "./live-support.js";

test("E2E-04 lost create response replays one ticket and rotates the next logical key", async ({
  page,
  request,
}) => {
  const requester = await requesterByEmail(request, "sarah.j@example.com");
  const summary = "Lost response idempotency verification";
  const firstRequestIds: string[] = [];
  let discardFirstResponse = true;

  await page.route(`${apiUrl}/api/tickets`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { clientRequestId: string };
    firstRequestIds.push(body.clientRequestId);
    if (discardFirstResponse) {
      discardFirstResponse = false;
      const liveResponse = await route.fetch();
      expect(liveResponse.status()).toBe(201);
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await selectRequester(page, requester);
  await fillCreateTicket(page, {
    summary,
    description: "The first successful server response is intentionally discarded before retry.",
    priority: "MEDIUM",
  });
  await page.getByRole("button", { name: "Create ticket" }).click();
  await expect(page.getByText("We couldn't create your ticket. Try again.")).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(
    page.getByRole("heading", { name: /Ticket TKT-\d{4}-\d{6} was already created\./ }),
  ).toBeVisible();
  await expect(page.getByText("Showing the original ticket. No duplicate was created.")).toBeVisible();
  expect(firstRequestIds).toHaveLength(2);
  expect(firstRequestIds[1]).toBe(firstRequestIds[0]);

  const listResponse = await request.get(
    `${apiUrl}/api/tickets?search=${encodeURIComponent(summary)}&sortBy=createdAt&sortOrder=desc&page=1&pageSize=10`,
    { headers: requesterHeaders(requester.id) },
  );
  expect(listResponse.status()).toBe(200);
  const firstList = (await listResponse.json()) as {
    items: Array<{ id: number; summary: string }>;
    pagination: { totalItems: number };
  };
  expect(firstList.pagination.totalItems).toBe(1);
  expect(firstList.items).toHaveLength(1);

  await page.getByRole("button", { name: "Create another Ticket" }).click();
  await fillCreateTicket(page, {
    summary: "A separate logical request after the replay",
    description: "A new logical submission must receive a different client request identifier.",
    priority: "LOW",
  });
  await page.getByRole("button", { name: "Create ticket" }).click();
  await expect(page.getByRole("heading", { name: /was created\./ })).toBeVisible();
  expect(firstRequestIds).toHaveLength(3);
  expect(firstRequestIds[2]).not.toBe(firstRequestIds[0]);
});
