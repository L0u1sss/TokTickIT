import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CommunicationSection, ResolutionIndication } from "../../src/components/TicketCommunication.js";
const entry = { id: 1, content: "<img src=x onerror=alert(1)>", createdAt: "2026-09-19T00:00:00Z", author: { displayName: "Mali", role: "IT_STAFF" } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("renders malicious content as text and clearly labels internal visibility", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ items: [entry] })));
  render(<CommunicationSection ticketId={1} staff internal />);
  expect(await screen.findByText(entry.content)).toBeInTheDocument(); expect(document.querySelector("img")).toBeNull();
  expect(screen.getByText(/Private — visible only/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /delete|edit/i })).toBeNull();
});
it("keeps failed drafts, retries with CSRF, and accepts 2000 astral characters", async () => {
  let fail = true;
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST" ? response(entry, fail ? 500 : 201) : response({ items: [] }));
  vi.stubGlobal("fetch", fetch); document.cookie = `toktickit_csrf=${"a".repeat(43)}`;
  render(<CommunicationSection ticketId={1} staff />); await screen.findByText("No entries yet.");
  fireEvent.change(screen.getByLabelText("Public Comment"), { target: { value: "😀".repeat(2000) } });
  await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
  await screen.findByText(/Your draft has been kept/); expect(screen.getByLabelText("Public Comment")).toHaveValue("😀".repeat(2000));
  fail = false; await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
  await screen.findByText("Public Comment posted."); expect(screen.getByLabelText("Public Comment")).toHaveValue("");
  expect(new Headers(fetch.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.headers).get("X-CSRF-Token")).toBe("a".repeat(43));
});
it("rejects whitespace/oversized drafts without sending", async () => {
  const fetch = vi.fn(async () => response({ items: [] })); vi.stubGlobal("fetch", fetch);
  render(<CommunicationSection ticketId={1} />); await screen.findByText("No entries yet.");
  for (const value of ["  ", "😀".repeat(2001)]) {
    fireEvent.change(screen.getByLabelText("Public Comment"), { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter 1–2,000");
  }
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(["Resolved", "Closed", "Cancelled"])("hides resolution action for %s", status => {
  render(<ResolutionIndication ticketId={1} status={status} />); expect(screen.queryByRole("button")).toBeNull();
});
it("requires confirmation and reports indication without claiming status changed", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false), fetch = vi.fn(async () => response({ problemAppearsResolvedAt: entry.createdAt })); vi.stubGlobal("fetch", fetch);
  render(<ResolutionIndication ticketId={1} status="New" />);
  await userEvent.click(screen.getByRole("button")); expect(fetch).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); await userEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Reported at"));
  expect(screen.getByText(/status stays unchanged/)).toBeInTheDocument(); expect(screen.queryByRole("button")).toBeNull();
});
