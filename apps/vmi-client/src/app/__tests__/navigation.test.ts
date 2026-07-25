import { describe, expect, it } from "vitest";
import { getRouteByHref, vmiDesktopNavRoutes, vmiMobileNavRoutes, vmiRoutes } from "@/lib/navigation";

describe("VMI route scaffold", () => {
  it("defines the core V1 portal routes", () => {
    expect(vmiRoutes.map((route) => route.href)).toEqual([
      "/portal",
      "/portal/vendors",
      "/inventory",
      "/orders",
      "/proposals",
      "/messages",
      "/settings",
      "/stock-counts"
    ]);
  });

  it("matches the prototype desktop sidebar tabs", () => {
    expect(vmiDesktopNavRoutes.map((route) => route.label)).toEqual([
      "Pulpit",
      "Dostawcy",
      "Zapas magazynowy",
      "Zamówienia",
      "Oferty i zapytania",
      "Wiadomości",
      "Ustawienia i Sandbox"
    ]);
  });

  it("matches the prototype mobile bottom navigation", () => {
    expect(vmiMobileNavRoutes.map((route) => route.mobileLabel)).toEqual([
      "Zapas",
      "Zamówienia",
      "Oferty",
      "Czat",
      "Opcje"
    ]);
  });

  it("resolves route metadata by href", () => {
    expect(getRouteByHref("/stock-counts").title).toBe("Inwentaryzacje VMI");
  });
});
