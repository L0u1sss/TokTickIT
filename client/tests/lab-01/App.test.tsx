import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";

const seededCategories: api.Category[] = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
  { id: 4, name: "Network" },
];

const requester: api.Requester = {
  id: 1,
  displayName: "Jennifer Anderson",
  email: "jennifer.a@example.com",
};

async function renderDashboard() {
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
  await user.click(screen.getByRole("button", { name: "Continue" }));
  return user;
}

describe("App", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("renders the TokTickIT requester entry screen", () => {
    vi.spyOn(api, "getRequesters").mockReturnValue(new Promise(() => {}));

    render(
      <RequesterProvider>
        <App />
      </RequesterProvider>,
    );

    expect(screen.getByText(/TokTickIT Service Desk/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Select a Development Requester" }),
    ).toBeInTheDocument();
  });

  it("shows System Status: Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: seededCategories,
    });
    const user = await renderDashboard();

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();
    expect(screen.getByText("Supported Request Categories")).toBeInTheDocument();
    for (const category of seededCategories) {
      expect(screen.getByText(`${category.id}. ${category.name}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("System Status: Offline")).not.toBeInTheDocument();
  });

  it("shows System Status: Offline when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("API unavailable"));
    const user = await renderDashboard();

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Offline")).toBeInTheDocument();
    expect(screen.getByText("Unable to connect to TokTickIT API")).toBeInTheDocument();
    expect(screen.queryByText("System Status: Online")).not.toBeInTheDocument();
  });

  it("shows Loading… and disables the button while a request is in flight", async () => {
    let resolveCheck!: (result: api.SystemStatus) => void;
    const pendingCheck = new Promise<api.SystemStatus>((resolve) => {
      resolveCheck = resolve;
    });
    vi.spyOn(api, "checkSystem").mockReturnValue(pendingCheck);
    const user = await renderDashboard();

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();

    resolveCheck({ online: true, categories: seededCategories });
    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();
  });

  it("clears stale categories when a later request fails", async () => {
    vi.spyOn(api, "checkSystem")
      .mockResolvedValueOnce({ online: true, categories: [{ id: 1, name: "Hardware" }] })
      .mockRejectedValueOnce(new Error("request failed"));
    const user = await renderDashboard();

    await user.click(screen.getByRole("button", { name: /check system/i }));
    expect(await screen.findByText("1. Hardware")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Offline")).toBeInTheDocument();
    expect(screen.queryByText("1. Hardware")).not.toBeInTheDocument();
  });
});
