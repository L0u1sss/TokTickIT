import { loadEnvFile } from "node:process";
import { app } from "./app.js";

try {
  loadEnvFile();
} catch {
  // No .env present — DATABASE_URL must come from the environment.
}

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`TokTickIT API listening on http://localhost:${PORT}`);
});
