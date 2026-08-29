import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import {
  REQUESTER_STORAGE_KEY,
  RequesterProvider,
} from "../../src/context/RequesterContext.js";

const requester: api.Requester = {
  id: 1,
  displayName: "Jennifer Anderson",
  email: "jennifer.a@example.com",
};

const metadata: api.TicketMetadata = {
  categories: [
    { id: 2, name: "Hardware" },
    { id: 3, name: "Software" },
  ],
  relatedSystems: [
    { id: 5, name: "Corporate Laptop" },
    { id: 6, name: "VPN" },
  ],
};

const ticket: api.TicketDetail = {
  id: 145,
  ticketNumber: "TKT-2026-000145",
  summary: "External monitor flickers",
  description: "The monitor flickers after the laptop wakes from sleep.",
  requestedPriority: "HIGH",
  status: "New",
  requester,
  category: metadata.categories[0],
  relatedSystem: metadata.relatedSystems[0],
  activeAttachmentCount: 0,
  attachments: [],
  createdAt: "2026-08-20T07:15:30.000Z",
  updatedAt: "2026-08-20T07:15:30.000Z",
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function renderCreateTicket(
  metadataResult: Promise<api.TicketMetadata> = Promise.resolve(metadata),
) {
  window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
  vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getTicketMetadata").mockReturnValue(metadataResult);
  render(
    <RequesterProvider>
      <App />
    </RequesterProvider>,
  );
  await screen.findByRole("heading", { name: "Create Ticket" });
  return userEvent.setup();
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "Hardware" });
  await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "2");
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Related System" }),
    "5",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Summary" }),
    "  External monitor flickers  ",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Requested Priority" }),
    "HIGH",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Description" }),
    "  The monitor flickers after the laptop wakes from sleep.  ",
  );
}

