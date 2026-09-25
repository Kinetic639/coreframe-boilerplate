import { test as baseTest, expect } from "@playwright/test";

/**
 * E2E test account credentials. Set in .env.local (gitignored) as
 * E2E_TEST_EMAIL / E2E_TEST_PASSWORD. Authenticated specs skip themselves
 * (rather than failing) when these aren't configured, e.g. in CI until
 * secrets are wired up.
 */
export const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL;
export const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    baseTest.skip(
      !E2E_TEST_EMAIL || !E2E_TEST_PASSWORD,
      "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set in .env.local"
    );

    await page.goto("/logowanie");
    await page.getByRole("textbox", { name: "Email" }).fill(E2E_TEST_EMAIL!);
    await page.getByRole("textbox", { name: "Hasło" }).fill(E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await page.waitForURL(/\/dashboard\/start/);
    await expect(page.getByTestId("home-dashboard")).toBeVisible({ timeout: 30_000 });

    // Playwright's fixture continuation is named `use`; it is not a React Hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };
