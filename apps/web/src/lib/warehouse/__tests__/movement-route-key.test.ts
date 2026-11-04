import { describe, expect, it } from "vitest";
import {
  movementRouteKeyPattern,
  normalizeMovementRouteKey,
  toMovementRouteKey,
} from "../movement-route-key";

describe("movement route keys (URLs of documents)", () => {
  it("keeps the brackets and signs of AutoStacja numbers", () => {
    expect(toMovementRouteKey("PZ(315)/1/26/3332")).toBe("PZ(315)-1-26-3332");
    expect(toMovementRouteKey("MMJ-(115)/2/26/3112")).toBe("MMJ-(115)-2-26-3112");
    expect(toMovementRouteKey("MMJ+(315)/2/26/3332")).toBe("MMJ+(315)-2-26-3332");
    expect(toMovementRouteKey("PZ/2026/000006")).toBe("PZ-2026-000006");
  });

  it("reads a '+' that arrived as a space in the query string", () => {
    expect(normalizeMovementRouteKey("MMJ (315)-2-26-3332")).toBe("MMJ+(315)-2-26-3332");
  });

  it("matches the number the key came from (each hyphen one character)", () => {
    const like = (pattern: string, value: string) =>
      new RegExp("^" + pattern.replace(/[()+]/g, (c) => "\\" + c).replace(/_/g, ".") + "$").test(
        value
      );
    expect(like(movementRouteKeyPattern("PZ(315)-1-26-3332"), "PZ(315)/1/26/3332")).toBe(true);
    expect(like(movementRouteKeyPattern("MMJ-(115)-2-26-3112"), "MMJ-(115)/2/26/3112")).toBe(true);
    expect(like(movementRouteKeyPattern("PZ-2026-000006"), "PZ/2026/000006")).toBe(true);
    expect(like(movementRouteKeyPattern("PZ(315)-1-26-3332"), "PZ(315)/11/26/3332")).toBe(false);
  });
});
