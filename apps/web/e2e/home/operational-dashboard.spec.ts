import { test, expect } from "../fixtures";
import { COLOR_THEMES } from "../../src/lib/constants/color-themes";

// Read-only domain checks. The branch test restores the user's original preference.
test.describe("operational home", () => {
  test.setTimeout(180_000);

  test("real context, responsive layout, keyboard access and refresh", async ({
    page,
  }, testInfo) => {
    const fatal: string[] = [];
    page.on("pageerror", (error) => fatal.push(error.message));
    const home = page.getByTestId("home-dashboard");
    await expect(
      home.getByRole("heading", { level: 1, name: "Pulpit", includeHidden: true })
    ).toBeAttached();
    await expect(page.getByTestId("home-branch")).not.toHaveText("");
    await expect(home.getByRole("heading", { name: "Twoja ostatnia aktywność" })).toBeVisible();
    const planning = home.getByRole("region", { name: "Organizacja pracy" });
    await expect(planning).toBeVisible();
    await expect(planning.getByRole("heading", { name: "Dzisiaj" })).toBeVisible();
    await expect(planning.getByRole("heading", { name: "Zadania" })).toBeVisible();
    await expect(planning.getByRole("heading", { name: "Kanban" })).toBeVisible();
    await expect(home.getByRole("status")).toHaveCount(0);
    for (const [width, height] of [
      [320, 800],
      [360, 800],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1024, 768],
      [1280, 800],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(home.getByRole("heading", { level: 1, includeHidden: true })).toBeAttached();
      const overflow = await home.evaluate(
        (el) =>
          el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > innerWidth + 1
      );
      expect(overflow, `home overflow at ${width}`).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`home-${width}-light.png`),
        fullPage: true,
      });
    }
    const refresh = home.getByRole("button", { name: /^Odśwież/ });
    await refresh.focus();
    await expect(refresh).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(home.getByRole("link").first()).toBeFocused();
    await refresh.click();
    await expect(refresh).toBeEnabled();
    expect(fatal).toEqual([]);
  });

  test("planning summary links resolve to canonical Planning surfaces", async ({ page }) => {
    const planning = page.getByRole("region", { name: "Organizacja pracy" });
    await expect(planning).toBeVisible({ timeout: 30_000 });
    const destinations = [
      ["Otwórz kalendarz", /\/dashboard\/planowanie$/],
      ["Otwórz zadania", /\/dashboard\/planowanie\/zadania$/],
      ["Otwórz tablicę", /\/dashboard\/planowanie\/tablice/],
    ] as const;
    for (const [name, destination] of destinations) {
      await planning.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(destination, { timeout: 30_000 });
      await page.goBack({ waitUntil: "commit" });
      await expect(page.getByRole("region", { name: "Organizacja pracy" })).toBeVisible({
        timeout: 30_000,
      });
    }
  });

  test("all selectable skins in light and dark retain tokens and fit the page", async ({
    page,
  }, testInfo) => {
    const home = page.getByTestId("home-dashboard");
    await expect(home.getByRole("heading", { level: 1, includeHidden: true })).toBeAttached();
    await expect(home.getByRole("status")).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const mode of ["light", "dark"]) {
      for (const theme of COLOR_THEMES) {
        // The appearance UI applies these same root selectors. No data is mocked.
        await page.evaluate(
          ({ mode, skin }) => {
            document.documentElement.classList.remove("light", "dark");
            document.documentElement.classList.add(mode);
            document.documentElement.setAttribute("data-theme", skin);
          },
          { mode, skin: theme.name }
        );
        const result = await home.evaluate((el) => {
          const css = getComputedStyle(el);
          return {
            foreground: css.getPropertyValue("--foreground"),
            background: css.getPropertyValue("--background"),
            card: css.getPropertyValue("--card"),
            ring: css.getPropertyValue("--ring"),
            overflow: el.scrollWidth > el.clientWidth + 1,
          };
        });
        expect(result.foreground.trim(), `${theme.name}/${mode}`).not.toBe("");
        expect(result.foreground).not.toBe(result.background);
        expect(result.card.trim()).not.toBe("");
        expect(result.ring.trim()).not.toBe("");
        expect(result.overflow).toBe(false);
        if (["default", "graphite", "amethyst-haze"].includes(theme.name)) {
          await page.screenshot({
            path: testInfo.outputPath(`home-${theme.name}-${mode}.png`),
            fullPage: true,
          });
        }
      }
    }
  });

  test("quick actions resolve to real routes and accessible destinations open", async ({
    page,
  }) => {
    const home = page.getByTestId("home-dashboard");
    await expect(home.getByRole("heading", { level: 1, includeHidden: true })).toBeAttached();
    const actions = home.getByRole("region", { name: "Przejdź do pracy" }).getByRole("link");
    const hrefs = await actions.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href")!)
    );
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs).toEqual([
      "/dashboard/narzedzia",
      "/dashboard/magazyn/lokalizacje",
      "/dashboard/help-desk/zgloszenia",
      "/dashboard/planowanie/zadania",
    ]);
    // This account's selected branch returns location and planning routes to start
    // when their required module context is unavailable. Exercise destinations it can open.
    for (const href of hrefs.filter(
      (href) => href.includes("/narzedzia") || href.includes("/help-desk/")
    )) {
      const link = page.getByTestId("home-dashboard").locator(`a[href="${href}"]`);
      await link.focus();
      await expect(link).toBeFocused();
      await link.click();
      await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), {
        timeout: 30_000,
      });
      await expect(page.getByText("404", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
      await page.goBack({ waitUntil: "commit" });
      await expect(page.getByTestId("home-dashboard")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("home-dashboard").getByRole("status")).toHaveCount(0, {
        timeout: 30_000,
      });
    }
    const queue = page.getByRole("link", { name: "Otwórz kolejkę", exact: true });
    if (await queue.count()) {
      const filters = JSON.parse(
        new URL((await queue.getAttribute("href")) as string, page.url()).searchParams.get(
          "filters"
        )!
      );
      expect(filters.branchId).toBeTruthy();
      await queue.click();
      await expect(page).toHaveURL(/filters=/);
      expect(JSON.parse(new URL(page.url()).searchParams.get("filters")!)).toEqual(filters);
    }
  });

  test("global quick-add menu is labeled and usable on desktop and mobile", async ({ page }) => {
    await expect(page.getByTestId("home-dashboard")).toBeVisible({ timeout: 30_000 });
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 320, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      const trigger = page.getByRole("button", { name: "Szybkie dodawanie", exact: true });
      await expect(trigger).toBeVisible({ timeout: 30_000 });
      const box = await trigger.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(32);
      expect(box?.height).toBeGreaterThanOrEqual(32);
      await trigger.click();
      await expect(page.getByText("Zgłoszenie", { exact: true })).toBeVisible();
      await expect(page.getByText("Zadanie", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });

  test("branch switching refreshes dashboard scope and restores the original branch", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const dashboardBranch = page.getByTestId("home-branch");
    const original = (await dashboardBranch.textContent())?.trim();
    expect(original).toBeTruthy();

    await page.getByRole("button", { name: original!, exact: true }).click();
    const options = page.getByRole("menuitem");
    const labels = (await options.allTextContents()).map((label) => label.trim());
    const alternative = labels.find((label) => label && label !== original);
    if (!alternative) {
      await page.keyboard.press("Escape");
      return;
    }

    await options.filter({ hasText: alternative }).click();
    try {
      await expect(dashboardBranch).toHaveText(alternative, { timeout: 30_000 });
      await expect(page.getByTestId("home-dashboard")).toHaveAttribute("aria-busy", "false");
    } finally {
      await page.getByRole("button", { name: alternative, exact: true }).click();
      await page.getByRole("menuitem").filter({ hasText: original! }).click();
      await expect(dashboardBranch).toHaveText(original!, { timeout: 30_000 });
    }
  });
});
