import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import {
  REQUESTER_STORAGE_KEY,
  RequesterProvider,
} from "../../src/context/RequesterContext.js";

const requester: api.Requester = {
  id: 12,
  displayName: "Mali Chantarangsu",
  email: "mali@example.com",
};
const activeAttachment: api.Attachment = {
  id: 51,
  fileName: "monitor damage.jpg",
  mediaType: "image/jpeg",
  sizeBytes: 248_031,
  uploadedAt: "2026-08-20T07:16:00.000Z",
  isRemoved: false,
  removedAt: null,
  removalReason: null,
  downloadable: true,
};
const removedAttachment: api.Attachment = {
  id: 52,
  fileName: "old report.pdf",
  mediaType: "application/pdf",
  sizeBytes: 12_000,
  uploadedAt: "2026-08-20T07:17:00.000Z",
  isRemoved: true,
  removedAt: "2026-08-20T08:00:00.000Z",
  removalReason: "Uploaded a clearer report.",
  downloadable: false,
};
const ticket: api.TicketDetail = {
  id: 145,
  ticketNumber: "TKT-2026-000145",
  summary: "External monitor flickers",
  description: "Line one\n<script>alert('not html')</script>",
  requestedPriority: "HIGH",
  status: "New",
  requester,
  category: { id: 3, name: "Hardware" },
  relatedSystem: { id: 8, name: "Office Workstation" },
  activeAttachmentCount: 1,
  attachments: [activeAttachment, removedAttachment],
  createdAt: "2026-08-20T07:15:30.000Z",
  updatedAt: "2026-08-20T07:18:00.000Z",
};

function renderDetail() {
  render(
    <RequesterProvider>
      <App />
    </RequesterProvider>,
  );
}

