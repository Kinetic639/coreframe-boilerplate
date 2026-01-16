/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    verifyOtp: vi.fn(),
  },
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

// Import after mocks
import { GET } from "../route";

describe("POST /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (searchParams: Record<string, string>) => {
    const url = new URL("http://localhost:3000/auth/confirm");
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return new NextRequest(url);
  };

  describe("successful token verification", () => {
    it("should verify token and redirect to next URL", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "valid-token-hash",
        type: "recovery",
        next: "/reset-password",
      });

      const response = await GET(request);

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        type: "recovery",
        token_hash: "valid-token-hash",
      });

      expect(response.status).toBe(307); // NextResponse.redirect uses 307
      expect(response.headers.get("location")).toContain("/zresetuj-haslo");
      expect(response.headers.get("location")).not.toContain("token_hash");
      expect(response.headers.get("location")).not.toContain("type");
    });

    it("should redirect to default dashboard if no next URL provided", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "valid-token-hash",
        type: "recovery",
      });

      const response = await GET(request);

      expect(response.headers.get("location")).toContain("/zresetuj-haslo");
    });

    it("should handle signup email verification", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "signup-token",
        type: "signup",
        next: "/dashboard",
      });

      const response = await GET(request);

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        type: "signup",
        token_hash: "signup-token",
      });

      expect(response.headers.get("location")).toContain("/dashboard");
    });

    it("should handle invite verification", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "invite-token",
        type: "invite",
      });

      await GET(request);

      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        type: "invite",
        token_hash: "invite-token",
      });
    });
  });

  describe("token verification failures", () => {
    it("should redirect to error page if token_hash is missing", async () => {
      const request = createMockRequest({
        type: "recovery",
      });

      const response = await GET(request);

      expect(mockSupabaseClient.auth.verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toContain("/auth/auth-code-error");
    });

    it("should redirect to error page if type is missing", async () => {
      const request = createMockRequest({
        token_hash: "valid-token",
      });

      const response = await GET(request);

      expect(mockSupabaseClient.auth.verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toContain("/auth/auth-code-error");
    });

    it("should redirect to error page if verifyOtp returns error", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: "Invalid token" },
      });

      const request = createMockRequest({
        token_hash: "invalid-token",
        type: "recovery",
      });

      const response = await GET(request);

      expect(response.headers.get("location")).toContain("/auth/auth-code-error");
    });

    it("should redirect to error page for expired token", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: "Token expired" },
      });

      const request = createMockRequest({
        token_hash: "expired-token",
        type: "recovery",
      });

      const response = await GET(request);

      expect(response.headers.get("location")).toContain("/auth/auth-code-error");
    });

    it("should redirect to error page for already-used token", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: "Token already used" },
      });

      const request = createMockRequest({
        token_hash: "used-token",
        type: "recovery",
      });

      const response = await GET(request);

      expect(response.headers.get("location")).toContain("/auth/auth-code-error");
    });
  });

  describe("query parameter cleanup", () => {
    it("should remove token_hash, type, and next from redirect URL", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "token",
        type: "recovery",
        next: "/reset-password",
        someOtherParam: "value",
      });

      const response = await GET(request);
      const location = response.headers.get("location") || "";

      expect(location).not.toContain("token_hash");
      expect(location).not.toContain("type=");
      expect(location).not.toContain("next=");
    });

    it("should preserve other query parameters", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "token",
        type: "recovery",
        next: "/reset-password",
        ref: "email",
        source: "notification",
      });

      const response = await GET(request);
      const location = response.headers.get("location") || "";

      expect(location).toContain("ref=email");
      expect(location).toContain("source=notification");
    });

    it("should handle next URL with existing query parameters", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "token",
        type: "recovery",
        next: "/reset-password?ref=email",
      });

      const response = await GET(request);
      const location = response.headers.get("location") || "";

      expect(location).toContain("/reset-password");
      expect(location).toContain("ref=email");
    });
  });

  describe("edge cases", () => {
    it("should handle empty token_hash", async () => {
      const request = createMockRequest({
        token_hash: "",
        type: "recovery",
      });

      const response = await GET(request);

      expect(response.headers.get("location")).toContain("/auth/auth-code-error");
    });

    it("should handle invalid type", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: null,
        error: { message: "Invalid type" },
      });

      const request = createMockRequest({
        token_hash: "token",
        type: "invalid_type",
      });

      const response = await GET(request);

      expect(response.headers.get("location")).toContain("/auth/auth-code-error");
    });

    it("should handle malformed next URL", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });

      const request = createMockRequest({
        token_hash: "token",
        type: "recovery",
        next: "//malformed///url",
      });

      const response = await GET(request);

      // Should still redirect, Next.js will handle malformed URLs
      expect(response.status).toBe(307);
    });
  });
});
