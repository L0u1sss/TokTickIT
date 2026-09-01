import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import {
  REQUESTER_STORAGE_KEY,
  RequesterProvider,
  useRequester,
} from "../../src/context/RequesterContext.js";

const jennifer: api.Requester = {
  id: 1,
  displayName: "Jennifer Anderson",
  email: "jennifer.a@example.com",
};

const michael: api.Requester = {
  id: 2,
  displayName: "Michael Brown",
  email: "michael.b@example.com",
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function ContextProbe() {
  const {
    currentRequester,
    requesters,
    loading,
    error,
    fetchRequesters,
    commitRequester,
    changeRequester,
    requestAsCurrentRequester,
  } = useRequester();
  const [operation, setOperation] = useState("idle");

  const requestTickets = async () => {
    setOperation("pending");
    try {
      await requestAsCurrentRequester("/api/tickets", {
        headers: { "x-test-header": "preserved" },
      });
      setOperation("success");
    } catch (requestError) {
      setOperation(requestError instanceof Error ? requestError.name : "error");
    }
  };

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="requesters">
        {requesters.map(({ displayName }) => displayName).join(",")}
      </span>
      <span data-testid="current">{currentRequester?.displayName ?? "none"}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <span data-testid="operation">{operation}</span>
      <button type="button" onClick={() => commitRequester(requesters[0]?.id ?? 0)}>
        Commit first
      </button>
      <button type="button" onClick={() => commitRequester(0)}>
        Commit invalid
      </button>
      <button type="button" onClick={changeRequester}>
        Change requester
      </button>
      <button type="button" onClick={() => void fetchRequesters()}>
        Fetch again
      </button>
      <button type="button" onClick={() => void requestTickets()}>
        Request tickets
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <RequesterProvider>
      <ContextProbe />
    </RequesterProvider>,
  );
}

