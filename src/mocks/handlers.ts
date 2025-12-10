import { http, HttpResponse } from "msw";

export const handlers = [
  // Supabase Auth endpoints
  http.post("*/auth/v1/token*", ({ request }) => {
    // Check for valid credentials (for testing auth flows)
    const authHeader = request.headers.get("Authorization");

    if (authHeader === "Bearer invalid-token") {
      return HttpResponse.json(
        { error: "invalid_grant", error_description: "Invalid credentials" },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      access_token: "mock-access-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: {
        id: "mock-user-id",
        email: "test@example.com",
        role: "authenticated",
      },
    });
  }),

  // Supabase REST API - GET with RLS support
  http.get("*/rest/v1/*", ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    // Simulate RLS: No auth token = 401
    if (!authHeader || authHeader === "Bearer") {
      return HttpResponse.json(
        {
          message: "JWT expired or missing",
          code: "401",
          hint: "No authorization header or invalid token",
        },
        { status: 401 }
      );
    }

    // Simulate RLS: Forbidden by policy = 403
    if (authHeader === "Bearer forbidden-token") {
      return HttpResponse.json(
        {
          message: "new row violates row-level security policy",
          code: "PGRST301",
          details: "Failing row contains (...)",
          hint: null,
        },
        { status: 403 }
      );
    }

    return HttpResponse.json([]);
  }),

  // Supabase REST API - POST with RLS support
  http.post("*/rest/v1/*", ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || authHeader === "Bearer") {
      return HttpResponse.json(
        {
          message: "JWT expired or missing",
          code: "401",
        },
        { status: 401 }
      );
    }

    if (authHeader === "Bearer forbidden-token") {
      return HttpResponse.json(
        {
          message: "new row violates row-level security policy",
          code: "PGRST301",
        },
        { status: 403 }
      );
    }

    return HttpResponse.json({ id: "mock-id" });
  }),

  // Supabase REST API - PATCH with RLS support
  http.patch("*/rest/v1/*", ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || authHeader === "Bearer") {
      return HttpResponse.json({ message: "JWT expired or missing", code: "401" }, { status: 401 });
    }

    if (authHeader === "Bearer forbidden-token") {
      return HttpResponse.json(
        { message: "new row violates row-level security policy", code: "PGRST301" },
        { status: 403 }
      );
    }

    return HttpResponse.json({ id: "mock-id" });
  }),

  // Supabase REST API - DELETE with RLS support
  http.delete("*/rest/v1/*", ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || authHeader === "Bearer") {
      return HttpResponse.json({ message: "JWT expired or missing", code: "401" }, { status: 401 });
    }

    if (authHeader === "Bearer forbidden-token") {
      return HttpResponse.json(
        { message: "new row violates row-level security policy", code: "PGRST301" },
        { status: 403 }
      );
    }

    return HttpResponse.json({});
  }),
];
