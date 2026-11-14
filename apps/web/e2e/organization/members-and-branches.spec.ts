import { test, expect, E2E_TEST_EMAIL, openSidebar } from "../fixtures";

test.describe("Organization users", () => {
  test("members list shows the signed-in user with org_owner role", async ({ page, isMobile }) => {
    await page.goto("/dashboard/organizacja/uzytkownicy/czlonkowie");

    await expect(page.getByRole("heading", { name: "Członkowie" })).toBeVisible();
    // The pagination range ("1–1 z N") proves the list resolved its members.
    await expect(
      page
        .getByText(/^\d+–\d+ z \d+$/)
        .filter({ visible: true })
        .first()
    ).toBeVisible();
    // Phones show members as cards; the roles column is checked on desktop.
    if (isMobile) return;
    const ownRow = page.getByRole("table").getByRole("row").filter({ hasText: E2E_TEST_EMAIL! });
    await expect(ownRow.getByText("org_owner", { exact: true })).toBeVisible();
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
    // Desktop shows the data table; phones show the same rows as cards (both
    // are in the page, one hidden), so look for the visible one.
    const list = isMobile ? page : page.getByRole("table");
    await expect(
      list.getByText(activeBranch, { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
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
