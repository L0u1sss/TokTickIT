import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");

  async function handleCheck() {
    setState("loading");
    setError("");
    setCategories([]);
    try {
      const status = await checkSystem();
      setCategories(status.categories);
      setState("success");
    } catch {
      setError("Unable to connect to TokTickIT API");
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
    </div>
  );
}
