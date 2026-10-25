import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = 4173;
const DEV_PORT = 5173;

/**
 * Sandboxes and CI images sometimes ship Chromium at a path Playwright does not
 * expect; set this to point at it. Leave it unset everywhere else.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "on-first-retry", launchOptions: { executablePath } },
  projects: [
    {
      name: "desktop",
      testIgnore: /dev-warnings/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
    {
      name: "mobile",
      testIgnore: /dev-warnings/,
      use: { ...devices["Pixel 7"], baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
    {
      // React only prints key, nesting and strict-mode warnings in development builds.
      name: "dev-warnings",
      testMatch: /dev-warnings/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEV_PORT}` },
    },
  ],
  webServer: [
    {
      // The production build running in workerd, the same runtime as Cloudflare.
      command: `pnpm db:migrate:local && pnpm build && pnpm preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `pnpm db:migrate:local && pnpm exec vite --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
