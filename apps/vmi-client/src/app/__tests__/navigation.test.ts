import { describe, expect, it } from "vitest";
import { getRouteByHref, vmiRoutes } from "@/lib/navigation";

describe("VMI route scaffold", () => {
  it("defines the core V1 portal routes", () => {
    expect(vmiRoutes.map((route) => route.href)).toEqual([
      "/",
      "/vendors",
      "/inventory",
      "/stock-counts",
      "/proposals",
      "/orders",
      "/messages",
      "/settings"
    ]);
  });

  it("resolves route metadata by href", () => {
    expect(getRouteByHref("/stock-counts").title).toBe("Inwentaryzacje VMI");
  });
});
