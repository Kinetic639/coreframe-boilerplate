import { test, expect, E2E_TEST_EMAIL, openSidebar } from "../fixtures";

test.describe("Organization users", () => {
  test("members list shows the signed-in user with org_owner role", async ({ page, isMobile }) => {
    await page.goto("/dashboard/organizacja/uzytkownicy/czlonkowie");

    await expect(page.getByRole("heading", { name: "Członkowie" })).toBeVisible();
    await expect(page.getByText(/Pokazano \d+.\d+ z \d+ wyników/)).toBeVisible();
    // Phones show members as cards without the role column.
    if (isMobile) return;
    const ownRow = page.getByRole("table").getByRole("row").filter({ hasText: E2E_TEST_EMAIL! });
    await expect(ownRow.getByRole("cell", { name: "org_owner" })).toBeVisible();
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
  test("branches list loads and shows the active branch", async ({ page, isMobile }) => {
    await openSidebar(page, isMobile);
    const activeBranch = (await page.getByTestId("sidebar-branch-switcher").innerText()).trim();
    expect(activeBranch).not.toBe("");

    await page.goto("/dashboard/organizacja/oddzialy");
    await expect(page.getByRole("heading", { name: "Oddziały" })).toBeVisible();
    if (isMobile) {
      await expect(page.getByText(activeBranch, { exact: true })).toBeVisible();
    } else {
      await expect(
        page.getByRole("table").getByRole("cell", { name: activeBranch, exact: true })
      ).toBeVisible();
    }
  });

  test("the branch switcher in the sidebar lists the active branch", async ({ page, isMobile }) => {
    await page.goto("/dashboard/start");
    await openSidebar(page, isMobile);
    const switcher = page.getByTestId("sidebar-branch-switcher");
    await expect(switcher).toBeVisible();
    const activeBranch = (await switcher.innerText()).trim();
    expect(activeBranch).not.toBe("");
    await switcher.click();
    await expect(page.getByRole("menuitem").filter({ hasText: activeBranch })).toBeVisible();
  });
});
