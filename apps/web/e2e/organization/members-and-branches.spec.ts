import { test, expect } from "../fixtures";

test.describe("Organization users", () => {
  test("members list shows the signed-in user with org_owner role", async ({ page }) => {
    await page.goto("/dashboard/organizacja/uzytkownicy/czlonkowie");

    await expect(page.getByRole("heading", { name: "Członkowie" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("cell", { name: "org_owner" })).toBeVisible();
  });

  test("roles & permissions tab is reachable from the users section", async ({ page }) => {
    await page.goto("/dashboard/organizacja/uzytkownicy");
    await page.getByRole("link", { name: "Role i uprawnienia" }).click();
    // Generous timeout: in `next dev` an uncompiled route can take a while to
    // build on first hit; `pnpm test:e2e` runs against a production build where
    // this is instant, but the app-behavior assertion is the same either way.
    await expect(page).toHaveURL(/\/uzytkownicy\/role$/, { timeout: 20_000 });
  });
});

test.describe("Organization branches (branch access)", () => {
  test("branches list loads and shows the active branch", async ({ page }) => {
    await page.goto("/dashboard/organizacja/oddzialy");

    await expect(page.getByRole("heading", { name: "Oddziały" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("cell", { name: "MVP komorniki" })).toBeVisible();
  });

  test("the branch switcher in the sidebar lists the active branch", async ({ page }) => {
    await page.goto("/dashboard/start");
    await expect(page.getByRole("button", { name: "MVP komorniki" })).toBeVisible();
  });
});
