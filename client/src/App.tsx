import { useEffect, useRef, useState } from "react";
import { checkSystem, Category, Requester } from "./api.js";
import AppHeader from "./components/AppHeader.js";
import RequesterSelection from "./components/RequesterSelection.js";
import { useRequester } from "./context/RequesterContext.js";

// UI states for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const { currentRequester } = useRequester();

  if (!currentRequester) {
    return <RequesterSelection />;
  }

  return <RequesterApplication key={currentRequester.id} requester={currentRequester} />;
}

function RequesterApplication({ requester }: { requester: Requester }) {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleCheck() {
    setState("loading");
    setError("");
    setCategories([]);
    try {
      const status = await checkSystem();
      if (!isMounted.current) return;
      setCategories(status.categories);
      setState("success");
    } catch {
      if (!isMounted.current) return;
      setError("Unable to connect to TokTickIT API");
      setState("error");
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="container dashboard-content" style={{ maxWidth: 640 }}>
        <h1 className="h3 mb-2">Requester Dashboard</h1>
        <p className="text-secondary mb-4">
          Welcome, {requester.displayName}. Check the service connection below.
        </p>

        <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
          {state === "loading" ? "Loading…" : "Check System"}
        </button>

        {state === "success" && (
          <div className="mt-4">
            <p className="text-success fw-semibold mb-2">System Status: Online</p>
            <h2 className="h5 mb-2">Supported Request Categories</h2>
            <ul className="list-group">
              {categories.map((category) => (
                <li key={category.id} className="list-group-item">
                  {category.id}. {category.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {state === "error" && (
          <div className="mt-4">
            <p className="text-danger fw-semibold mb-2">System Status: Offline</p>
            <p className="text-danger mb-0">{error}</p>
          </div>
        )}
      </main>
    </div>
  );
}
