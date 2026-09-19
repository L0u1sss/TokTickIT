// Read-only session actor replaces the temporary context selection API.
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { mockRequesterSession } from "../auth-fixture.js";
import { useRequester } from "../../src/context/RequesterContext.js";
import { fetchAuthenticated } from "../../src/api.js";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("sends only cookies even when the caller supplies a forged identity header", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
  await fetchAuthenticated("/api/tickets", { headers: { "x-requester-id": "999" } });
  const init = fetchMock.mock.calls[0][1];
  expect(init.credentials).toBe("include");
  expect(init.cache).toBe("no-store");
  expect(init.headers.has("x-requester-id")).toBe(false);
});
it("uses session identity without exposing a selector mutator", () => {
  mockRequesterSession({ id: 12, displayName: "Owner", email: "owner@example.test" });
  const { result } = renderHook(useRequester);
  expect(result.current.currentRequester?.id).toBe(12);
  expect(result.current).not.toHaveProperty("commitRequester");
  expect(result.current).not.toHaveProperty("changeRequester");
});
it("aborts pending requests and rejects late responses after unmount", async () => {
  mockRequesterSession({ id: 12, displayName: "Owner", email: "owner@example.test" });
  let finish!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; })));
  const { result, unmount } = renderHook(useRequester);
  let pending!: Promise<Response>;
  act(() => { pending = result.current.requestAsCurrentRequester("/api/tickets"); });
  const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  unmount(); finish(new Response("{}")); await assertion;
});
