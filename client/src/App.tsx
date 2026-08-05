import { useState } from "react";
import { checkHealth, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  void categories;
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCheck() {
    setState("loading");
    try {
      await checkHealth();
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="alert alert-success mt-3" role="alert">
          <strong>System Status: Online</strong>
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-3" role="alert">
          <strong>System Status: Offline</strong> — {errorMsg}
        </div>
      )}

      {/* TODO(Issue 4): render loading / success (Online + categories) / error (Offline) states. */}
    </div>
  );
}
