import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchWithRequester,
  getRequesters,
  InvalidRequesterContextError,
  Requester,
} from "../api.js";

export const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

export interface RequesterContextValue {
  currentRequester: Requester | null;
  requesters: Requester[];
  loading: boolean;
  error: string | null;
  fetchRequesters: () => Promise<void>;
  commitRequester: (requesterId: number) => boolean;
  changeRequester: () => void;
  requestAsCurrentRequester: (
    input: string | URL,
    init?: RequestInit,
  ) => Promise<Response>;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

interface RequesterProviderProps {
  children: ReactNode;
}

function parseStoredRequesterId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const requesterId = Number(value);
  return Number.isSafeInteger(requesterId) ? requesterId : null;
}

function readStoredRequesterId(): number | null {
  try {
    const value = window.sessionStorage.getItem(REQUESTER_STORAGE_KEY);
    if (value === null) {
      return null;
    }

    const requesterId = parseStoredRequesterId(value);
    if (requesterId === null) {
      window.sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
    }

    return requesterId;
  } catch {
    return null;
  }
}

function storeRequesterId(requesterId: number): boolean {
  try {
    window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requesterId));
    return true;
  } catch {
    return false;
  }
}

function removeStoredRequesterId(): void {
  try {
    window.sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
  } catch {
    // The in-memory context can still be cleared when storage is unavailable.
  }
}

function abortError(): Error {
  const error = new Error("The requester context changed");
  error.name = "AbortError";
  return error;
}

export function RequesterProvider({ children }: RequesterProviderProps) {
  const [initialStoredRequesterId] = useState(readStoredRequesterId);
  const [currentRequester, setCurrentRequester] = useState<Requester | null>(null);
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequesterListRequestId = useRef(0);
  const requesterContextGeneration = useRef(0);
  const protectedRequestControllers = useRef(new Set<AbortController>());
  const currentRequesterRef = useRef<Requester | null>(null);
  const requestersRef = useRef<Requester[]>([]);
  const storedRequesterIdRef = useRef<number | null>(initialStoredRequesterId);

  const invalidateProtectedRequests = useCallback(() => {
    requesterContextGeneration.current += 1;
    protectedRequestControllers.current.forEach((controller) => controller.abort());
    protectedRequestControllers.current.clear();
  }, []);

  const clearRequesterContext = useCallback(() => {
    invalidateProtectedRequests();
    currentRequesterRef.current = null;
    storedRequesterIdRef.current = null;
    removeStoredRequesterId();
    setCurrentRequester(null);
  }, [invalidateProtectedRequests]);

  const fetchRequesters = useCallback(async () => {
    const requestId = ++latestRequesterListRequestId.current;
    setLoading(true);
    setError(null);

    try {
      const activeRequesters = await getRequesters();
      if (requestId !== latestRequesterListRequestId.current) {
        return;
      }

      requestersRef.current = activeRequesters;
      setRequesters(activeRequesters);

      const selectedRequester = currentRequesterRef.current;
      if (selectedRequester) {
        const revalidatedRequester =
          activeRequesters.find(({ id }) => id === selectedRequester.id) ?? null;

        if (revalidatedRequester) {
          currentRequesterRef.current = revalidatedRequester;
          setCurrentRequester(revalidatedRequester);
        } else {
          clearRequesterContext();
        }
        return;
      }

      const storedRequesterId = storedRequesterIdRef.current;
      if (storedRequesterId === null) {
        return;
      }

      const restoredRequester =
        activeRequesters.find(({ id }) => id === storedRequesterId) ?? null;
      if (!restoredRequester) {
        storedRequesterIdRef.current = null;
        removeStoredRequesterId();
        return;
      }

      currentRequesterRef.current = restoredRequester;
      setCurrentRequester(restoredRequester);
    } catch (requestError) {
      if (requestId === latestRequesterListRequestId.current) {
        requestersRef.current = [];
        setRequesters([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load requesters",
        );
      }
    } finally {
      if (requestId === latestRequesterListRequestId.current) {
        setLoading(false);
      }
    }
  }, [clearRequesterContext]);

  useEffect(() => {
    const initialRequestTimer = window.setTimeout(() => {
      void fetchRequesters();
    }, 0);

    return () => {
      window.clearTimeout(initialRequestTimer);
      latestRequesterListRequestId.current += 1;
      invalidateProtectedRequests();
    };
  }, [fetchRequesters, invalidateProtectedRequests]);

  const commitRequester = useCallback(
    (requesterId: number): boolean => {
      if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
        return false;
      }

      const requester =
        requestersRef.current.find(({ id }) => id === requesterId) ?? null;
      if (!requester || !storeRequesterId(requester.id)) {
        return false;
      }

      if (currentRequesterRef.current?.id !== requester.id) {
        invalidateProtectedRequests();
      }
      storedRequesterIdRef.current = requester.id;
      currentRequesterRef.current = requester;
      setCurrentRequester(requester);
      return true;
    },
    [invalidateProtectedRequests],
  );

  const changeRequester = useCallback(() => {
    clearRequesterContext();
    void fetchRequesters();
  }, [clearRequesterContext, fetchRequesters]);

  const requestAsCurrentRequester = useCallback(
    async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
      const selectedRequester = currentRequesterRef.current;
      if (!selectedRequester) {
        throw new Error("A requester must be selected before making this request");
      }

      const generation = requesterContextGeneration.current;
      const controller = new AbortController();
      const callerSignal = init.signal;
      const abortFromCaller = () => controller.abort(callerSignal?.reason);

      if (callerSignal?.aborted) {
        abortFromCaller();
      } else {
        callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
      }

      protectedRequestControllers.current.add(controller);

      try {
        const response = await fetchWithRequester(input, selectedRequester.id, {
          ...init,
          signal: controller.signal,
        });

        if (
          generation !== requesterContextGeneration.current ||
          currentRequesterRef.current?.id !== selectedRequester.id
        ) {
          throw abortError();
        }

        return response;
      } catch (requestError) {
        if (
          requestError instanceof InvalidRequesterContextError &&
          generation === requesterContextGeneration.current &&
          currentRequesterRef.current?.id === selectedRequester.id
        ) {
          clearRequesterContext();
          // Refresh only the active-requester list. The rejected protected
          // request is deliberately not retried under another identity.
          void fetchRequesters();
        }
        throw requestError;
      } finally {
        callerSignal?.removeEventListener("abort", abortFromCaller);
        protectedRequestControllers.current.delete(controller);
      }
    },
    [clearRequesterContext, fetchRequesters],
  );

  const value = useMemo<RequesterContextValue>(
    () => ({
      currentRequester,
      requesters,
      loading,
      error,
      fetchRequesters,
      commitRequester,
      changeRequester,
      requestAsCurrentRequester,
    }),
    [
      currentRequester,
      requesters,
      loading,
      error,
      fetchRequesters,
      commitRequester,
      changeRequester,
      requestAsCurrentRequester,
    ],
  );

  return <RequesterContext.Provider value={value}>{children}</RequesterContext.Provider>;
}

export function useRequester(): RequesterContextValue {
  const context = useContext(RequesterContext);

  if (context === undefined) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }

  return context;
}
