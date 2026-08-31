import { expect, test } from "@playwright/test";
import {
  apiUrl,
  requesterByEmail,
  requesterStorageKey,
  selectRequester,
  setSeededRequesterState,
} from "./live-support.js";

test("E2E-03 requester gate restores valid context and clears invalid or inactive context", async ({
  page,
  request,
}) => {
  const requester = await requesterByEmail(request, "david.l@example.com");
  let protectedRequestsBeforeSelection = 0;
  page.on("request", (browserRequest) => {
    const url = new URL(browserRequest.url());
    if (url.origin === apiUrl && url.pathname.startsWith("/api/tickets")) {
      protectedRequestsBeforeSelection += 1;
    }
  });

  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/requester-selection$/);
  await expect(page.getByRole("heading", { name: "Select a Development Requester" })).toBeVisible();
  expect(protectedRequestsBeforeSelection).toBe(0);

  await selectRequester(page, requester);
  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Tickets owned by ${requester.displayName}`)).toBeVisible();
  await expect(page.evaluate((key) => sessionStorage.getItem(key), requesterStorageKey)).resolves.toBe(
    String(requester.id),
  );

  await page.evaluate((key) => sessionStorage.setItem(key, "not-an-id"), requesterStorageKey);
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/requester-selection$/);
  await expect(page.evaluate((key) => sessionStorage.getItem(key), requesterStorageKey)).resolves.toBeNull();

  await page.evaluate((key) => sessionStorage.setItem(key, "5"), requesterStorageKey);
  await page.goto("/tickets/new");
  await expect(page).toHaveURL(/\/requester-selection$/);
  await expect(page.evaluate((key) => sessionStorage.getItem(key), requesterStorageKey)).resolves.toBeNull();

  await selectRequester(page, requester);
  await setSeededRequesterState(requester.email, "inactive");
  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Select a Development Requester" })).toBeVisible();
  await expect(page).toHaveURL(/\/requester-selection$/);
  await expect(page.evaluate((key) => sessionStorage.getItem(key), requesterStorageKey)).resolves.toBeNull();
  await expect(page.getByText(requester.displayName, { exact: true })).toHaveCount(0);
});
