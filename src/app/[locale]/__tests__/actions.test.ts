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
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn((options) => `redirect:${options.href}`),
}));

vi.mock("@/utils/utils", () => ({
  encodedRedirect: vi.fn((type, path, message) => ({
    type,
    path,
    message,
  })),
}));

// Import actions after mocks are set up
import { forgotPasswordAction, resetPasswordAction } from "../actions";

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
          redirectTo: "http://localhost:3000/auth/confirm?next=/en/reset-password",
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
    it("should return error if password is not provided", async () => {
      const formData = new FormData();
      formData.append("confirmPassword", "Password123");

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Password and confirmation are required",
      });
    });

    it("should return error if confirmPassword is not provided", async () => {
      const formData = new FormData();
      formData.append("password", "Password123");

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Password and confirmation are required",
      });
    });

    it("should return error if passwords do not match", async () => {
      const formData = new FormData();
      formData.append("password", "Password123");
      formData.append("confirmPassword", "DifferentPass123");

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Passwords do not match",
      });
    });

    it("should return error if password is less than 8 characters", async () => {
      const formData = new FormData();
      formData.append("password", "Pass12");
      formData.append("confirmPassword", "Pass12");

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Password must be at least 8 characters",
      });
    });

    it("should return error if password has no uppercase letter", async () => {
      const formData = new FormData();
      formData.append("password", "password123");
      formData.append("confirmPassword", "password123");

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Password must contain an uppercase letter",
      });
    });

    it("should return error if password has no lowercase letter", async () => {
      const formData = new FormData();
      formData.append("password", "PASSWORD123");
      formData.append("confirmPassword", "PASSWORD123");

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Password must contain a lowercase letter",
      });
    });

    it("should return error if password has no number", async () => {
      const formData = new FormData();
      formData.append("password", "Password");
      formData.append("confirmPassword", "Password");

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Password must contain a number",
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

      const result = await resetPasswordAction(formData);

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: "Password123",
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(result).toBe("redirect:/sign-in");
    });

    it("should return error if updateUser fails", async () => {
      const formData = new FormData();
      formData.append("password", "Password123");
      formData.append("confirmPassword", "Password123");

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });

      const result = await resetPasswordAction(formData);

      expect(result).toEqual({
        type: "error",
        path: "/reset-password",
        message: "Failed to update password. Please try again.",
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

      await resetPasswordAction(formData);

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

      await resetPasswordAction(formData);

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalled();
    });
  });
});
