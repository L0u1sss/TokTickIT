const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// ---------------------------------------------------------------------------
// Issue 2 — Health check only
// ---------------------------------------------------------------------------
export async function checkHealth(): Promise<{ online: boolean }> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error("Backend health check failed");
  }
  return { online: true };
}

// Issue 2 + Issue 4 — call the backend.
// Fetch `${API_URL}/api/health`; if not ok, throw.
// Then fetch `${API_URL}/api/categories`; if not ok, throw.
// Return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error(`Health check failed with status ${healthRes.status}`);
  }

  const categoriesRes = await fetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) {
    throw new Error(`Categories request failed with status ${categoriesRes.status}`);
  }

  const categories: Category[] = await categoriesRes.json();
  return { online: true, categories };
}

