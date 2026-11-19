/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetClaims, mockGetUser } = vi.hoisted(() => ({
  mockGetClaims: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getClaims: mockGetClaims, getUser: mockGetUser },
  }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { getAuthUser } from "../get-auth-user";

describe("getAuthUser", () => {
  beforeEach(() => {
    mockGetClaims.mockReset();
    mockGetUser.mockReset();
  });

  it("builds the user from verified claims without calling Supabase Auth", async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-1",
          aud: "authenticated",
          role: "authenticated",
          email: "a@b.pl",
          user_metadata: { first_name: "Ala" },
          app_metadata: { provider: "email" },
        },
      },
      error: null,
    });

    const { data, error } = await getAuthUser();

    expect(error).toBeNull();
    expect(data.user).toMatchObject({
      id: "user-1",
      email: "a@b.pl",
      aud: "authenticated",
      user_metadata: { first_name: "Ala" },
      app_metadata: { provider: "email" },
    });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns no user when there is no session", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });
    const { data } = await getAuthUser();
    expect(data.user).toBeNull();
  });

  it("returns the error when the token does not verify", async () => {
    const failure = new Error("invalid JWT");
    mockGetClaims.mockResolvedValue({ data: null, error: failure });
    const { data, error } = await getAuthUser();
    expect(data.user).toBeNull();
    expect(error).toBe(failure);
  });
});
