import { expect, test } from "@playwright/test";

test("E2E-02 completed work gates resolution while cancellation, reopening and advisory remain distinct", async ({ page }) => {
  if (!process.env.E2E_AUTH_PASSWORD) throw new Error("Run npm run test:workflow:e2e for isolated fixtures.");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: false }).fill("queue-browser@example.test");
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Search", { exact: true }).fill("TKT-2026-000001");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("link", { name: /View ticket/ }).click();
  const ticketId = page.url().split("/").pop()!;

  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("Status", { exact: true }).selectOption("RESOLVED");
  await expect(page.getByRole("alert")).toContainText("Complete at least one Action with a Result");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("OPEN");

  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel("Create Action Description").fill("Verified printer connectivity");
  await page.getByLabel("Create Action Assignee").selectOption({ label: "Mali IT Staff (queue-browser@example.test)" });
  await page.getByLabel("Create Action Result").fill("Printer responds and test page completed");
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Verified printer connectivity")).toBeVisible();
  await page.getByRole("button", { name: "Start Action" }).click();
  await expect(page.locator(".action-status", { hasText: "In progress" })).toBeVisible();
  await page.getByRole("button", { name: "Complete Action" }).click();
  await expect(page.locator(".action-status", { hasText: "Completed" })).toBeVisible();

  for (const status of ["RESOLVED", "CLOSED", "REOPENED", "CANCELLED", "REOPENED"]) {
    page.once("dialog", dialog => dialog.accept());
    await page.getByLabel("Status", { exact: true }).selectOption(status);
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue(status);
  }

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByLabel("Email", { exact: false }).fill("auth-browser@example.test");
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket", exact: true })).toBeVisible();
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText("Ticket Detail", { exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Problem Appears Resolved" }).click();
  await expect(page.getByRole("region", { name: "Resolution indication" }).getByRole("status")).toContainText("Reported at");
  expect((await (await page.request.get(`${process.env.E2E_API_URL}/api/tickets/${ticketId}`)).json()).status).toBe("Reopened");
});
