import { test, expect } from "./fixtures";
import type { Page, Request } from "@playwright/test";

const CONSUMERS = [
  { name: "Products", path: "/dashboard/warehouse/items" },
  { name: "Help Desk", path: "/dashboard/help-desk/tickets" },
] as const;

function isDataRequest(request: Request) {
  return request.method() === "POST" && Boolean(request.headers()["next-action"]);
}

async function desktopRow(page: Page) {
  return page.locator('[data-testid^="row-"]:not([data-testid^="row-select-"])').first();
}

for (const consumer of CONSUMERS) {
  test(`${consumer.name} meets DataView runtime and request budgets`, async ({ page, context }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${consumer.path}?pageSize=10`);
    await page.waitForLoadState("networkidle");

    const firstRow = await desktopRow(page);
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await firstRow.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("detail-panel")).toBeVisible({ timeout: 30_000 });

    let delayedFirstDetail = true;
    await page.route("**/*", async (route) => {
      if (delayedFirstDetail && isDataRequest(route.request())) {
        delayedFirstDetail = false;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      await route.continue().catch(() => {
        // TanStack may cancel the delayed obsolete request before routing resumes.
      });
    });
    const sidebar = page.locator('[data-testid^="sidebar-item-"]');
    await expect(sidebar.nth(2)).toBeVisible({ timeout: 30_000 });
    await sidebar.nth(0).click();
    await sidebar.nth(1).click();
    await sidebar.nth(2).click();
    const finalId = await sidebar.nth(2).getAttribute("data-data-view-row-id");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("selected"), { timeout: 30_000 })
      .toBe(finalId);
    await expect(sidebar.nth(2)).toHaveAttribute("aria-current", "true");
    await page.unroute("**/*");

    await page.locator('[data-testid="back-to-list-button"]:visible').click();
    await expect(page).not.toHaveURL(/selected=/);

    for (let cycle = 0; cycle < 2; cycle++) {
      await (await desktopRow(page)).click();
      await expect(page.getByTestId("detail-panel")).toBeVisible({ timeout: 30_000 });
      await page.locator('[data-testid="back-to-list-button"]:visible').click();
      await expect(page).not.toHaveURL(/selected=/);
    }

    const pageRequests: Request[] = [];
    const recordPageRequest = (request: Request) => {
      if (isDataRequest(request)) pageRequests.push(request);
    };
    page.on("request", recordPageRequest);
    await page.getByRole("button", { name: /next page|następna strona/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("2");
    await expect(page.getByTestId("data-view-table-scroll")).toHaveAttribute("aria-busy", "false", {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /next page|następna strona/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("3");
    await page.waitForLoadState("networkidle");
    expect(pageRequests.length).toBe(2);
    page.off("request", recordPageRequest);

    await page.goto(consumer.path);
    await page.waitForLoadState("networkidle");
    const searchRequests: Request[] = [];
    const recordSearchRequest = (request: Request) => {
      if (isDataRequest(request)) searchRequests.push(request);
    };
    page.on("request", recordSearchRequest);
    await page.getByTestId("search-icon-button").click();
    await page.getByTestId("search-input").pressSequentially("abc", { delay: 50 });
    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe("abc");
    await page.waitForLoadState("networkidle");
    expect(searchRequests.length).toBe(1);
    page.off("request", recordSearchRequest);

    await page.goto(consumer.path);
    await page.waitForLoadState("networkidle");
    const resizeRequests: Request[] = [];
    const recordResizeRequest = (request: Request) => {
      if (isDataRequest(request)) resizeRequests.push(request);
    };
    page.on("request", recordResizeRequest);
    const root = page.getByTestId("data-view-root");
    for (const width of [700, 400, 1000]) {
      await root.evaluate((element, nextWidth) => {
        element.style.width = `${nextWidth}px`;
        element.style.maxWidth = `${nextWidth}px`;
      }, width);
      await expect(root).toHaveAttribute(
        "data-layout-mode",
        width >= 840 ? "wide" : width >= 560 ? "medium" : "narrow"
      );
    }
    expect(resizeRequests).toHaveLength(0);
    page.off("request", recordResizeRequest);

    await root.evaluate((element) => {
      element.style.removeProperty("width");
      element.style.removeProperty("max-width");
    });
    await expect(root).toHaveAttribute("data-layout-mode", "wide");
    const refreshRequests: Request[] = [];
    const recordRefreshRequest = (request: Request) => {
      if (isDataRequest(request)) refreshRequests.push(request);
    };
    page.on("request", recordRefreshRequest);
    await page.getByTestId("refresh-button").click();
    await page.waitForLoadState("networkidle");
    expect(refreshRequests.length).toBe(1);
    page.off("request", recordRefreshRequest);

    await context.setOffline(true);
    await page.getByTestId("search-icon-button").click();
    await page.getByTestId("search-input").fill("temporary-network-failure");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 });
    await context.setOffline(false);
    await page.getByTestId("search-input").fill("recovered-search");
    await expect(page.getByTestId("data-view-table-scroll")).toHaveAttribute("aria-busy", "false", {
      timeout: 30_000,
    });

    expect(
      consoleErrors.filter((message) => !/Failed to fetch|NetworkError/i.test(message))
    ).toEqual([]);
  });
}