describe("Create Ticket page", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/tickets/new");
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("shows read-only context, required fields, loading, and active metadata", async () => {
    const pendingMetadata = deferred<api.TicketMetadata>();
    await renderCreateTicket(pendingMetadata.promise);

    expect(screen.getByRole("status")).toHaveTextContent("Loading ticket options");
    expect(screen.getByText("Generated after creation")).toBeInTheDocument();
    expect(screen.getByText("Set after creation")).toBeInTheDocument();
    expect(screen.getAllByText("Jennifer Anderson").length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "Category" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Related System" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Requested Priority" })).toHaveTextContent(
      "LowMediumHigh",
    );
    expect(screen.getByRole("button", { name: "Create ticket" })).toBeDisabled();
    expect(
      screen.getByText("You can add up to 5 attachments after creating the ticket."),
    ).toBeInTheDocument();

    pendingMetadata.resolve(metadata);
    expect(await screen.findByRole("option", { name: "Hardware" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeEnabled();
  });

  it("distinguishes empty reference data and blocks submission", async () => {
    await renderCreateTicket(Promise.resolve({ categories: [], relatedSystems: [] }));
    expect(
      await screen.findByText(/No active categories are available/),
    ).toBeInTheDocument();
    expect(screen.getByText(/No active related systems are available/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create ticket" })).toBeDisabled();
  });

  it("retains entered text through metadata failure and Retry", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
    const metadataSpy = vi
      .spyOn(api, "getTicketMetadata")
      .mockRejectedValueOnce(new Error("database secret"))
      .mockResolvedValueOnce(metadata);
    window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, "1");
    const user = userEvent.setup();
    render(
      <RequesterProvider>
        <App />
      </RequesterProvider>,
    );
    await screen.findByRole("heading", { name: "Create Ticket" });
    await user.type(screen.getByRole("textbox", { name: "Summary" }), "Kept draft");
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByRole("alert")).not.toHaveTextContent("secret");
    await user.click(retry);
    await screen.findByRole("option", { name: "Hardware" });
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue("Kept draft");
    expect(metadataSpy).toHaveBeenCalledTimes(2);
  });

  it("shows field-associated errors for untouched invalid fields", async () => {
    const user = await renderCreateTicket();
    await screen.findByRole("option", { name: "Hardware" });
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveAttribute(
      "aria-required",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Create ticket" }));
    expect(screen.getAllByText("Select a category.")).toHaveLength(2);
    expect(screen.getAllByText("Select a related system.")).toHaveLength(2);
    expect(screen.getAllByText("Select a requested priority.")).toHaveLength(2);
    expect(screen.getAllByText("Summary must be 5 to 120 characters.")).toHaveLength(2);
    expect(screen.getAllByText("Description must be 10 to 2,000 characters.")).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const errorSummary = screen.getByRole("alert", { name: "Check the form:" });
    await waitFor(() => expect(errorSummary).toHaveFocus());
    await user.click(
      screen.getByRole("link", { name: "Summary must be 5 to 120 characters." }),
    );
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveFocus();
  });

  it("validates a field on blur and clears its message only after correction", async () => {
    const user = await renderCreateTicket();
    await screen.findByRole("option", { name: "Hardware" });
    const summary = screen.getByRole("textbox", { name: "Summary" });

    await user.click(summary);
    await user.tab();
    expect(screen.getAllByText("Summary must be 5 to 120 characters.")).toHaveLength(1);

    await user.type(summary, "abc");
    expect(screen.getAllByText("Summary must be 5 to 120 characters.")).toHaveLength(1);
    await user.type(summary, "de");
    expect(screen.queryAllByText("Summary must be 5 to 120 characters.")).toHaveLength(0);
  });

  it("uses Unicode character boundaries without native UTF-16 truncation", async () => {
    const createResult = deferred<api.TicketCreateResult>();
    const createSpy = vi.spyOn(api, "createTicket").mockReturnValue(createResult.promise);
    const user = await renderCreateTicket();
    await screen.findByRole("option", { name: "Hardware" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "2");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Related System" }),
      "5",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Requested Priority" }),
      "HIGH",
    );

    const summary = screen.getByRole("textbox", { name: "Summary" });
    const description = screen.getByRole("textbox", { name: "Description" });
    const validSummary = "😀".repeat(120);
    const validDescription = "𠮷".repeat(2000);

    expect(summary).not.toHaveAttribute("maxlength");
    expect(description).not.toHaveAttribute("maxlength");

    fireEvent.change(summary, { target: { value: `${validSummary}😀` } });
    fireEvent.blur(summary);
    expect(screen.getByText("121 / 120")).toBeInTheDocument();
    expect(screen.getAllByText("Summary must be 5 to 120 characters.")).toHaveLength(1);
    fireEvent.change(summary, { target: { value: validSummary } });
    expect(screen.getByText("120 / 120")).toBeInTheDocument();
    expect(screen.queryAllByText("Summary must be 5 to 120 characters.")).toHaveLength(0);

    fireEvent.change(description, { target: { value: `${validDescription}𠮷` } });
    fireEvent.blur(description);
    expect(screen.getByText("2001 / 2000")).toBeInTheDocument();
    expect(
      screen.getAllByText("Description must be 10 to 2,000 characters."),
    ).toHaveLength(1);
    fireEvent.change(description, { target: { value: validDescription } });
    expect(screen.getByText("2000 / 2000")).toBeInTheDocument();
    expect(
      screen.queryAllByText("Description must be 10 to 2,000 characters."),
    ).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Create ticket" }));
    expect(createSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        summary: validSummary,
        description: validDescription,
      }),
    );
  });

  it("submits one trimmed request, exposes busy state, and renders success", async () => {
    const createResult = deferred<api.TicketCreateResult>();
    const createSpy = vi.spyOn(api, "createTicket").mockReturnValue(createResult.promise);
    const user = await renderCreateTicket();
    await fillValidForm(user);

    const submit = screen.getByRole("button", { name: "Create ticket" });
    await user.dblClick(submit);
    expect(screen.getByRole("button", { name: "Creating ticket…" })).toBeDisabled();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy.mock.calls[0]?.[1]).toEqual({
      clientRequestId: "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
      categoryId: 2,
      relatedSystemId: 5,
      summary: "External monitor flickers",
      requestedPriority: "HIGH",
      description: "The monitor flickers after the laptop wakes from sleep.",
    });

    createResult.resolve({ ticket, replayed: false });
    expect(
      await screen.findByRole("heading", {
        name: "Ticket TKT-2026-000145 was created.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000145")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("uses the same clientRequestId after an outcome-unknown failure", async () => {
    const createSpy = vi
      .spyOn(api, "createTicket")
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce({ ticket, replayed: true });
    const user = await renderCreateTicket();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create ticket" }));

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Summary" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", {
        name: "Ticket TKT-2026-000145 was already created.",
      }),
    ).toBeInTheDocument();
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy.mock.calls[0]?.[1].clientRequestId).toBe(
      createSpy.mock.calls[1]?.[1].clientRequestId,
    );
    expect(screen.getByText(/No duplicate was created/)).toBeInTheDocument();
  });

  it("maps server field errors without clearing the form", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(
      new api.ApiResponseError(
        400,
        "VALIDATION_ERROR",
        "The request contains invalid fields.",
        [{ field: "summary", issue: "Summary is no longer valid." }],
      ),
    );
    const user = await renderCreateTicket();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create ticket" }));
    expect(await screen.findAllByText("Summary is no longer valid.")).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue(
      "  External monitor flickers  ",
    );
  });

  it("shows a blocking conflict and requires review before another submission", async () => {
    const createSpy = vi.spyOn(api, "createTicket").mockRejectedValue(
      new api.ApiResponseError(
        409,
        "DUPLICATE_REQUEST_CONFLICT",
        "clientRequestId was already used for a different request.",
      ),
    );
    const user = await renderCreateTicket();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create ticket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already used for different ticket information",
    );
    expect(screen.getByRole("button", { name: "Create ticket" })).toBeDisabled();
    expect(createSpy).toHaveBeenCalledTimes(1);
    await user.type(screen.getByRole("textbox", { name: "Summary" }), " updated");
    expect(screen.getByRole("button", { name: "Create ticket" })).toBeEnabled();
  });

  it("resets to a clean form for another logical Ticket", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue({ ticket, replayed: false });
    const user = await renderCreateTicket();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create ticket" }));
    await user.click(await screen.findByRole("button", { name: "Create another Ticket" }));
    expect(screen.getByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue("");
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("cancels a clean form to My Tickets without a confirmation", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      sort: { by: "createdAt", order: "desc" },
      filters: {
        search: null,
        status: null,
        requestedPriority: null,
        categoryId: null,
        relatedSystemId: null,
      },
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = await renderCreateTicket();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/tickets");
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  it("keeps or discards a dirty draft according to the Cancel confirmation", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      sort: { by: "createdAt", order: "desc" },
      filters: {
        search: null,
        status: null,
        requestedPriority: null,
        categoryId: null,
        relatedSystemId: null,
      },
    });
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const user = await renderCreateTicket();
    await user.type(screen.getByRole("textbox", { name: "Summary" }), "Keep this draft");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.location.pathname).toBe("/tickets/new");
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue("Keep this draft");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe("/tickets");
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });
});
