import { expect, test } from "@playwright/test";
import { requesterByEmail, selectRequester, setSeededRequesterState } from "./live-support.js";
test("E2E-03 session replaces stored identity and revalidates inactive users", async ({ page, request }) => {
  const requester = await requesterByEmail(request, "david.l@example.com");
  await page.addInitScript(() => sessionStorage.setItem("toktickit.requesterId", "999"));
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await selectRequester(page, requester);
  await page.goto("/tickets");
  await expect(page.getByText(`Tickets owned by ${requester.displayName}`)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("toktickit.requesterId"))).toBeNull();
  await setSeededRequesterState(requester.email, "inactive");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(requester.displayName, { exact: true })).toHaveCount(0);
});
