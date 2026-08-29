import { act, render, screen, waitFor, within } from "@testing-library/react";
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
const otherRequester: api.Requester = {
  id: 13,
  displayName: "Niran Kittisak",
  email: "niran@example.com",
};
const metadata: api.TicketMetadata = {
  categories: [{ id: 3, name: "Hardware" }],
  relatedSystems: [{ id: 8, name: "Office Workstation" }],
};
const ticket: api.TicketSummary = {
  id: 145,
  ticketNumber: "TKT-2026-000145",
  summary: "External monitor flickers",
  requestedPriority: "HIGH",
  status: "New",
  category: metadata.categories[0],
  relatedSystem: metadata.relatedSystems[0],
  activeAttachmentCount: 1,
  createdAt: "2026-08-20T07:15:30.000Z",
  updatedAt: "2026-08-20T07:16:00.000Z",
};

function response(
  items: api.TicketSummary[] = [ticket],
  overrides: Partial<api.TicketListResponse["pagination"]> = {},
): api.TicketListResponse {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 10,
      totalItems: items.length,
      totalPages: items.length === 0 ? 0 : 1,
      ...overrides,
    },
    sort: { by: "createdAt", order: "desc" },
    filters: {
      search: null,
      status: null,
      requestedPriority: null,
      categoryId: null,
      relatedSystemId: null,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderMyTickets() {
  render(
    <RequesterProvider>
      <App />
    </RequesterProvider>,
  );
}

describe("My Tickets page", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requester.id));
    window.history.replaceState({}, "", "/tickets");
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
    vi.spyOn(api, "getTicketMetadata").mockResolvedValue(metadata);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("hides stale results while loading, then renders the owned semantic table", async () => {
    const pending = deferred<api.TicketListResponse>();
    const listSpy = vi.spyOn(api, "getTickets").mockReturnValue(pending.promise);
    renderMyTickets();

    await screen.findByRole("heading", { name: "My Tickets" });
    expect(screen.getByRole("status")).toHaveTextContent("Loading tickets");
    expect(screen.queryByText(ticket.ticketNumber)).not.toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        sortBy: "createdAt",
        sortOrder: "desc",
        page: 1,
        pageSize: 10,
      }),
      expect.any(AbortSignal),
    );

    pending.resolve(response());
    const table = await screen.findByRole("table", {
      name: `Tickets owned by ${requester.displayName}`,
    });
    expect(within(table).getByText(ticket.ticketNumber)).toHaveAttribute(
      "href",
      "/tickets/145",
    );
    expect(within(table).getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1 tickets")).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: "My Tickets" }),
    ).toHaveAttribute("aria-current", "page");
    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    skipLink.click();
    expect(screen.getByRole("main")).toHaveFocus();
    expect(within(table).getByRole("columnheader", { name: "Created" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("distinguishes the unfiltered Empty state and navigates to Create Ticket", async () => {
    vi.spyOn(api, "getTickets").mockResolvedValue(response([]));
    renderMyTickets();
    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Create your first ticket" }),
    );
    expect(window.location.pathname).toBe("/tickets/new");
    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
  });

  it("shows No Results for active criteria and Reset filters restores defaults", async () => {
    window.history.replaceState({}, "", "/tickets?search=missing&page=2");
    const listSpy = vi.spyOn(api, "getTickets").mockResolvedValue(response([]));
    renderMyTickets();
    const noResults = await screen.findByText(
      "No tickets match your search or filters",
    );
    await userEvent.setup().click(
      within(noResults.parentElement as HTMLElement).getByRole("button", {
        name: "Reset filters",
      }),
    );
    await waitFor(() => expect(window.location.search).toBe(""));
    const lastQuery = listSpy.mock.calls.at(-1)?.[1];
    expect(lastQuery).toMatchObject({ page: 1, pageSize: 10 });
    expect(lastQuery).not.toHaveProperty("search");
  });

  it("shows a safe retryable failure without stale rows", async () => {
    const listSpy = vi
      .spyOn(api, "getTickets")
      .mockRejectedValueOnce(new Error("Prisma secret"))
      .mockResolvedValueOnce(response());
    renderMyTickets();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load your tickets.",
    );
    expect(screen.queryByText(ticket.ticketNumber)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(ticket.ticketNumber)).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Prisma|secret/)).not.toBeInTheDocument();
  });

  it("maps search, filters, sort, and page size to URL/API state and resets page", async () => {
    const listSpy = vi.spyOn(api, "getTickets").mockResolvedValue(response());
    const user = userEvent.setup();
    renderMyTickets();
    await screen.findByText(ticket.ticketNumber);

    await user.type(screen.getByRole("searchbox", { name: "Search tickets" }), " monitor ");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "3");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Related System" }),
      "8",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Requested Priority" }),
      "HIGH",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "New");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "summary:asc");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Tickets per page" }),
      "20",
    );

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("search")).toBe("monitor");
      expect(params.get("categoryId")).toBe("3");
      expect(params.get("relatedSystemId")).toBe("8");
      expect(params.get("requestedPriority")).toBe("HIGH");
      expect(params.get("status")).toBe("New");
      expect(params.get("sortBy")).toBe("summary");
      expect(params.get("sortOrder")).toBe("asc");
      expect(params.get("pageSize")).toBe("20");
      expect(params.get("page")).toBe("1");
    });
    expect(listSpy).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({
        search: "monitor",
        categoryId: 3,
        relatedSystemId: 8,
        requestedPriority: "HIGH",
        status: "New",
        sortBy: "summary",
        sortOrder: "asc",
        page: 1,
        pageSize: 20,
      }),
      expect.any(AbortSignal),
    );
  });

  it("maps every documented priority, sort, and page-size option", async () => {
    const listSpy = vi.spyOn(api, "getTickets").mockResolvedValue(response());
    const user = userEvent.setup();
    renderMyTickets();
    await screen.findByText(ticket.ticketNumber);

    const priority = screen.getByRole("combobox", { name: "Requested Priority" });
    for (const value of ["LOW", "MEDIUM", "HIGH"] as const) {
      await user.selectOptions(priority, value);
      await waitFor(() =>
        expect(listSpy).toHaveBeenLastCalledWith(
          expect.any(Function),
          expect.objectContaining({ requestedPriority: value, page: 1 }),
          expect.any(AbortSignal),
        ),
      );
    }

    const sort = screen.getByRole("combobox", { name: "Sort" });
    for (const [sortBy, sortOrder] of [
      ["createdAt", "desc"],
      ["createdAt", "asc"],
      ["ticketNumber", "asc"],
      ["ticketNumber", "desc"],
      ["summary", "asc"],
      ["summary", "desc"],
    ] as const) {
      await user.selectOptions(sort, `${sortBy}:${sortOrder}`);
      await waitFor(() =>
        expect(listSpy).toHaveBeenLastCalledWith(
          expect.any(Function),
          expect.objectContaining({ sortBy, sortOrder, page: 1 }),
          expect.any(AbortSignal),
        ),
      );
    }

    const pageSize = screen.getByRole("combobox", { name: "Tickets per page" });
    for (const value of [10, 20, 50] as const) {
      await user.selectOptions(pageSize, String(value));
      await waitFor(() =>
        expect(listSpy).toHaveBeenLastCalledWith(
          expect.any(Function),
          expect.objectContaining({ pageSize: value, page: 1 }),
          expect.any(AbortSignal),
        ),
      );
    }
  });

  it("renders mobile cards instead of duplicate table content", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList);
    vi.spyOn(api, "getTickets").mockResolvedValue(response());
    renderMyTickets();
    const cardHeading = await screen.findByRole("heading", {
      name: ticket.summary,
    });
    expect(cardHeading).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: `View details for ${ticket.ticketNumber}` })).toHaveAttribute(
      "href",
      "/tickets/145",
    );
  });

  it("restores URL query state on browser navigation", async () => {
    const listSpy = vi.spyOn(api, "getTickets").mockResolvedValue(response());
    renderMyTickets();
    await screen.findByText(ticket.ticketNumber);
    act(() => {
      window.history.pushState({}, "", "/tickets?requestedPriority=LOW&page=2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.any(Function),
        expect.objectContaining({ requestedPriority: "LOW", page: 2 }),
        expect.any(AbortSignal),
      ),
    );
  });

  it("renders accessible pagination and requests the selected page", async () => {
    window.history.replaceState({}, "", "/tickets?page=2");
    const listSpy = vi.spyOn(api, "getTickets").mockResolvedValue(
      response([ticket], {
        page: 2,
        totalItems: 21,
        totalPages: 3,
      }),
    );
    const user = userEvent.setup();
    renderMyTickets();

    await screen.findByText(ticket.ticketNumber);
    const pagination = screen.getByRole("navigation", { name: "Ticket pages" });
    expect(within(pagination).getByRole("button", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(pagination).getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(within(pagination).getByRole("button", { name: "Next" })).toBeEnabled();

    await user.click(within(pagination).getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.any(Function),
        expect.objectContaining({ page: 3 }),
        expect.any(AbortSignal),
      ),
    );
    expect(new URLSearchParams(window.location.search).get("page")).toBe("3");
  });

  it("clears list state and ignores a late response when changing requester", async () => {
    vi.mocked(api.getRequesters).mockResolvedValue([requester, otherRequester]);
    const pending = deferred<api.TicketListResponse>();
    vi.spyOn(api, "getTickets").mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderMyTickets();
    await screen.findByRole("heading", { name: "My Tickets" });

    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    expect(
      await screen.findByRole("heading", { name: "Select a Development Requester" }),
    ).toBeInTheDocument();
    pending.resolve(response());
    expect(screen.queryByText(ticket.ticketNumber)).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Development Requester" }),
      String(otherRequester.id),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/tickets/new");
    expect(window.location.search).toBe("");
    expect(screen.queryByText(ticket.ticketNumber)).not.toBeInTheDocument();
  });
});
