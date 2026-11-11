/** @vitest-environment node */
import { describe, it, expect, vi } from "vitest";
const getPathnameMock = vi.hoisted(() => vi.fn());
vi.mock("../navigation", () => ({ getPathname: getPathnameMock }));
import { getLocaleSwitchHref, getLocaleCookie } from "../locale-switch";
describe("canonical locale switching", () => {
  it("uses Polish slugs without the default locale prefix and preserves record state", () => {
    getPathnameMock.mockReturnValue("/dashboard/magazyn/produkty");
    expect(
      getLocaleSwitchHref({
        pathname: "/dashboard/warehouse/items",
        params: { locale: "en" },
        locale: "pl",
        query: "selected=product-id&q=100%25&status=active%2Carchived",
        hash: "#stock",
      })
    ).toBe(
      "/dashboard/magazyn/produkty?selected=product-id&q=100%25&status=active%2Carchived#stock"
    );
    expect(getPathnameMock).toHaveBeenLastCalledWith({
      locale: "pl",
      href: { pathname: "/dashboard/warehouse/items", params: { locale: "en" } },
    });
  });
  it("prefixes English and translates the same route back", () => {
    getPathnameMock.mockReturnValue("/en/dashboard/warehouse/items");
    expect(
      getLocaleSwitchHref({
        pathname: "/dashboard/warehouse/items",
        params: { locale: "pl" },
        locale: "en",
      })
    ).toBe("/en/dashboard/warehouse/items");
  });
  it("keeps dynamic product parameters when changing locale", () => {
    getPathnameMock.mockReturnValue("/dashboard/magazyn/produkty/example-id/edytuj");
    expect(
      getLocaleSwitchHref({
        pathname: "/dashboard/warehouse/items/[productId]/edit",
        params: { locale: "en", productId: "example-id" },
        locale: "pl",
      })
    ).toBe("/dashboard/magazyn/produkty/example-id/edytuj");
  });
  it("keeps the current account tab instead of moving to another page", () => {
    getPathnameMock.mockReturnValue("/dashboard/konto");
    expect(
      getLocaleSwitchHref({
        pathname: "/dashboard/account",
        params: { locale: "en" },
        locale: "pl",
        query: "tab=preferences",
      })
    ).toContain("?tab=preferences");
  });
  it("sets the locale cookie at the root before navigation", () => {
    expect(getLocaleCookie("pl", {})).toBe("NEXT_LOCALE=pl; Path=/; SameSite=lax");
  });
  it("honors the configured shared domain and persistence options", () => {
    expect(
      getLocaleCookie("en", {
        domain: ".ambra-system.com",
        sameSite: "lax",
        secure: true,
        maxAge: 60,
      })
    ).toBe("NEXT_LOCALE=en; Path=/; SameSite=lax; Domain=.ambra-system.com; Secure; Max-Age=60");
  });
});
