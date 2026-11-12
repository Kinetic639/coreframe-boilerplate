import { describe, it, expect, vi } from "vitest";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));
import DashboardCatchAll from "../[...slug]/page";
describe("unknown dashboard routes", () => {
  it("uses the 404 boundary instead of redirecting to tools", () => {
    expect(() => DashboardCatchAll()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
