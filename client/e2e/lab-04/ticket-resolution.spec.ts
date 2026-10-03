import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

for (const [index, viewport] of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
].entries()) {
test(`E2E-02 ${viewport.name}: current-cycle work gates resolution, cancellation and advisory`, async ({ page }, testInfo) => {
  if (!process.env.E2E_AUTH_PASSWORD) throw new Error("Run npm run test:workflow:e2e for isolated fixtures.");
  await page.setViewportSize(viewport);
  const evidence = async (state: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const focused = await page.evaluateHandle(() => document.activeElement);
    const findings = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    await focused.evaluate(element => { if (element instanceof HTMLElement && element.isConnected) element.focus({ preventScroll: true }); });
    await focused.dispose();
    expect(findings.violations.filter(item => item.impact === "serious" || item.impact === "critical")).toEqual([]);
    const directory = `../artifacts/lab-04/screenshots/ticket-workflow/${state}`;
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: `${directory}/${viewport.name}.png`, fullPage: true });
  };
  await page.goto("/login");
  await page.getByLabel("Email", { exact: false }).fill("queue-browser@example.test");
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Search", { exact: true }).fill(`TKT-2026-${String(1 + index * 2 + testInfo.retry * 6).padStart(6, "0")}`);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("link", { name: /View ticket/ }).click();
  const ticketId = page.url().split("/").pop()!;

  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("Status", { exact: true }).selectOption("RESOLVED");
  await expect(page.getByRole("alert")).toContainText("Complete at least one Action with a Result");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("OPEN");
  await evidence("resolution-gate");

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

  for (const status of ["RESOLVED", "CLOSED", "REOPENED"]) {
    page.once("dialog", dialog => dialog.accept());
    await page.getByLabel("Status", { exact: true }).selectOption(status);
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue(status);
    await evidence(status.toLowerCase());
  }

  // Completed history is retained, but cannot resolve a new workflow cycle.
  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("Status", { exact: true }).selectOption("RESOLVED");
  await expect(page.getByRole("alert")).toContainText("current workflow cycle");
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel("Create Action Description").fill("Pending new-cycle follow-up");
  await page.getByLabel("Create Action Assignee").selectOption({ label: "Mali IT Staff (queue-browser@example.test)" });
  await page.getByRole("checkbox", { name: "Follow-up required", exact: true }).check();
  await page.getByLabel("Create Action Follow-up Note").fill("Preserve this cancellation history");
  await page.getByRole("button", { name: "Create Action" }).click();
  await expect(page.getByText("Pending new-cycle follow-up")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("Status", { exact: true }).selectOption("CANCELLED");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("CANCELLED");
  await expect(page.getByText("Historical follow-up", { exact: true })).toBeVisible();
  await evidence("cancelled");
  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("Status", { exact: true }).selectOption("REOPENED");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("REOPENED");

  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByLabel("Email", { exact: false }).fill("auth-browser@example.test");
  await page.getByLabel("Password", { exact: false }).fill(process.env.E2E_AUTH_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText("Ticket Detail", { exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Problem Appears Resolved" }).click();
  await expect(page.getByRole("region", { name: "Resolution indication" }).getByRole("status")).toContainText("Reported at");
  expect((await (await page.request.get(`${process.env.E2E_API_URL}/api/tickets/${ticketId}`)).json()).status).toBe("Reopened");
  await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
  await expect(page.getByText("Verified printer connectivity")).toBeVisible();
  await evidence("requester-advisory");
});
}
