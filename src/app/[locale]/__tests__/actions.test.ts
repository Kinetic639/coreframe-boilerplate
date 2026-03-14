/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted mock factory — must come before vi.mock() calls so the reference is
// available inside the factory closure (Vitest hoists vi.mock to top of file).
const { mockEmit } = vi.hoisted(() => {
  const mockEmit = vi.fn().mockResolvedValue({ success: true, data: { id: "evt-test" } });
  return { mockEmit };
});

// Mock modules before imports
const mockSupabaseClient = {
  auth: {
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test" } }, error: null }),
    signInWithPassword: vi.fn(),
  },
  rpc: vi.fn().mockResolvedValue({ data: { success: true, invitations: [] }, error: null }),
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { organization_id: "org-1" }, error: null }),
  }),
};

const mockHeaders = new Map([["origin", "http://localhost:3000"]]);

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mockHeaders),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
  getTranslations: vi.fn(async () => {
    // Return a mock translation function that returns the key path
    return (key: string) => {
      const translations: Record<string, string> = {
        "errors.emailRequired": "Email is required",
        "errors.invalidEmailFormat": "Invalid email format",
        "success.passwordResetSent":
          "If an account exists with this email, you will receive a password reset link.",
      };
      return translations[key] || key;
    };
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn((options) => {
    // Simulate Next.js redirect behavior by throwing
    const error = new Error("NEXT_REDIRECT");
    (error as any).digest = `NEXT_REDIRECT;${JSON.stringify(options)}`;
    throw error;
  }),
}));

vi.mock("@/utils/utils", () => ({
  encodedRedirect: vi.fn((type, path, message) => ({
    type,
    path,
    message,
  })),
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: mockEmit, validateMetadata: vi.fn() },
}));

// Import actions and mocked functions after mocks are set up
import { forgotPasswordAction, resetPasswordAction, signInAction, signOutAction } from "../actions";
import { redirect as mockRedirect } from "@/i18n/navigation";

