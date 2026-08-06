import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const seededCategories: api.Category[] = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
  { id: 4, name: "Network" },
];

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  // Issue 4 — mock checkSystem, click the button, assert the Online list.
  it("shows System Status: Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: seededCategories,
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();
    expect(screen.getByText("Supported Request Categories")).toBeInTheDocument();
    for (const category of seededCategories) {
      expect(screen.getByText(`${category.id}. ${category.name}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("System Status: Offline")).not.toBeInTheDocument();
  });

  // Issue 4 — mock checkSystem to reject, assert the Offline message.
  it("shows System Status: Offline when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("API unavailable"));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Offline")).toBeInTheDocument();
    expect(screen.getByText("Unable to connect to TokTickIT API")).toBeInTheDocument();
    expect(screen.queryByText("System Status: Online")).not.toBeInTheDocument();
  });

  // Issue 4 — while the request is pending, the button shows Loading… and is disabled.
  it("shows Loading… and disables the button while a request is in flight", async () => {
    let resolveCheck!: (result: api.SystemStatus) => void;
    const pendingCheck = new Promise<api.SystemStatus>((resolve) => {
      resolveCheck = resolve;
    });
    vi.spyOn(api, "checkSystem").mockReturnValue(pendingCheck);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();

    resolveCheck({ online: true, categories: seededCategories });
    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();
  });

  // Issue 4 — a failed request must not leave stale categories on screen.
  it("clears stale categories when a later request fails", async () => {
    vi.spyOn(api, "checkSystem")
      .mockResolvedValueOnce({ online: true, categories: [{ id: 1, name: "Hardware" }] })
      .mockRejectedValueOnce(new Error("request failed"));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));
    expect(await screen.findByText("1. Hardware")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Offline")).toBeInTheDocument();
    expect(screen.queryByText("1. Hardware")).not.toBeInTheDocument();
  });
});
