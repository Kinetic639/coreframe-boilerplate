import { test, expect } from "../fixtures";

test.describe("Warehouse products", () => {
  test("products catalog loads with data for the active org/branch", async ({ page }) => {
    await page.goto("/dashboard/magazyn/produkty");

    await expect(page.getByRole("heading", { name: "Produkty" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    // Pagination summary ("Pokazano 1-50 z N wyników") proves the list actually
    // resolved data for this org/branch, not just an empty shell.
    await expect(page.getByText(/Pokazano \d+.\d+ z \d+ wyników/)).toBeVisible();
  });

  test("create-product link is reachable for a permitted user", async ({ page }) => {
    await page.goto("/dashboard/magazyn/produkty");
    await expect(page.getByRole("link", { name: "Utwórz" })).toBeVisible();
  });
});
