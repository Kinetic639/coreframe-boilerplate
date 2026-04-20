/**
 * @vitest-environment node
 * Tests: src/utils/user-helpers.ts
 */
import { describe, it, expect } from "vitest";
import { getUserInitials, getUserDisplayName } from "../user-helpers";

describe("getUserInitials", () => {
  it("returns first + last initials when both provided", () => {
    expect(getUserInitials("Jane", "Doe", "j@x.com")).toBe("JD");
  });

  it("uppercases initials", () => {
    expect(getUserInitials("jane", "doe", "j@x.com")).toBe("JD");
  });

  it("returns first initial only when no last name", () => {
    expect(getUserInitials("Jane", null, "j@x.com")).toBe("J");
  });

  it("returns last initial only when no first name", () => {
    expect(getUserInitials(null, "Doe", "j@x.com")).toBe("D");
  });

  it("falls back to email initial when both names null", () => {
    expect(getUserInitials(null, null, "alice@x.com")).toBe("A");
  });

  it("falls back to email initial when both names empty-like (null)", () => {
    expect(getUserInitials(null, null, "z@x.com")).toBe("Z");
  });
});

describe("getUserDisplayName", () => {
  it("returns full name when both provided", () => {
    expect(getUserDisplayName("Jane", "Doe")).toBe("Jane Doe");
  });

  it("returns first name only when no last name", () => {
    expect(getUserDisplayName("Jane", null)).toBe("Jane");
  });

  it("returns last name only when no first name", () => {
    expect(getUserDisplayName(null, "Doe")).toBe("Doe");
  });

  it("returns 'User' when both null", () => {
    expect(getUserDisplayName(null, null)).toBe("User");
  });
});
