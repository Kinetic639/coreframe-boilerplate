import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

const CONSUMERS = [
  { name: "Products", path: "/dashboard/warehouse/items" },
  { name: "Help Desk", path: "/dashboard/help-desk/tickets" },
] as const;

async function expectNoDocumentOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

for (const consumer of CONSUMERS) {
  test(`${consumer.name} adapts its list and detail across the viewport matrix`, async ({
    page,
  }) => {
    test.setTimeout(180_000);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto(consumer.path);

      const root = page.getByTestId("data-view-root");
      await expect(root).toBeVisible({ timeout: 30_000 });
      const mode = await root.getAttribute("data-layout-mode");
      expect(mode).toMatch(/^(wide|medium|narrow)$/);

      const row =
        mode === "narrow"
          ? page.locator('[data-testid^="mobile-card-"] button[data-data-view-row-id]').first()
          : page.locator('[data-testid^="row-"]:not([data-testid^="row-select-"])').first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      await expectNoDocumentOverflow(page);

      const selectedId = await row.getAttribute("data-data-view-row-id");
      expect(selectedId).toBeTruthy();
      await row.click();
      await expect(page.getByTestId("detail-panel")).toBeVisible({ timeout: 30_000 });
      await expectNoDocumentOverflow(page);

      if (mode === "wide") {
        await expect(page.getByTestId("data-view-sidebar")).toBeVisible();
      } else {
        const back = page.locator('[data-testid="back-to-list-button"]:visible');
        await expect(back).toBeFocused();
        const box = await back.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      await page.locator('[data-testid="back-to-list-button"]:visible').click();
      await expect(page).not.toHaveURL(/selected=/);
      await expectNoDocumentOverflow(page);

      if (mode === "narrow") {
        await expect(page.getByTestId("data-view-mobile-list")).toBeVisible();
        await expect(page.getByRole("textbox", { name: /Szukaj|Search/i })).toBeVisible();
      } else {
        await expect(page.getByRole("table")).toBeVisible();
      }

      if (viewport.width === 390) {
        await page.goto(`${consumer.path}?selected=${encodeURIComponent(selectedId!)}`);
        await expect(page.getByTestId("detail-panel")).toBeVisible({ timeout: 30_000 });
        await page.reload();
        await expect(page.getByTestId("detail-panel")).toBeVisible({ timeout: 30_000 });
        await page.locator('[data-testid="back-to-list-button"]:visible').click();
        await expect(page).not.toHaveURL(/selected=/);
        await expect(page.getByTestId("data-view-mobile-list")).toBeFocused();

        const historyRow = page
          .locator('[data-testid^="mobile-card-"] button[data-data-view-row-id]')
          .first();
        await historyRow.click();
        await page.goBack();
        await expect(page).not.toHaveURL(/selected=/);
        await page.goForward();
        await expect(page.getByTestId("detail-panel")).toBeVisible({ timeout: 30_000 });
      }
    }
  });

  test(`${consumer.name} preserves selection, search, and page recovery semantics`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(consumer.path);

    const firstRow = page
      .locator('[data-testid^="row-"]:not([data-testid^="row-select-"])')
      .first();
    await firstRow.click();
    await expect(page.getByTestId("data-view-sidebar")).toBeVisible({ timeout: 30_000 });
    const firstSelected = new URL(page.url()).searchParams.get("selected");

    const sidebarRows = page.locator('[data-testid^="sidebar-item-"]');
    await expect(sidebarRows.nth(2)).toBeVisible({ timeout: 30_000 });
    await sidebarRows.nth(1).click();
    const secondSelected = new URL(page.url()).searchParams.get("selected");
    await sidebarRows.nth(2).click();
    const thirdSelected = new URL(page.url()).searchParams.get("selected");
    expect(new Set([firstSelected, secondSelected, thirdSelected]).size).toBe(3);

    const root = page.getByTestId("data-view-root");
    await root.evaluate((element) => {
      element.style.width = "768px";
      element.style.maxWidth = "768px";
    });
    await expect(root).toHaveAttribute("data-layout-mode", "medium");
    await expect(page.locator('[data-testid="back-to-list-button"]:visible')).toBeFocused();
    await page.locator('[data-testid="back-to-list-button"]:visible').click();
    await expect(page).not.toHaveURL(/selected=/);
    const returnedRow = page.locator(`[data-data-view-row-id="${thirdSelected}"]:visible`).first();
    await expect(returnedRow).toBeFocused();

    await root.evaluate((element) => {
      element.style.removeProperty("width");
      element.style.removeProperty("max-width");
    });
    await expect(root).toHaveAttribute("data-layout-mode", "wide");
    await returnedRow.click();
    await expect(page.getByTestId("data-view-sidebar")).toBeVisible();

    await page.getByTestId("search-icon-button").click();
    await page.getByTestId("search-input").fill("__phase2_no_match__");
    await expect(page).toHaveURL(/selected=/);
    await expect(page.getByText(/poza bieżącymi wynikami|outside current results/i)).toBeVisible({
      timeout: 30_000,
    });
    await expectNoDocumentOverflow(page);

    await page.locator('[data-testid="back-to-list-button"]:visible').click();
    await page.goto(`${consumer.path}?page=999`);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("page"), { timeout: 30_000 })
      .not.toBe("999");
    await expectNoDocumentOverflow(page);
  });
}
