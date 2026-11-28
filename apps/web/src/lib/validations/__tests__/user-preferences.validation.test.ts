import { describe, expect, it } from "vitest";
import {
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  PROFILE_FIRST_NAME_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  updateProfileSchema,
} from "../user-preferences";

describe("updateProfileSchema name limits", () => {
  it("accepts names at the limits", () => {
    const result = updateProfileSchema.safeParse({
      firstName: "a".repeat(PROFILE_FIRST_NAME_MAX_LENGTH),
      lastName: "b".repeat(PROFILE_NAME_MAX_LENGTH),
      displayName: "c".repeat(PROFILE_DISPLAY_NAME_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["firstName", PROFILE_FIRST_NAME_MAX_LENGTH],
    ["lastName", PROFILE_NAME_MAX_LENGTH],
    ["displayName", PROFILE_DISPLAY_NAME_MAX_LENGTH],
  ])("rejects a %s one character over the limit", (field, max) => {
    const result = updateProfileSchema.safeParse({ [field]: "x".repeat(max + 1) });
    expect(result.success).toBe(false);
  });

  it("measures the limit after trimming whitespace", () => {
    const result = updateProfileSchema.safeParse({
      firstName: `  ${"a".repeat(PROFILE_FIRST_NAME_MAX_LENGTH)}  `,
    });
    expect(result.success).toBe(true);
  });

  it("keeps the limits used by the database constraints", () => {
    expect(PROFILE_FIRST_NAME_MAX_LENGTH).toBe(20);
    expect(PROFILE_NAME_MAX_LENGTH).toBe(30);
    expect(PROFILE_DISPLAY_NAME_MAX_LENGTH).toBe(32);
  });
});
