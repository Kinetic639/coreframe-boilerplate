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

  await expect(page.getByRole("heading", { name: "Pulpit VMI" })).toBeVisible();
  await expect(page.getByText("Aktywni dostawcy")).toBeVisible();
});
