import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "../validations/auth";
import { cn, formatDate } from "../utils";
import { TOASTS } from "../toasts";
import { toUnsafeI18nHref } from "../i18n/unsafe-href";

describe("auth validation utilities", () => {
  it("validates sign-in and sign-up payloads", () => {
    expect(signInSchema.safeParse({ email: "user@example.com", password: "x" }).success).toBe(true);
    expect(signUpSchema.safeParse({ email: "user@example.com", password: "secret1" }).success).toBe(
      true
    );
    expect(forgotPasswordSchema.safeParse({ email: "bad-email" }).success).toBe(false);
  });

  it("rejects mismatched reset passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "secret1",
      confirmPassword: "secret2",
    });

    expect(result.success).toBe(false);
  });

  it("formats classes, dates, toasts, and unsafe hrefs", () => {
    expect(cn("p-2", false && "hidden", "p-4")).toContain("p-4");
    expect(formatDate("2026-03-01T10:30:00Z", "en-US")).toContain("2026");
    expect(TOASTS["password-updated"].translationKey).toBe("toasts.passwordUpdated");
    expect(toUnsafeI18nHref("/dashboard/start")).toBe("/dashboard/start");
  });
});
