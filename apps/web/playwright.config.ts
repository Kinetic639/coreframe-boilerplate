import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3001);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Match the app's default locale (pl) so unauthenticated navigation exercises
    // the same locale-negotiation path a real majority-Polish visitor hits, rather
    // than Playwright's default en-US Accept-Language silently redirecting every
    // test onto the English pages.
    locale: "pl-PL"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
