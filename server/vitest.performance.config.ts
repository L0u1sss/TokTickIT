import { defineConfig } from "vitest/config";

export default defineConfig({ test: {
  environment: "node",
  include: ["tests/lab-04/dashboard-performance.test.ts"],
  setupFiles: ["./tests/db-setup.ts"],
  fileParallelism: false,
  maxWorkers: 1,
} });
