import { expect, test } from "@playwright/test";

test("public supplier API is reachable from the running VMI app", async ({ request }) => {
  const response = await request.get("/api/public/suppliers?verifiedOnly=true&limit=2");
  expect(response.ok()).toBe(true);

  const payload = await response.json();
  expect(payload.success).toBe(true);
  expect(payload.data.suppliers).toHaveLength(2);
});

test("public home page renders the VMI shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Lokalni Dostawcy/ })).toBeVisible();
  await expect(page.getByText("Kategorie B2B")).toBeVisible();
  await expect(page.getByText("Aktywne Gazetki Produktowe B2B")).toBeVisible();
});

test("public supplier directory renders searchable mocked suppliers", async ({ page }) => {
  await page.goto("/vendors?query=Brembo");

  await expect(page.getByText("Mapa i odległość logistyczna")).toBeVisible();
  await expect(page.getByText("Zweryfikowani Dostawcy")).toBeVisible();
  await expect(page.getByRole("heading", { name: "AutoParts Pro" }).first()).toBeVisible();
});

test("public product directory renders mocked products", async ({ page }) => {
  await page.goto("/products?query=Castrol");

  await expect(page.getByRole("heading", { name: "Przeglądaj asortyment dostawców" })).toBeVisible();
  await expect(page.getByText("Olej silnikowy Castrol EDGE 5W-30 LL 5L")).toBeVisible();
});
