/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules before imports
const mockSupabaseClient = {
  auth: {
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
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

// Import actions and mocked functions after mocks are set up
import { forgotPasswordAction, resetPasswordAction } from "../actions";
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
