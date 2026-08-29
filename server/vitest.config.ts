import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: [
            "tests/lab-01/categories.test.ts",
            "tests/lab-02/db-schema.test.ts",
            "tests/lab-02/tickets-create.db.test.ts",
            "tests/lab-02/tickets-list.db.test.ts",
          ],
        },
      },
      {
        test: {
          name: "database",
          environment: "node",
          include: [
            "tests/lab-01/categories.test.ts",
            "tests/lab-02/db-schema.test.ts",
            "tests/lab-02/tickets-create.db.test.ts",
            "tests/lab-02/tickets-list.db.test.ts",
          ],
          setupFiles: ["./tests/db-setup.ts"],
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
    ],
  },
});
