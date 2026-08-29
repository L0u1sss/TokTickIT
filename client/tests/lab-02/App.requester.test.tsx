import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";

const requester: api.Requester = {
  id: 1,
  displayName: "Jennifer Anderson",
  email: "jennifer.a@example.com",
};

const secondRequester: api.Requester = {
  id: 2,
  displayName: "Michael Brown",
  email: "michael.b@example.com",
};

const metadata: api.TicketMetadata = {
  categories: [{ id: 1, name: "Hardware" }],
  relatedSystems: [{ id: 1, name: "Corporate Laptop" }],
};

describe("requester application flow", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("gates a protected deep link at the requester-selection route", async () => {
    vi.spyOn(api, "getRequesters").mockReturnValue(new Promise(() => {}));
    window.history.replaceState({}, "", "/tickets/new");
    render(
      <RequesterProvider>
        <App />
      </RequesterProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Select a Development Requester" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/requester-selection");
    });
  });

  it("opens Create Ticket only after Continue and returns to selection", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
    vi.spyOn(api, "getTicketMetadata").mockResolvedValue(metadata);
    const user = userEvent.setup();

    render(
      <RequesterProvider>
        <App />
      </RequesterProvider>,
    );

    await screen.findByRole("option", { name: /Jennifer Anderson/i });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Development Requester" }),
      "1",
    );
    expect(screen.queryByRole("heading", { name: "Create Ticket" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/tickets/new");
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(
      within(header).getByRole("link", { name: "Create Ticket" }),
    ).toHaveAttribute("aria-current", "page");

    await user.click(within(header).getByRole("button", { name: "Change Requester" }));
    expect(
      await screen.findByRole("heading", { name: "Select a Development Requester" }),
    ).toBeInTheDocument();
  });

  it("clears the previous requester's draft before committing another requester", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester, secondRequester]);
    vi.spyOn(api, "getTicketMetadata").mockResolvedValue(metadata);
    const user = userEvent.setup();

    render(
      <RequesterProvider>
        <App />
      </RequesterProvider>,
    );

    await screen.findByRole("option", { name: /Jennifer Anderson/i });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Development Requester" }),
      "1",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByRole("textbox", { name: "Summary" }), "Private draft");

    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    const nextSelect = await screen.findByRole("combobox", {
      name: "Development Requester",
    });
    await user.selectOptions(nextSelect, "2");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getAllByText("Michael Brown")).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "Summary" })).toHaveValue("");
    expect(screen.queryByDisplayValue("Private draft")).not.toBeInTheDocument();
  });
});
