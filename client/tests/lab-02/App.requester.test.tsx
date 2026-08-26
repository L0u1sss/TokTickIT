import { render, screen, within } from "@testing-library/react";
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

describe("requester application flow", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("opens the dashboard only after Continue and returns to selection from the header", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
    const user = userEvent.setup();

    render(
      <RequesterProvider>
        <App />
      </RequesterProvider>,
    );

    await screen.findByRole("option", { name: /Jennifer Anderson/i });
    const select = screen.getByRole("combobox", { name: "Development Requester" });
    await user.selectOptions(select, "1");
    expect(screen.queryByRole("heading", { name: "Requester Dashboard" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check System" })).toBeInTheDocument();

    await user.click(within(header).getByRole("button", { name: "Change Requester" }));

    expect(
      await screen.findByRole("heading", { name: "Select a Development Requester" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("combobox", { name: "Development Requester" }),
    ).toBeInTheDocument();
  });

  it("clears rendered dashboard state before committing another requester", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester, secondRequester]);
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [{ id: 1, name: "Hardware" }],
    });
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
    await user.click(screen.getByRole("button", { name: "Check System" }));
    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    await screen.findByRole("option", { name: /Michael Brown/i });
    const nextSelect = screen.getByRole("combobox", { name: "Development Requester" });
    await user.selectOptions(nextSelect, "2");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText(/Welcome, Michael Brown/)).toBeInTheDocument();
    expect(screen.queryByText("System Status: Online")).not.toBeInTheDocument();
    expect(screen.queryByText("1. Hardware")).not.toBeInTheDocument();
  });
});
