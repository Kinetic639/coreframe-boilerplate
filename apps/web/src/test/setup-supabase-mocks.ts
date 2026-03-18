import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Error helper functions for simulating Supabase errors
 */
export function mockSupabaseError(
  message = "RLS: denied",
  code = "PGRST301",
  details: string | null = "RLS violation"
) {
  return {
    data: null,
    error: {
      message,
      code,
      details,
      hint: null,
    },
  };
}

export function mockAuthError(message = "Invalid credentials", code = "invalid_grant") {
  return {
    data: null,
    error: {
      message,
      code,
      status: 401,
    },
  };
}

export function mockRLSError(message = "new row violates row-level security policy") {
  return mockSupabaseError(message, "PGRST301", "Failing row contains (...)");
}

export function mockNotFoundError() {
  return mockSupabaseError("No rows found", "PGRST116", null);
}

export function mockUniqueConstraintError(constraint = "unique_constraint") {
  return mockSupabaseError(
    `duplicate key value violates unique constraint "${constraint}"`,
    "23505",
    "Key already exists"
  );
}

export function mockForeignKeyError(constraint = "foreign_key_constraint") {
  return mockSupabaseError(
    `insert or update on table violates foreign key constraint "${constraint}"`,
    "23503",
    "Key is not present in referenced table"
  );
}

export function mockJWTExpiredError() {
  return mockSupabaseError("JWT expired", "401", "Token has expired");
}

export function mockStorageError(message = "Storage error", code = "storage/unknown") {
  return {
    data: null,
    error: {
      message,
      statusCode: code,
    },
  };
}

export function createMockSupabaseClient(): SupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as any;
}

export function mockSupabaseClient() {
  vi.mock("@/utils/supabase/client", () => ({
    createClient: vi.fn(() => createMockSupabaseClient()),
  }));

  vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn(() => createMockSupabaseClient()),
  }));
}
