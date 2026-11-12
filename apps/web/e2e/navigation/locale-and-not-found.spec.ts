import { test, expect as baseExpect } from "../fixtures";
const expect = baseExpect.configure({ timeout: 30_000 });
test.describe.configure({ timeout: 120_000 });

async function switchLanguage(
  page: import("@playwright/test").Page,
  search: string,
  language: string
) {
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").fill(search);
  await dialog
    .getByRole("option")
    .filter({ hasText: /Language \(Polish|Język|język/ })
    .first()
    .click();
  await page
    .getByTestId("palette-submenu")
    .getByRole("option", { name: new RegExp(`^${language}`) })
    .click();
}

test("switches EN/PL on the same product view with filters and selection intact", async ({
  page,
}) => {
  await page.goto("/en/dashboard/warehouse/items?wierszy=100");
  const product = page
    .locator(".products-desktop-table tbody th a,.products-mobile-list li a")
    .filter({ visible: true })
    .first();
  await expect(page.locator(".inventory-products-view")).toBeVisible();
  test.skip((await product.count()) === 0, "The test account has no products");
  const selected = new URL((await product.getAttribute("href"))!, page.url()).searchParams.get(
    "selected"
  );
  await product.click();
  await expect(page.locator(".products-panel")).toBeVisible();
  for (const scenario of [
    { search: "language", language: "Polski", path: "/dashboard/magazyn/produkty", locale: "pl" },
    { search: "język", language: "English", path: "/en/dashboard/warehouse/items", locale: "en" },
  ]) {
    await switchLanguage(page, scenario.search, scenario.language);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === scenario.path &&
        url.searchParams.get("selected") === selected &&
        url.searchParams.get("wierszy") === "100"
    );
    await expect(page.locator("html")).toHaveAttribute("lang", scenario.locale);
    await expect(page.locator(".products-panel")).toBeVisible();
  }
});

test("unknown dashboard URLs show localized 404 with a dashboard link", async ({
  page,
  context,
  baseURL,
}) => {
  for (const locale of ["en", "pl"]) {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL! }]);
    const path =
      locale === "en"
        ? "/en/dashboard/this-page-does-not-exist"
        : "/dashboard/this-page-does-not-exist";
    const response = await page.goto(path);
    await expect(
      page.getByText(locale === "en" ? "Page not found" : "Nie znaleziono strony", { exact: true })
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
    const home = locale === "en" ? "/en/dashboard/start" : "/dashboard/start";
    await expect(page.locator(`main a[href="${home}"]`).first()).toBeVisible();
    // Next's streamed not-found boundary can keep HTTP 200 after headers are sent.
    expect([200, 404]).toContain(response!.status());
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(
      0
    );
  }
});
