import { test as setup, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { AUTH_STATE_FILE, E2E_TEST_EMAIL, E2E_TEST_PASSWORD } from "./auth-state";

/**
 * Signs the test account in once per run and saves the session (cookies) for
 * every authenticated spec. Before this, each test signed in on its own: one
 * password login per test and project, hundreds a day against the production
 * Supabase project (login rate limits, inflated request counts).
 */
setup("sign in the test account once", async ({ page }) => {
  mkdirSync(dirname(AUTH_STATE_FILE), { recursive: true });

  if (!E2E_TEST_EMAIL || !E2E_TEST_PASSWORD) {
    // Authenticated specs skip themselves; leave an empty session so the
    // file the fixture points at exists.
    writeFileSync(AUTH_STATE_FILE, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  await page.goto("/logowanie");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_TEST_EMAIL);
  await page.getByRole("textbox", { name: "Hasło" }).fill(E2E_TEST_PASSWORD);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  // An account with several Ambra apps lands on the app chooser; the ERP specs
  // start from the dashboard either way.
  await page.waitForURL(/\/(aplikacje|dashboard\/start)(\?|$)/);
  if (new URL(page.url()).pathname === "/aplikacje") {
    await page.goto("/dashboard/start");
    await page.waitForURL(/\/dashboard\/start/);
  }
  await expect(page.getByTestId("home-dashboard")).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: AUTH_STATE_FILE });
});
