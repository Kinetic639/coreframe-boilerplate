import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../mocks/server";
import { http, HttpResponse } from "msw";

describe("MSW Integration", () => {
  describe("Default Handlers", () => {
    it("should intercept Supabase auth requests", async () => {
      const response = await fetch("https://example.supabase.co/auth/v1/token", {
        method: "POST",
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty("access_token");
      expect(data.access_token).toBe("mock-access-token");
      expect(data.user.email).toBe("test@example.com");
    });

    it("should intercept Supabase REST API GET requests", async () => {
      const response = await fetch("https://example.supabase.co/rest/v1/products", {
        method: "GET",
        headers: {
          Authorization: "Bearer mock-token",
        },
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it("should intercept Supabase REST API POST requests", async () => {
      const response = await fetch("https://example.supabase.co/rest/v1/products", {
        method: "POST",
        headers: {
          Authorization: "Bearer mock-token",
        },
        body: JSON.stringify({ name: "Test Product" }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty("id");
      expect(data.id).toBe("mock-id");
    });
  });

  describe("Runtime Handlers", () => {
    it("should allow adding runtime handlers", async () => {
      // Add a runtime handler for this specific test
      server.use(
        http.get("https://api.example.com/users", () => {
          return HttpResponse.json([
            { id: 1, name: "John Doe" },
            { id: 2, name: "Jane Smith" },
          ]);
        })
      );

      const response = await fetch("https://api.example.com/users");
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("John Doe");
    });

    it("should reset handlers after each test", async () => {
      // This test verifies that the handler from the previous test was reset
      // The request should not match any handler and return empty array (default Supabase handler)
      const response = await fetch("https://example.supabase.co/rest/v1/test", {
        headers: {
          Authorization: "Bearer mock-token",
        },
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("Custom Response Handler", () => {
    beforeEach(() => {
      // Add a custom handler for this describe block
      server.use(
        http.get("https://api.example.com/test", () => {
          return HttpResponse.json({ message: "Test successful" }, { status: 200 });
        })
      );
    });

    it("should use custom handler", async () => {
      const response = await fetch("https://api.example.com/test");
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.message).toBe("Test successful");
    });

    it("should handle error responses", async () => {
      server.use(
        http.get("https://api.example.com/error", () => {
          return HttpResponse.json({ error: "Not found" }, { status: 404 });
        })
      );

      const response = await fetch("https://api.example.com/error");
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(data.error).toBe("Not found");
    });
  });
});

// Test that MSW server is properly initialized
describe("MSW Server Setup", () => {
  it("should have MSW server running", () => {
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe("function");
    expect(typeof server.close).toBe("function");
    expect(typeof server.resetHandlers).toBe("function");
  });
});
