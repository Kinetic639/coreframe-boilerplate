import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "vmi_demo_session",
      value: "client-demo",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

test("mobile portal bottom navigation matches prototype tabs", async ({ page }) => {
  await page.goto("/portal");

  const bottomNav = page.locator("nav").last();
  await expect(bottomNav.getByText("Zapas")).toBeVisible();
  await expect(bottomNav.getByText("Zamówienia")).toBeVisible();
  await expect(bottomNav.getByText("Oferty")).toBeVisible();
  await expect(bottomNav.getByText("Czat")).toBeVisible();
  await expect(bottomNav.getByText("Opcje")).toBeVisible();
  await expect(bottomNav.getByText("Spis")).toHaveCount(0);
});

test("mobile portal pages render without horizontal overflow", async ({ page }) => {
  for (const route of ["/inventory", "/orders", "/proposals", "/messages", "/settings"] as const) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });

    expect(hasHorizontalOverflow, `${route} should not overflow horizontally`).toBe(false);
  }
});

test("stock count workflow remains reachable as an action route", async ({ page }) => {
  await page.goto("/stock-counts");

  await expect(page.getByRole("heading", { name: "Wybierz dostawcę asortymentu" })).toBeVisible();
  await expect(page.getByText("ONLINE")).toBeVisible();
});

test("partner panel supports catalog ordering on mobile", async ({ page }) => {
  await page.goto("/portal/vendors/autoparts/overview");
  await expect(page.getByText("Panel partnera VMI")).toBeVisible();

  await page.getByRole("button", { name: /Szczegóły/i }).first().click();
  await expect(page.getByText("Tablica Ogłoszeń")).toBeVisible();
  await page.getByRole("button", { name: /Zamknij tablicę/i }).click();

  await page.getByRole("button", { name: /Katalog towarów/i }).click();
  await expect(page).toHaveURL(/\/portal\/vendors\/autoparts\/catalog$/);
  await expect(page.getByPlaceholder("Wyszukaj produkt po nazwie lub SKU...")).toBeVisible();

  await page.getByRole("button", { name: "Kup" }).first().click();
  await page.getByRole("button", { name: "Potwierdź" }).click();
  await expect(page.getByText("Zatwierdzono")).toBeVisible();
  await page.getByRole("button", { name: /Koszyk/i }).click();
  await expect(page).toHaveURL(/\/portal\/vendors\/autoparts\/cart$/);

  await expect(page.getByText("Podsumowanie zamówienia B2B")).toBeVisible();
  await expect(page.getByText("Pozycje w koszyku (1)")).toBeVisible();
  await page.getByRole("button", { name: "Prześlij zamówienie B2B do VMI" }).click();
  await expect(page.getByText(/Zamówienie .* zostało przesłane/)).toBeVisible();
});