describe("RequesterContext", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps the selection gate closed when no requester ID is stored", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([jennifer]);

    renderProbe();

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(await screen.findByText("Jennifer Anderson")).toBeInTheDocument();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("current")).toHaveTextContent("none");
  });

  it.each(["0", "-1", "1.5", " 1", "01", "9007199254740992"])(
    "clears malformed stored requester ID %s",
    async (storedId) => {
      window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, storedId);
      vi.spyOn(api, "getRequesters").mockResolvedValue([jennifer]);

      renderProbe();

      await screen.findByText("Jennifer Anderson");
      expect(screen.getByTestId("current")).toHaveTextContent("none");
      expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
    },
  );

  it("clears an unknown stored requester ID after revalidation", async () => {
    window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, "99");
    vi.spyOn(api, "getRequesters").mockResolvedValue([jennifer]);

    renderProbe();

    await screen.findByText("Jennifer Anderson");
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
  });

  it("clears a stored requester that is absent from the active-only response", async () => {
    window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(michael.id));
    vi.spyOn(api, "getRequesters").mockResolvedValue([jennifer]);

    renderProbe();

    await screen.findByText("Jennifer Anderson");
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
  });

  it("restores a valid active requester only after the active list is loaded", async () => {
    const activeRequesters = deferred<api.Requester[]>();
    window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(jennifer.id));
    vi.spyOn(api, "getRequesters").mockReturnValue(activeRequesters.promise);

    renderProbe();

    expect(screen.getByTestId("current")).toHaveTextContent("none");
    activeRequesters.resolve([jennifer]);

    await waitFor(() => {
      expect(screen.getByTestId("current")).toHaveTextContent("Jennifer Anderson");
    });
  });

  it("commits only an active requester and stores only its canonical ID", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([jennifer]);
    const user = userEvent.setup();

    renderProbe();
    await screen.findByText("Jennifer Anderson");

    await user.click(screen.getByRole("button", { name: "Commit invalid" }));
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Commit first" }));
    expect(screen.getByTestId("current")).toHaveTextContent("Jennifer Anderson");
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBe("1");
  });

  it("clears context and storage before refreshing the requester list", async () => {
    const refreshedRequesters = deferred<api.Requester[]>();
    vi.spyOn(api, "getRequesters")
      .mockResolvedValueOnce([jennifer])
      .mockReturnValueOnce(refreshedRequesters.promise);
    const user = userEvent.setup();

    renderProbe();
    await screen.findByText("Jennifer Anderson");
    await user.click(screen.getByRole("button", { name: "Commit first" }));
    await user.click(screen.getByRole("button", { name: "Change requester" }));

    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
    expect(api.getRequesters).toHaveBeenCalledTimes(2);

    refreshedRequesters.resolve([jennifer, michael]);
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
  });

  it("exposes requester-list API errors and stops loading", async () => {
    vi.spyOn(api, "getRequesters").mockRejectedValue(new Error("Service unavailable"));

    renderProbe();

    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("requesters")).toBeEmptyDOMElement();
  });

  it("does not let an older requester-list request overwrite a newer fetch", async () => {
    const firstRequest = deferred<api.Requester[]>();
    vi.spyOn(api, "getRequesters")
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce([michael]);
    const user = userEvent.setup();

    renderProbe();
    await waitFor(() => expect(api.getRequesters).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Fetch again" }));
    expect(await screen.findByText("Michael Brown")).toBeInTheDocument();

    await act(async () => {
      firstRequest.resolve([jennifer]);
      await firstRequest.promise;
    });

    expect(screen.getByTestId("requesters")).toHaveTextContent("Michael Brown");
    expect(screen.getByTestId("requesters")).not.toHaveTextContent("Jennifer Anderson");
  });

  it("clears a committed requester when refresh no longer returns it as active", async () => {
    vi.spyOn(api, "getRequesters")
      .mockResolvedValueOnce([jennifer])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();

    renderProbe();
    await screen.findByText("Jennifer Anderson");
    await user.click(screen.getByRole("button", { name: "Commit first" }));
    await user.click(screen.getByRole("button", { name: "Fetch again" }));

    await waitFor(() => {
      expect(screen.getByTestId("current")).toHaveTextContent("none");
    });
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
  });

  it("adds the requester header while preserving caller headers", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([jennifer]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();

    renderProbe();
    await screen.findByText("Jennifer Anderson");
    await user.click(screen.getByRole("button", { name: "Commit first" }));
    await user.click(screen.getByRole("button", { name: "Request tickets" }));
    await screen.findByText("success");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/api/tickets");
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get(api.REQUESTER_HEADER_NAME)).toBe("1");
    expect(headers.get("x-test-header")).toBe("preserved");
  });

  it("clears invalid requester context without retrying the protected request", async () => {
    vi.spyOn(api, "getRequesters")
      .mockResolvedValueOnce([jennifer])
      .mockResolvedValueOnce([]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: api.INVALID_REQUESTER_CONTEXT_CODE,
            message: "The requester context is invalid",
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    const user = userEvent.setup();

    renderProbe();
    await screen.findByText("Jennifer Anderson");
    await user.click(screen.getByRole("button", { name: "Commit first" }));
    await user.click(screen.getByRole("button", { name: "Request tickets" }));

    await screen.findByText("InvalidRequesterContextError");
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("requesters")).toBeEmptyDOMElement();
      expect(api.getRequesters).toHaveBeenCalledTimes(2);
    });
  });

  it("aborts and disregards an in-flight protected response after requester change", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([jennifer]);
    const protectedResponse = deferred<Response>();
    const protectedRequest = { signal: null as AbortSignal | null };
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      protectedRequest.signal = init?.signal ?? null;
      return protectedResponse.promise;
    });
    const user = userEvent.setup();

    renderProbe();
    await screen.findByText("Jennifer Anderson");
    await user.click(screen.getByRole("button", { name: "Commit first" }));
    await user.click(screen.getByRole("button", { name: "Request tickets" }));
    await waitFor(() => expect(protectedRequest.signal).not.toBeNull());

    await user.click(screen.getByRole("button", { name: "Change requester" }));
    expect(protectedRequest.signal?.aborted).toBe(true);

    protectedResponse.resolve(new Response(null, { status: 200 }));
    await screen.findByText("AbortError");
    expect(screen.getByTestId("current")).toHaveTextContent("none");
  });
});