describe("Auth Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("forgotPasswordAction", () => {
    it("should return error if email is not provided", async () => {
      const formData = new FormData();

      const result = await forgotPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/forgot-password",
        message: "Email is required",
      });
    });

    it("should return error for invalid email format", async () => {
      const formData = new FormData();
      formData.append("email", "invalid-email");

      const result = await forgotPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/forgot-password",
        message: "Invalid email format",
      });
    });

    it("should call resetPasswordForEmail with correct parameters", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");

      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      await forgotPasswordAction(formData);

      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "user@example.com",
        {
          redirectTo: "http://localhost:3000/auth/confirm?next=%2Fen%2Freset-password",
        }
      );
    });

    it("should always return success message (security)", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");

      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await forgotPasswordAction(formData);

      expect(result).toEqual({
        type: "success",
        path: "/forgot-password",
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    });

    it("should return success even when Supabase returns error (security)", async () => {
      const formData = new FormData();
      formData.append("email", "nonexistent@example.com");

      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: "User not found" },
      });

      const result = await forgotPasswordAction(formData);

      // Should still return success to not reveal if email exists
      expect(result).toEqual({
        type: "success",
        path: "/forgot-password",
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    });

    it("should accept valid email with subdomain", async () => {
      const formData = new FormData();
      formData.append("email", "user@mail.example.com");

      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await forgotPasswordAction(formData);

      expect((result as any).type).toBe("success");
    });
  });

  describe("resetPasswordAction", () => {
    it("should redirect with error toast if password is not provided", async () => {
      const formData = new FormData();
      formData.append("confirmPassword", "Password123");

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });
    });

    it("should redirect with error toast if confirmPassword is not provided", async () => {
      const formData = new FormData();
      formData.append("password", "Password123");

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });
    });

    it("should redirect with error toast if passwords do not match", async () => {
      const formData = new FormData();
      formData.append("password", "Password123");
      formData.append("confirmPassword", "DifferentPass123");

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });
    });

    it("should redirect with error toast if password is less than 8 characters", async () => {
      const formData = new FormData();
      formData.append("password", "Pass12");
      formData.append("confirmPassword", "Pass12");

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });
    });

    it("should redirect with error toast if password has no uppercase letter", async () => {
      const formData = new FormData();
      formData.append("password", "password123");
      formData.append("confirmPassword", "password123");

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });
    });

    it("should redirect with error toast if password has no lowercase letter", async () => {
      const formData = new FormData();
      formData.append("password", "PASSWORD123");
      formData.append("confirmPassword", "PASSWORD123");

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });
    });

    it("should redirect with error toast if password has no number", async () => {
      const formData = new FormData();
      formData.append("password", "Password");
      formData.append("confirmPassword", "Password");

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });
    });

    it("should successfully update password with valid input", async () => {
      const formData = new FormData();
      formData.append("password", "Password123");
      formData.append("confirmPassword", "Password123");

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: {} },
        error: null,
      });

      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: "Password123",
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/sign-in",
          query: { toast: "password-updated" },
        },
        locale: "en",
      });
    });

    it("should redirect with error toast if updateUser fails", async () => {
      const formData = new FormData();
      formData.append("password", "Password123");
      formData.append("confirmPassword", "Password123");

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith({
        href: {
          pathname: "/reset-password",
          query: { toast: "password-error" },
        },
        locale: "en",
      });

      expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
    });

    it("should accept password with special characters", async () => {
      const formData = new FormData();
      formData.append("password", "Password123!@#");
      formData.append("confirmPassword", "Password123!@#");

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: {} },
        error: null,
      });

      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: "Password123!@#",
      });
    });

    it("should accept exactly 8 character password meeting all requirements", async () => {
      const formData = new FormData();
      formData.append("password", "Abcdef12");
      formData.append("confirmPassword", "Abcdef12");

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: {} },
        error: null,
      });

      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      await expect(resetPasswordAction(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// T-EMIT-TYPED-FAILURE — typed result handling for eventService.emit()
// ---------------------------------------------------------------------------
// Verifies that:
//  1. All action-layer emit call sites use the typed result pattern
//     (not try/catch which is dead code for eventService.emit())
//  2. When emit() returns { success: false }, the auth flow still completes
//     (Mode A best-effort: business logic is never blocked by emit failure)
//  3. When emit() returns { success: false }, console.error is called with
//     the typed error string from emitResult.error (not a caught exception)
// ---------------------------------------------------------------------------
describe("T-EMIT-TYPED-FAILURE — typed result handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: emit succeeds — override in specific tests
    mockEmit.mockResolvedValue({ success: true, data: { id: "evt-test" } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // forgotPasswordAction
  // -------------------------------------------------------------------------
  describe("forgotPasswordAction", () => {
    it("action continues and returns success when emit returns { success: false }", async () => {
      mockEmit.mockResolvedValue({ success: false, error: "Event insert failed: DB down" });

      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const formData = new FormData();
      formData.append("email", "user@example.com");

      const result = await forgotPasswordAction(formData);

      // Business flow is unaffected — security success message still returned
      expect((result as any).type).toBe("success");
    });

    it("logs typed error string when emit returns { success: false }", async () => {
      const typedError = "Event insert failed: connection refused";
      mockEmit.mockResolvedValue({ success: false, error: typedError });

      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("email", "user@example.com");

      await forgotPasswordAction(formData);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[forgotPasswordAction] Failed to emit auth.password.reset_requested:",
        expect.objectContaining({ error: typedError })
      );

      consoleSpy.mockRestore();
    });

    it("does NOT log when emit returns { success: true }", async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("email", "user@example.com");

      await forgotPasswordAction(formData);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // signInAction — failed login path (auth.login.failed event)
  // -------------------------------------------------------------------------
  describe("signInAction — failed login emit", () => {
    it("action returns error redirect when emit returns { success: false }", async () => {
      mockEmit.mockResolvedValue({ success: false, error: "Event insert failed: timeout" });
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid login credentials" },
      });

      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "wrong");

      // Business flow continues — encodedRedirect is returned (not thrown)
      const result = await signInAction(formData);
      expect((result as any).type).toBe("error");
    });

    it("logs typed error string for auth.login.failed when emit fails", async () => {
      const typedError = "Unregistered action key: auth.login.failed";
      mockEmit.mockResolvedValue({ success: false, error: typedError });
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid login credentials" },
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "wrong");

      await signInAction(formData);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[signInAction] Failed to emit auth.login.failed:",
        expect.objectContaining({ error: typedError })
      );

      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // signOutAction — session revoked event
  // -------------------------------------------------------------------------
  describe("signOutAction", () => {
    it("redirect still happens when emit returns { success: false }", async () => {
      mockEmit.mockResolvedValue({ success: false, error: "Event insert failed: DB down" });
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-abc" } },
        error: null,
      });
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      // redirect throws NEXT_REDIRECT — action must not swallow it
      await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT");
    });

    it("logs typed error string for auth.session.revoked when emit fails", async () => {
      const typedError = "Event insert failed: column not found";
      mockEmit.mockResolvedValue({ success: false, error: typedError });
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-abc" } },
        error: null,
      });
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT");

      expect(consoleSpy).toHaveBeenCalledWith(
        "[signOutAction] Failed to emit auth.session.revoked:",
        expect.objectContaining({ error: typedError })
      );

      consoleSpy.mockRestore();
    });

    it("skips emit entirely when getUser returns null (null-actor guard)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT");

      // emit must NOT be called — null actor produces unfindable events
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
