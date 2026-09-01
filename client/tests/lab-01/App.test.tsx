import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import { checkHealth, checkSystem, Category } from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";

const seededCategories: Category[] = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
  { id: 4, name: "Network" },
];

describe("Lab 1 client regression", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("still starts from the TokTickIT requester entry screen", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
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

  it("keeps the Lab 1 health helper working", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    );
    await expect(checkHealth()).resolves.toEqual({ online: true });
  });

  it("keeps the Lab 1 health failure behavior", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    await expect(checkHealth()).rejects.toThrow("Backend health check failed");
  });

  it("keeps the Lab 1 category integration helper working", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(seededCategories), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    await expect(checkSystem()).resolves.toEqual({
      online: true,
      categories: seededCategories,
    });
  });

  it("keeps the Lab 1 category failure behavior", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(checkSystem()).rejects.toThrow(
      "Categories request failed with status 500",
    );
  });
});
