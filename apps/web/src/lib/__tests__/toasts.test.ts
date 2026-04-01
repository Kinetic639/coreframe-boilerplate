import { describe, expect, it } from "vitest";
import { TOASTS } from "../toasts";

describe("TOASTS", () => {
  it("defines the known password toast keys", () => {
    expect(TOASTS["password-updated"]).toEqual({
      type: "success",
      translationKey: "toasts.passwordUpdated",
    });
    expect(TOASTS["password-too-weak"].type).toBe("error");
    expect(Object.keys(TOASTS)).toContain("password-session-expired");
  });
});
