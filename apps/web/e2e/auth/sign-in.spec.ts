import { test, expect } from "@playwright/test";
import { test as authTest, E2E_TEST_EMAIL } from "../fixtures";

test.describe("Sign-in routing", () => {
  // Regression test for a routing bug found 2026-08-07: next-intl's default-locale
  // (pl) rewrite for "/logowanie" -> "/pl/sign-in" was re-entering the app's own
  // middleware (which also matches "/pl/sign-in"), which then "corrected" the
  // explicit "/pl" prefix by redirecting back to "/logowanie" -- an infinite loop
  // that made the Polish sign-in page (the app's default locale) unreachable for
  // every unauthenticated visitor. Fixed in src/proxy.ts by skipping the
  // middleware for "/pl" and "/pl/*" so Next.js's [locale] route renders them
  // directly instead of re-triggering the intl middleware.
  test("the default-locale (pl) sign-in page loads without redirect-looping", async ({ page }) => {
    const response = await page.goto("/logowanie");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Logowanie" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Hasło" })).toBeVisible();
  });

  test("the default-locale (pl) sign-up page loads without redirect-looping", async ({ page }) => {
    // Registration is currently disabled in this environment: "/rejestracja"
    // stays on the same URL and client-side swaps a loading state for a
    // "registration disabled" message -- that's expected app behavior. What this
    // test guards against is the routing bug, i.e. it must reach that resolved
    // state at all instead of looping forever before ever rendering.
    const response = await page.goto("/rejestracja");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Ładowanie...")).toBeHidden({ timeout: 15_000 });
    await expect(page.locator("main")).not.toBeEmpty({ timeout: 15_000 });
  });

  test("the bare root redirects anonymous visitors to sign-in exactly once", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/logowanie");
  });

  test("the English sign-in page loads (control case, always worked)", async ({ page }) => {
    const response = await page.goto("/en/sign-in");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  });
});

authTest.describe("Sign-in flow", () => {
  authTest(
    "a user can sign in with valid credentials and lands on the dashboard",
    async ({ page }) => {
      // The `page` fixture in ../fixtures already performs sign-in and waits
      // for /dashboard/start. This test just asserts the resulting state.
      expect(new URL(page.url()).pathname).toBe("/dashboard/start");
      await expect(page.getByText(E2E_TEST_EMAIL!)).toBeVisible();
    }
  );
});