describe("Requester Ticket Detail", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, "12");
    window.history.replaceState({}, "", "/tickets/145");
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("renders complete read-only owned detail and active/removed metadata", async () => {
    renderDetail();
    expect(await screen.findByRole("heading", { name: ticket.ticketNumber })).toBeInTheDocument();
    expect(screen.getByText(ticket.summary)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Office Workstation")).toBeInTheDocument();
    expect(screen.getByText(/<script>alert\('not html'\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("heading", { name: "Attachments (1/5)" })).toBeInTheDocument();
    expect(screen.getByText(activeAttachment.fileName)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Removed attachments (1)"));
    expect(screen.getByText(removedAttachment.fileName)).toBeInTheDocument();
    expect(screen.getByText(removedAttachment.removalReason!)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Download ${removedAttachment.fileName}` })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to My Tickets" })).toHaveAttribute("href", "/tickets");
  });

  it.each([
    [403, "TICKET_FORBIDDEN", "You don't have permission to view this ticket."],
    [404, "TICKET_NOT_FOUND", "Ticket not found."],
    [500, "INTERNAL_ERROR", "We couldn't load this ticket."],
  ])("shows a protected safe state for %i", async (status, code, copy) => {
    vi.mocked(api.getTicketDetail).mockRejectedValue(
      new api.ApiResponseError(status, code, "Prisma secret internal"),
    );
    renderDetail();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy);
    expect(alert).not.toHaveTextContent(/Prisma|secret|TKT-2026|monitor damage/);
    expect(screen.queryByText(ticket.summary)).not.toBeInTheDocument();
    if (status === 500) expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("validates a selected file and uploads an allowed attachment", async () => {
    const uploaded = { ...activeAttachment, id: 53, fileName: "new-proof.png", mediaType: "image/png" };
    const uploadSpy = vi.spyOn(api, "uploadAttachment").mockResolvedValue(uploaded);
    const user = userEvent.setup({ applyAccept: false });
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const input = screen.getByLabelText("Choose attachment");

    await user.upload(input, new File(["bad"], "bad.txt", { type: "text/plain" }));
    expect(screen.getByText("Choose a JPG, PNG, WEBP, or PDF file.")).toBeInTheDocument();
    expect(uploadSpy).not.toHaveBeenCalled();

    const valid = new File([new Uint8Array(5_242_880)], "new-proof.png", { type: "image/png" });
    await user.upload(input, valid);
    await user.click(screen.getByRole("button", { name: "Upload attachment" }));
    expect(uploadSpy).toHaveBeenCalledWith(expect.any(Function), 145, valid);
    expect(await screen.findByText("new-proof.png uploaded")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments (2/5)" })).toBeInTheDocument();
  });

  it("requires a valid reason and moves removed metadata out of active actions", async () => {
    const removed = {
      ...activeAttachment,
      isRemoved: true,
      removedAt: "2026-08-20T08:30:00.000Z",
      removalReason: "Uploaded a clearer image.",
      downloadable: false,
    };
    const removeSpy = vi.spyOn(api, "removeAttachment").mockResolvedValue(removed);
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    await user.click(screen.getByRole("button", { name: `Remove ${activeAttachment.fileName}` }));
    const dialog = screen.getByRole("dialog", { name: "Remove attachment?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.type(within(dialog).getByLabelText(/^Removal reason/), "no");
    await user.tab();
    expect(within(dialog).getByText("Removal reason must be 5 to 500 characters.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remove attachment" })).toBeDisabled();
    expect(removeSpy).not.toHaveBeenCalled();

    const reason = within(dialog).getByLabelText(/^Removal reason/);
    await user.clear(reason);
    await user.type(reason, "Uploaded a clearer image.");
    await user.click(within(dialog).getByRole("button", { name: "Remove attachment" }));
    expect(removeSpy).toHaveBeenCalledWith(
      expect.any(Function), 145, 51, "Uploaded a clearer image.",
    );
    expect(await screen.findByText(`${activeAttachment.fileName} was removed`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments (0/5)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments (0/5)" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: `Download ${activeAttachment.fileName}` })).not.toBeInTheDocument();
  });

  it("refreshes metadata when download reports an unavailable attachment", async () => {
    vi.spyOn(api, "downloadAttachment").mockRejectedValue(
      new api.ApiResponseError(404, "ATTACHMENT_NOT_AVAILABLE", "internal unavailable"),
    );
    vi.mocked(api.getTicketDetail)
      .mockResolvedValueOnce(ticket)
      .mockResolvedValueOnce({
        ...ticket,
        activeAttachmentCount: 0,
        attachments: [{ ...activeAttachment, isRemoved: true, removedAt: "2026-08-20T08:30:00.000Z", removalReason: "Removed elsewhere.", downloadable: false }, removedAttachment],
      });
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    await user.click(screen.getByRole("button", { name: `Download ${activeAttachment.fileName}` }));
    expect(await screen.findByText("This attachment is no longer available for download.")).toBeInTheDocument();
    await waitFor(() => expect(api.getTicketDetail).toHaveBeenCalledTimes(2));
  });

  it("rejects a file over the exact project limit before upload", async () => {
    const uploadSpy = vi.spyOn(api, "uploadAttachment");
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });

    await user.upload(
      screen.getByLabelText("Choose attachment"),
      new File([new Uint8Array(5_242_881)], "too-large.png", { type: "image/png" }),
    );
    expect(screen.getByText("File must be 5 MB or smaller.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload attachment" })).toBeDisabled();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("closes the removal dialog with Escape and restores trigger focus", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const trigger = screen.getByRole("button", { name: `Remove ${activeAttachment.fileName}` });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/^Removal reason/)).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("disables upload and explains recovery at five active attachments", async () => {
    const fiveAttachments = Array.from({ length: 5 }, (_, index) => ({
      ...activeAttachment,
      id: 60 + index,
      fileName: `active-${index + 1}.png`,
      mediaType: "image/png",
    }));
    vi.mocked(api.getTicketDetail).mockResolvedValue({
      ...ticket,
      activeAttachmentCount: 5,
      attachments: fiveAttachments,
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Attachments (5/5)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose attachment")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload attachment" })).toBeDisabled();
    expect(screen.getByText(/already has 5 active attachments/)).toBeInTheDocument();
  });

  it("retains an eligible file and exposes an explicit upload retry", async () => {
    const uploaded = { ...activeAttachment, id: 53, fileName: "retry.png", mediaType: "image/png" };
    const uploadSpy = vi.spyOn(api, "uploadAttachment")
      .mockRejectedValueOnce(new api.ApiResponseError(500, "INTERNAL_ERROR", "storage path secret"))
      .mockResolvedValueOnce(uploaded);
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    const file = new File(["png"], "retry.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Choose attachment"), file);
    await user.click(screen.getByRole("button", { name: "Upload attachment" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("We couldn't upload this attachment. Try again.");
    expect(error).not.toHaveTextContent(/storage|secret/);
    expect(screen.getByText("retry.png")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry upload" }));
    expect(await screen.findByText("retry.png uploaded")).toBeInTheDocument();
    expect(uploadSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps a valid removal reason after a safe retryable failure", async () => {
    const removed = {
      ...activeAttachment,
      isRemoved: true,
      removedAt: "2026-08-20T08:30:00.000Z",
      removalReason: "Uploaded a clearer image.",
      downloadable: false,
    };
    const removeSpy = vi.spyOn(api, "removeAttachment")
      .mockRejectedValueOnce(new api.ApiResponseError(500, "INTERNAL_ERROR", "Prisma secret"))
      .mockResolvedValueOnce(removed);
    const user = userEvent.setup();
    renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    await user.click(screen.getByRole("button", { name: `Remove ${activeAttachment.fileName}` }));
    const dialog = screen.getByRole("dialog", { name: "Remove attachment?" });
    const input = within(dialog).getByLabelText(/^Removal reason/);
    await user.type(input, "Uploaded a clearer image.");
    await user.click(within(dialog).getByRole("button", { name: "Remove attachment" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "We couldn't remove this attachment. Try again.",
    );
    expect(input).toHaveValue("Uploaded a clearer image.");
    expect(dialog).not.toHaveTextContent(/Prisma|secret/);
    await user.click(within(dialog).getByRole("button", { name: "Remove attachment" }));
    expect(await screen.findByText(`${activeAttachment.fileName} was removed`)).toBeInTheDocument();
    expect(removeSpy).toHaveBeenCalledTimes(2);
  });
});
