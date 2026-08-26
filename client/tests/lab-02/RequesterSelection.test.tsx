import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import RequesterSelection from "../../src/components/RequesterSelection.js";
import {
  REQUESTER_STORAGE_KEY,
  RequesterProvider,
} from "../../src/context/RequesterContext.js";

const activeRequesters: api.Requester[] = [
  {
    id: 1,
    displayName: "Jennifer Anderson",
    email: "jennifer.a@example.com",
  },
  {
    id: 2,
    displayName: "Michael Brown",
    email: "michael.b@example.com",
  },
];

function renderSelection() {
  return render(
    <RequesterProvider>
      <RequesterSelection />
    </RequesterProvider>,
  );
}

describe("RequesterSelection", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("announces loading and disables the dropdown and Continue", () => {
    vi.spyOn(api, "getRequesters").mockReturnValue(new Promise(() => {}));

    renderSelection();

    expect(screen.getByRole("status")).toHaveTextContent("Loading requesters…");
    expect(
      screen.getByRole("combobox", { name: "Development Requester" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("shows a labelled dropdown and does not commit selection before Continue", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue(activeRequesters);
    const user = userEvent.setup();

    renderSelection();

    await screen.findByRole("option", { name: /Jennifer Anderson/i });
    const select = screen.getByRole("combobox", { name: "Development Requester" });
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(screen.getByRole("option", { name: /Jennifer Anderson.*jennifer\.a@example\.com/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Michael Brown.*michael\.b@example\.com/i })).toBeInTheDocument();
    expect(screen.getByText(/not secure authentication/i)).toBeInTheDocument();
    expect(continueButton).toBeDisabled();

    await user.selectOptions(select, "1");

    expect(continueButton).toBeEnabled();
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();

    await user.click(continueButton);

    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBe("1");
  });

  it("shows the empty state and lets the user refresh", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([]);
    const user = userEvent.setup();

    renderSelection();

    expect(await screen.findByText("No active requesters are available.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(api.getRequesters).toHaveBeenCalledTimes(2);
  });

  it("shows safe error copy, focuses Retry, and reloads the requester list", async () => {
    vi.spyOn(api, "getRequesters")
      .mockRejectedValueOnce(new Error("Unable to load requesters (status 503)"))
      .mockResolvedValueOnce(activeRequesters);
    const user = userEvent.setup();

    renderSelection();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load requesters.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("503");
    const retryButton = screen.getByRole("button", { name: "Retry" });
    await waitFor(() => expect(retryButton).toHaveFocus());
    await user.click(retryButton);

    expect(
      await screen.findByRole("combobox", { name: "Development Requester" }),
    ).toBeInTheDocument();
    expect(api.getRequesters).toHaveBeenCalledTimes(2);
  });
});
