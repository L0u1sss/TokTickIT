import { expect, test } from "@playwright/test";
import {
  pdfFixture,
  requesterByEmail,
  tabTo,
} from "./live-support.js";

test("E2E-06 the requester, ticket, attachment, and dialog workflow is keyboard operable", async ({
  page,
  request,
}) => {
  const requester = await requesterByEmail(request, "david.l@example.com");
  await page.goto("/requester-selection");

  const requesterSelect = page.getByLabel("Development Requester", { exact: true });
  await tabTo(page, requesterSelect);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await expect(requesterSelect).toHaveValue(String(requester.id));
  const continueButton = page.getByRole("button", { name: "Continue" });
  await tabTo(page, continueButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await tabTo(page, skipLink);
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();

  const category = page.getByLabel("Category");
  await tabTo(page, category);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");

  const system = page.getByLabel("Related System");
  await tabTo(page, system);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");

  const summary = page.getByLabel("Summary");
  await tabTo(page, summary);
  await page.keyboard.type("Keyboard-only final Lab 2 workflow");

  const priority = page.getByLabel("Requested Priority");
  await tabTo(page, priority);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");

  const description = page.getByLabel("Description");
  await tabTo(page, description);
  await page.keyboard.type("Every ticket and attachment action remains operable by keyboard.");

  const createButton = page.getByRole("button", { name: "Create ticket" });
  await tabTo(page, createButton);
  await expect(createButton).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /Ticket TKT-\d{4}-\d{6} was created\./ })).toBeVisible();
  await expect(page.getByText("New", { exact: true })).toBeVisible();
  await expect(page.getByText("Low", { exact: true })).toBeVisible();

  const viewTicket = page.getByRole("button", { name: "View ticket" });
  await tabTo(page, viewTicket);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Ticket information", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Tickets", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const fileInput = page.getByLabel("Choose attachment");
  await fileInput.setInputFiles(pdfFixture);
  const uploadButton = page.getByRole("button", { name: "Upload attachment" });
  await tabTo(page, uploadButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} uploaded`);

  const downloadButton = page.getByRole("button", { name: `Download ${pdfFixture.name}` });
  await tabTo(page, downloadButton);
  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  await downloadPromise;
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} download started`);

  const removeButton = page.getByRole("button", { name: `Remove ${pdfFixture.name}` });
  await tabTo(page, removeButton);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Remove attachment?" });
  const cancelButton = dialog.getByRole("button", { name: "Cancel" });
  const reason = dialog.getByLabel("Removal reason");
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(reason).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(removeButton).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(reason).toBeFocused();
  await page.keyboard.type("Removed through keyboard verification");
  const confirmRemoval = dialog.getByRole("button", { name: "Remove attachment" });
  await tabTo(page, confirmRemoval);
  await expect(confirmRemoval).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Attachments (0/5)" })).toBeFocused();
  await expect(page.getByRole("status")).toContainText(`${pdfFixture.name} was removed`);
});
