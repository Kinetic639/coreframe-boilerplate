import { test as baseTest, expect, type Page } from "@playwright/test";
import { AUTH_STATE_FILE, E2E_TEST_EMAIL, E2E_TEST_PASSWORD } from "./auth-state";

export { E2E_TEST_EMAIL, E2E_TEST_PASSWORD };

/**
 * Signed-in page. The session comes from auth.setup.ts (one sign-in per run),
 * so a test starts on the dashboard without signing in again.
 */
export const test = baseTest.extend({
  storageState: AUTH_STATE_FILE,
  page: async ({ page }, use) => {
    baseTest.skip(
      !E2E_TEST_EMAIL || !E2E_TEST_PASSWORD,
      "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set in .env.local"
    );

    await page.goto("/dashboard/start");
    await page.waitForURL(/\/dashboard\/start/);
    await expect(page.getByTestId("home-dashboard")).toBeVisible({ timeout: 30_000 });

    // Playwright's fixture continuation is named `use`; it is not a React Hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

/**
 * On a phone the sidebar lives in a closed sheet. Open it so its contents
 * (branch switcher, user menu) can be asserted on every project.
 */
export async function openSidebar(page: Page, isMobile: boolean | undefined) {
  if (!isMobile) return;
  await page
    .getByRole("button", { name: "Toggle Sidebar" })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

export { expect };
