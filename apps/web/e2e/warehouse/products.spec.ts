import { test, expect } from "../fixtures";

test.describe("Warehouse products", () => {
  test("products catalog loads with data for the active org/branch", async ({ page, isMobile }) => {
    await page.goto("/dashboard/magazyn/produkty");

    await expect(page.getByRole("heading", { name: "Produkty" })).toBeVisible();
    // Desktop shows the data table; phones show the same rows as cards.
    if (!isMobile) await expect(page.getByRole("table")).toBeVisible();
    // The pagination range ("1–50 z N") proves the list actually resolved
    // data for this org/branch, not just an empty shell.
    await expect(
      page
        .getByText(/^\d+–\d+ z \d+$/)
        .filter({ visible: true })
        .first()
    ).toBeVisible();
  });

  test("create-product link is reachable for a permitted user", async ({ page }) => {
    await page.goto("/dashboard/magazyn/produkty");
    await expect(page.getByRole("link", { name: "Utwórz" })).toBeVisible();
  });
});
