import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";

/**
 * Collapsed sidebar flyouts (dashboard-shell NavL1Flyout): at most one open,
 * they close when the pointer leaves, stay open on the way into a sub-column,
 * close on Escape / scroll / window blur, and lie above the page.
 */
test.skip(({ isMobile }) => isMobile, "flyouts are a desktop (hover) feature");

const triggers = (page: Page) => page.getByTestId("sidebar-flyout-trigger");
const flyouts = (page: Page) => page.getByTestId("sidebar-flyout");

async function collapseSidebar(page: Page) {
  if ((await triggers(page).count()) === 0) {
    await page.keyboard.press("Control+b");
  }
  await expect(triggers(page).first()).toBeVisible();
}

async function center(page: Page, index: number) {
  const box = await triggers(page).nth(index).boundingBox();
  if (!box) throw new Error("no trigger box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A point well inside the page content, away from the sidebar. */
async function pageContentPoint(page: Page) {
  const size = page.viewportSize()!;
  return { x: size.width - 80, y: size.height - 80 };
}

test.beforeEach(async ({ page }) => {
  await collapseSidebar(page);
});

test("opens on hover and closes when the pointer leaves", async ({ page }) => {
  const p = await center(page, 0);
  await page.mouse.move(p.x, p.y);
  await expect(flyouts(page)).toHaveCount(1);

  const out = await pageContentPoint(page);
  await page.mouse.move(out.x, out.y, { steps: 8 });
  await expect(flyouts(page)).toHaveCount(0, { timeout: 1000 });
});

test("never shows two flyouts when the pointer sweeps over the icons", async ({ page }) => {
  const count = await triggers(page).count();
  test.skip(count < 2, "needs two flyout items");
  const first = await center(page, 0);
  const last = await center(page, count - 1);

  let maxOpen = 0;
  for (let pass = 0; pass < 3; pass++) {
    const [from, to] = pass % 2 === 0 ? [first, last] : [last, first];
    for (let step = 0; step <= 12; step++) {
      await page.mouse.move(from.x, from.y + ((to.y - from.y) * step) / 12);
      maxOpen = Math.max(maxOpen, await flyouts(page).count());
    }
  }
  expect(maxOpen).toBeLessThanOrEqual(1);

  const out = await pageContentPoint(page);
  await page.mouse.move(out.x, out.y, { steps: 8 });
  await expect(flyouts(page)).toHaveCount(0, { timeout: 1000 });
});

test("stays open while the pointer moves diagonally into the column", async ({ page }) => {
  const p = await center(page, 0);
  await page.mouse.move(p.x, p.y);
  const flyout = flyouts(page);
  await expect(flyout).toHaveCount(1);

  const lastRow = flyout.getByRole("menuitem").last();
  const box = await lastRow.boundingBox();
  if (!box) throw new Error("no row box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
  await expect(flyouts(page)).toHaveCount(1);
});

test("lies above the page content", async ({ page }) => {
  const p = await center(page, 0);
  await page.mouse.move(p.x, p.y);
  const row = flyouts(page).getByRole("menuitem").first();
  const box = await row.boundingBox();
  if (!box) throw new Error("no row box");
  const onTop = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="sidebar-flyout"]'),
    { x: box.x + box.width - 10, y: box.y + box.height / 2 }
  );
  expect(onTop).toBe(true);
});

test("closes on Escape", async ({ page }) => {
  const p = await center(page, 0);
  await page.mouse.move(p.x, p.y);
  await expect(flyouts(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(flyouts(page)).toHaveCount(0, { timeout: 1000 });
});

test("closes when the window loses focus", async ({ page }) => {
  const p = await center(page, 0);
  await page.mouse.move(p.x, p.y);
  await expect(flyouts(page)).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  // The flyout leaves with an exit animation, which can run slow on a loaded CI runner.
  await expect(flyouts(page)).toHaveCount(0, { timeout: 3000 });
});

test("closes after choosing a page from it", async ({ page }) => {
  const p = await center(page, 0);
  await page.mouse.move(p.x, p.y);
  const link = flyouts(page).locator("a[role=menuitem]").first();
  test.skip((await link.count()) === 0, "first flyout has no direct links");
  await link.click();
  await expect(flyouts(page)).toHaveCount(0, { timeout: 2000 });
});
