import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/lab-02",
  outputDir: "./test-results/live-e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "line",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_CLIENT_URL ?? "http://127.0.0.1:4174",
    locale: "en-US",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
