/**
 * @vitest-environment node
 *
 * Tests for getUserRolesFromJWT — verifies G1 fix (JWT claim shape).
 *
 * G1 root cause: live DB hook injected roles into claims.app_metadata.roles
 * with field name `name`.  TypeScript reads decoded.roles (root-level) and
 * expects field name `role`, `org_id`, `branch_id`, `scope`, `scope_id`.
 *
 * After the G1 migration fix, the hook injects roles at root-level `roles`
 * with the correct field names matching JWTRole in src/lib/types/auth.ts.
 * These tests document the expected decoded shape.
 */
import { describe, it, expect } from "vitest";
import { getUserRolesFromJWT } from "../getUserRolesFromJWT";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encodeBase64Url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function makeJWT(payload: Record<string, unknown>): string {
  const header = encodeBase64Url({ alg: "HS256", typ: "JWT" });
  const body = encodeBase64Url(payload);
  return `${header}.${body}.fake-signature`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getUserRolesFromJWT — G1 claim shape (root-level roles, field: role)", () => {
  it("decodes a single org-scope role from root-level claims.roles", () => {
    const token = makeJWT({
      sub: "user-1",
      aud: "authenticated",
      roles: [
        {
          role_id: "r-1",
          role: "org_owner",
          org_id: "org-1",
          branch_id: null,
          scope: "org",
          scope_id: "org-1",
        },
      ],
    });

    const roles = getUserRolesFromJWT(token);

    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({
      role_id: "r-1",
      role: "org_owner",
      org_id: "org-1",
      branch_id: null,
      scope: "org",
      scope_id: "org-1",
    });
  });

  it("decodes a branch-scope role with branch_id set and org_id null", () => {
    const token = makeJWT({
      sub: "user-2",
      aud: "authenticated",
      roles: [
        {
          role_id: "r-2",
          role: "branch_manager",
          org_id: null,
          branch_id: "branch-1",
          scope: "branch",
          scope_id: "branch-1",
        },
      ],
    });

    const roles = getUserRolesFromJWT(token);

    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({
      role: "branch_manager",
      org_id: null,
      branch_id: "branch-1",
      scope: "branch",
      scope_id: "branch-1",
    });
  });

  it("returns empty array when JWT has no roles claim (unauthenticated or no roles assigned)", () => {
    const token = makeJWT({ sub: "user-3", aud: "authenticated" });

    expect(getUserRolesFromJWT(token)).toEqual([]);
  });

  it("returns empty array for an empty roles array", () => {
    const token = makeJWT({ sub: "user-4", roles: [] });

    expect(getUserRolesFromJWT(token)).toEqual([]);
  });

  it("returns empty array and does not throw for an invalid/malformed JWT", () => {
    expect(getUserRolesFromJWT("not.a.jwt")).toEqual([]);
    expect(getUserRolesFromJWT("")).toEqual([]);
  });

  it("does NOT read roles from app_metadata (old/broken hook shape — G1 regression guard)", () => {
    // Simulates the old hook output that caused G1.
    // roles at app_metadata.roles with field `name` should NOT be decoded.
    const token = makeJWT({
      sub: "user-5",
      aud: "authenticated",
      // Old broken format — NOT at root level, NOT field name `role`
      app_metadata: {
        roles: [{ name: "org_owner", org_id: "org-1", scope: "org" }],
      },
      // No root-level `roles` key
    });

    // Must return [] — the old shape is not supported
    expect(getUserRolesFromJWT(token)).toEqual([]);
  });

  it("decodes multiple roles from root-level claim", () => {
    const token = makeJWT({
      sub: "user-6",
      roles: [
        {
          role_id: "r-1",
          role: "org_owner",
          org_id: "org-1",
          branch_id: null,
          scope: "org",
          scope_id: "org-1",
        },
        {
          role_id: "r-2",
          role: "branch_manager",
          org_id: null,
          branch_id: "b-1",
          scope: "branch",
          scope_id: "b-1",
        },
      ],
    });

    const roles = getUserRolesFromJWT(token);

    expect(roles).toHaveLength(2);
    expect(roles.map((r) => r.role)).toEqual(["org_owner", "branch_manager"]);
  });
});
