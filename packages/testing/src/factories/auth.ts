/**
 * Auth Fixture Factories
 *
 * Reusable builders for TokenRole and JWT claims test fixtures.
 * Used by @repo/auth tests.
 *
 * JWT encoding note: AuthService uses jwt-decode which reads the payload
 * from the middle segment of a JWT. For tests, we build a minimal fake
 * JWT: `header.payload.signature` where payload is base64url-encoded JSON.
 */

import type { TokenRole } from "@repo/contracts/auth";

// ---------------------------------------------------------------------------
// TokenRole factory
// ---------------------------------------------------------------------------

const DEFAULT_TOKEN_ROLE: TokenRole = {
  role_id: "role-id-001",
  name: "org_owner",
  scope: "org",
  scope_id: "11111111-1111-1111-1111-111111111111",
  scope_type: "org",
  is_basic: true,
  org_id: "11111111-1111-1111-1111-111111111111",
  branch_id: null,
  role: "org_owner",
};

/**
 * Build a TokenRole with optional overrides.
 *
 * @example
 * makeTokenRole({ name: "branch_manager", scope: "branch", scope_id: "branch-uuid" })
 */
export function makeTokenRole(overrides?: Partial<TokenRole>): TokenRole {
  return { ...DEFAULT_TOKEN_ROLE, ...overrides };
}

/**
 * Build an org-scoped TokenRole for the given org.
 */
export function makeOrgRole(name: string, orgId: string, isBasic = false): TokenRole {
  return {
    role_id: `role-${name}`,
    name,
    scope: "org",
    scope_id: orgId,
    scope_type: "org",
    is_basic: isBasic,
    org_id: orgId,
    branch_id: null,
    role: name,
  };
}

/**
 * Build a branch-scoped TokenRole for the given branch.
 */
export function makeBranchRole(
  name: string,
  branchId: string,
  orgId: string | null = null
): TokenRole {
  return {
    role_id: `role-${name}`,
    name,
    scope: "branch",
    scope_id: branchId,
    scope_type: "branch",
    is_basic: false,
    org_id: orgId,
    branch_id: branchId,
    role: name,
  };
}

// ---------------------------------------------------------------------------
// JWT claims builders (for AuthService.getUserRoles tests)
//
// These produce minimal fake JWTs. jwt-decode reads the base64url-encoded
// middle segment — no signature verification is performed.
// ---------------------------------------------------------------------------

/**
 * Target JWT wire shape: claims.app_metadata.roles[]
 * Each role has: role_id, name, is_basic, scope, scope_id, scope_type
 */
export interface TargetRawRole {
  role_id: string;
  name: string;
  is_basic: boolean;
  scope: "org" | "branch";
  scope_id: string;
  scope_type: "org" | "branch";
}

/**
 * Legacy JWT wire shape: claims.roles[]
 * Each role has: role_id?, role, org_id?, branch_id?, scope?, scope_id?
 */
export interface LegacyRawRole {
  role_id?: string;
  role: string;
  org_id?: string | null;
  branch_id?: string | null;
  scope?: "org" | "branch";
  scope_id?: string;
}

function base64url(obj: unknown): string {
  const json = JSON.stringify(obj);
  // Buffer is available in Node.js (used in test environments only)
  return Buffer.from(json).toString("base64url");
}

const FAKE_HEADER = base64url({ alg: "HS256", typ: "JWT" });
const FAKE_SIG = "fake-signature";

/**
 * Build a minimal fake JWT with target-shape roles in app_metadata.roles[].
 *
 * @example
 * const token = makeTargetJwt([
 *   makeTargetRawRole("org_owner", "org", orgId)
 * ]);
 * AuthService.getUserRoles(token) // → [TokenRole]
 */
export function makeTargetJwt(roles: TargetRawRole[]): string {
  const payload = base64url({
    sub: "test-user-id",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    app_metadata: { roles },
  });
  return `${FAKE_HEADER}.${payload}.${FAKE_SIG}`;
}

/**
 * Build a minimal fake JWT with legacy-shape roles at claims.roles[].
 *
 * @example
 * const token = makeLegacyJwt([{ role: "org_owner", org_id: orgId }]);
 * AuthService.getUserRoles(token) // → [TokenRole]
 */
export function makeLegacyJwt(roles: LegacyRawRole[]): string {
  const payload = base64url({
    sub: "test-user-id",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    roles,
  });
  return `${FAKE_HEADER}.${payload}.${FAKE_SIG}`;
}

/**
 * Build a TargetRawRole object (the wire format before normalization).
 */
export function makeTargetRawRole(
  name: string,
  scope: "org" | "branch",
  scopeId: string,
  overrides?: Partial<TargetRawRole>
): TargetRawRole {
  return {
    role_id: `role-${name}`,
    name,
    is_basic: false,
    scope,
    scope_id: scopeId,
    scope_type: scope,
    ...overrides,
  };
}

/**
 * Build a LegacyRawRole object (the wire format before normalization).
 */
export function makeLegacyRawRole(
  roleName: string,
  overrides?: Partial<LegacyRawRole>
): LegacyRawRole {
  return { role: roleName, ...overrides };
}
