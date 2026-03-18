/**
 * @vitest-environment node
 *
 * T-RLS: Real DB RLS integration tests for Organization Management.
 *
 * Connects to the actual Supabase project to verify that RLS policies
 * enforce correct access control at the Postgres level (not mocked).
 *
 * Requirements (loaded from .env.local by Vitest/Vite):
 *   NEXT_PUBLIC_SUPABASE_URL       — project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  — anon/publishable key (RLS is enforced)
 *   SUPABASE_SERVICE_ROLE_KEY      — service role key (bypasses RLS for setup/teardown)
 *
 * Tests skip automatically when env vars are absent (CI-safe).
 *
 * Covered gaps:
 *   P1-A — "V2 view org role assignments" SELECT policy (members.read required)
 *   P1-B — removeMember soft-deletes user_role_assignments (stale-role fix)
 *
 * ─── CLIENT DISCIPLINE ────────────────────────────────────────────────────────
 * Two client types are used; NEVER mix them:
 *
 *   SetupClient  — service role, bypasses RLS.
 *                  ONLY used in beforeAll / afterAll / within-test setup.
 *                  Type alias: SetupClient (opaque, cannot be passed to rlsQuery).
 *
 *   RlsClient    — anon key + signed-in JWT, RLS enforced.
 *                  The ONLY type accepted by rlsQuery() helper.
 *                  Produced exclusively by signInAsUser().
 *
 * rlsQuery() enforces this at call-time: it calls assertIsRlsClient(client)
 * which throws if the client carries the service-role key.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OrgMembersService } from "../organization.service";

// ─── Env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const HAVE_ENV =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY) && Boolean(SUPABASE_SERVICE_KEY);

const itIfEnv = HAVE_ENV ? it : it.skip;

// ─── Client type discipline ───────────────────────────────────────────────────

/**
 * Opaque wrapper around a service-role Supabase client.
 * Only accessible as `SetupClient` so test bodies cannot accidentally use it
 * for RLS-gated assertions. Unwrap with `.inner` when calling service-layer
 * functions (which accept SupabaseClient directly) — but NEVER pass .inner
 * to rlsQuery().
 */
class SetupClient {
  constructor(readonly inner: SupabaseClient) {}
}

/**
 * Opaque wrapper around an anon-key + JWT signed-in client.
 * RLS is enforced for all queries made through this client.
 * This is the ONLY client type accepted by rlsQuery().
 */
class RlsClient {
  constructor(readonly inner: SupabaseClient) {}
}

/**
 * Runtime guard: throws if a raw SupabaseClient carrying the service key is
 * passed. All RLS assertion calls must go through this function.
 */
function assertIsRlsClient(client: SupabaseClient): void {
  // Supabase JS stores the apikey header internally; check it does not match
  // the service role key. This catches accidental use of the setup client.
  const headers = (client as unknown as { headers?: Record<string, string> }).headers ?? {};
  const apikey: string = headers["apikey"] ?? headers["Authorization"] ?? "";
  if (SUPABASE_SERVICE_KEY && apikey.includes(SUPABASE_SERVICE_KEY.slice(-8))) {
    throw new Error(
      "[T-RLS safety] Service-role client passed to rlsQuery(). " +
        "Use signInAsUser() to obtain an RlsClient for policy assertions."
    );
  }
}

/**
 * Execute an RLS-gated query. Accepts only RlsClient to prevent accidental
 * use of the service-role client in policy assertions.
 */
async function rlsQuery<T>(
  rlsClient: RlsClient,
  fn: (client: SupabaseClient) => PromiseLike<T>
): Promise<T> {
  assertIsRlsClient(rlsClient.inner);
  return await fn(rlsClient.inner);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSetupClient(): SetupClient {
  return new SetupClient(
    createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  );
}

/** Create a real auth user in Supabase. Requires a SetupClient (service role). */
async function createTestUser(setup: SetupClient, label: string) {
  const email = `rls-test-${label}@test.rlsintegration.internal`;
  const password = "TestRls123!__integration";
  const { data, error } = await setup.inner.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser(${label}) failed: ${error?.message}`);
  return { user: data.user, email, password };
}

/**
 * Sign in with email/password using the anon key. Returns an RlsClient whose
 * queries are RLS-enforced. Use ONLY for policy-assertion queries (T-RLS-1/2/3).
 */
async function signInAsUser(email: string, password: string): Promise<RlsClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return new RlsClient(client);
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

interface Fixtures {
  /** Service-role client. SETUP AND CLEANUP ONLY — never for RLS assertions. */
  setup: SetupClient;
  orgId: string;
  roleId: string;
  /** User A: active org-member WITH members.read → should see user_role_assignments */
  userA: { id: string; email: string; password: string };
  /** User A's user_role_assignments row id (the one we assert is visible) */
  userARoleAssignmentId: string;
  /** User B: active org-member WITHOUT members.read → should see 0 rows */
  userB: { id: string; email: string; password: string };
  /** User C: NOT an org-member → should see 0 rows */
  userC: { id: string; email: string; password: string };
}

let fx: Fixtures;

beforeAll(async () => {
  if (!HAVE_ENV) return;

  // SetupClient uses service role — bypasses RLS for seeding only.
  const setup = makeSetupClient();
  const ts = Date.now();

  // Create three isolated test auth users
  const ua = await createTestUser(setup, `a-${ts}`);
  const ub = await createTestUser(setup, `b-${ts}`);
  const uc = await createTestUser(setup, `c-${ts}`);

  // Create a test organization (service role bypasses RLS)
  const { data: org, error: orgErr } = await setup.inner
    .from("organizations")
    .insert({ name: `__rls_test_${ts}`, slug: `rls-test-${ts}`, created_by: ua.user.id })
    .select("id")
    .single();
  if (orgErr || !org) throw new Error(`org insert failed: ${orgErr?.message}`);

  // Create a test role owned by this org
  const { data: role, error: roleErr } = await setup.inner
    .from("roles")
    .insert({ organization_id: org.id, name: `__rls_test_role_${ts}`, scope_type: "org" })
    .select("id")
    .single();
  if (roleErr || !role) throw new Error(`role insert failed: ${roleErr?.message}`);

  // Add User A and User B as active members (User C is intentionally NOT added)
  const { error: membErr } = await setup.inner.from("organization_members").insert([
    { organization_id: org.id, user_id: ua.user.id, status: "active" },
    { organization_id: org.id, user_id: ub.user.id, status: "active" },
  ]);
  if (membErr) throw new Error(`members insert failed: ${membErr.message}`);

  // Assign the test role to User A (scope='org')
  const { data: uraRow, error: uraErr } = await setup.inner
    .from("user_role_assignments")
    .insert({ user_id: ua.user.id, role_id: role.id, scope: "org", scope_id: org.id })
    .select("id")
    .single();
  if (uraErr || !uraRow) throw new Error(`ura insert failed: ${uraErr?.message}`);

  // Grant members.read to User A via user_effective_permissions.
  // Inserted AFTER the org_member trigger fires so our row persists.
  const { error: uepErr } = await setup.inner.from("user_effective_permissions").insert({
    user_id: ua.user.id,
    organization_id: org.id,
    permission_slug: "members.read",
    source_type: "role",
    source_id: role.id,
    compiled_at: new Date().toISOString(),
  });
  if (uepErr) throw new Error(`uep insert failed: ${uepErr?.message}`);

  // User B: active member with NO user_effective_permissions for members.read (intentional gap)

  fx = {
    setup,
    orgId: org.id,
    roleId: role.id,
    userA: { id: ua.user.id, email: ua.email, password: ua.password },
    userARoleAssignmentId: uraRow.id,
    userB: { id: ub.user.id, email: ub.email, password: ub.password },
    userC: { id: uc.user.id, email: uc.email, password: uc.password },
  };
});

afterAll(async () => {
  if (!HAVE_ENV || !fx) return;
  // All cleanup via service role (SetupClient) — bypasses RLS intentionally.
  const s = fx.setup.inner;
  const { orgId, roleId, userA, userB, userC } = fx;

  await s.from("user_effective_permissions").delete().eq("organization_id", orgId);
  await s.from("user_role_assignments").delete().eq("scope", "org").eq("scope_id", orgId);
  await s.from("organization_members").delete().eq("organization_id", orgId);
  await s.from("organization_profiles").delete().eq("organization_id", orgId);
  await s.from("roles").delete().eq("id", roleId);
  await s.from("organizations").delete().eq("id", orgId);
  await s.auth.admin.deleteUser(userA.id);
  await s.auth.admin.deleteUser(userB.id);
  await s.auth.admin.deleteUser(userC.id);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("user_role_assignments RLS — real Postgres (T-RLS)", () => {
  // ── T-RLS-1/2/3: Policy ALLOW/DENY assertions ────────────────────────────
  // All three use rlsQuery() with RlsClient — service role is NEVER involved.

  itIfEnv("T-RLS-1: non-member gets 0 rows from user_role_assignments (org-scope)", async () => {
    const rlsClient = await signInAsUser(fx.userC.email, fx.userC.password);
    const { data, error } = await rlsQuery(rlsClient, (c) =>
      c.from("user_role_assignments").select("id").eq("scope", "org").eq("scope_id", fx.orgId)
    );

    // PERMISSIVE policies — no matching policy → row filtered to empty, not error
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  itIfEnv(
    "T-RLS-2: active member WITH members.read CAN read user_role_assignments (P1-A V2 policy)",
    async () => {
      const rlsClient = await signInAsUser(fx.userA.email, fx.userA.password);
      const { data, error } = await rlsQuery(rlsClient, (c) =>
        c.from("user_role_assignments").select("id").eq("scope", "org").eq("scope_id", fx.orgId)
      );

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // User A's own assignment must be visible
      const ids = (data ?? []).map((r: { id: string }) => r.id);
      expect(ids).toContain(fx.userARoleAssignmentId);
    }
  );

  itIfEnv("T-RLS-3: active member WITHOUT members.read gets 0 rows (org-scope)", async () => {
    const rlsClient = await signInAsUser(fx.userB.email, fx.userB.password);
    const { data, error } = await rlsQuery(rlsClient, (c) =>
      c.from("user_role_assignments").select("id").eq("scope", "org").eq("scope_id", fx.orgId)
    );

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // ── T-RLS-4: Service-layer mutation verification ──────────────────────────
  // This test verifies that removeMember() correctly soft-deletes role
  // assignments at the DB level. It does NOT assert an RLS ALLOW/DENY
  // policy — it asserts that the service function mutated the correct rows.
  // The service role (SetupClient) is used for setup AND verification because
  // we need to read soft-deleted rows (which RLS would hide from user clients).
  // The rlsQuery() helper is intentionally NOT used here.

  itIfEnv(
    "T-RLS-4: removeMember soft-deletes org-scoped user_role_assignments (P1-B stale-role fix)",
    async () => {
      const s = fx.setup.inner; // service role — setup/verification only

      // Create an isolated user D for this test to avoid affecting T-RLS-2
      const ud = await createTestUser(fx.setup, `d-${Date.now()}`);

      await s.from("organization_members").insert({
        organization_id: fx.orgId,
        user_id: ud.user.id,
        status: "active",
      });

      const { data: uraD, error: uraDErr } = await s
        .from("user_role_assignments")
        .insert({ user_id: ud.user.id, role_id: fx.roleId, scope: "org", scope_id: fx.orgId })
        .select("id")
        .single();
      if (uraDErr || !uraD) throw new Error(`ura-D insert failed: ${uraDErr?.message}`);

      // Call the service function under test.
      // Service role is passed here as a trust proxy: in production this
      // function is called with an authenticated (RLS-enforced) client
      // but for DB-mutation verification the service role is equivalent.
      const result = await OrgMembersService.removeMember(s as never, fx.orgId, ud.user.id);
      expect(result.success).toBe(true);

      // Verification: read via service role to see soft-deleted rows (RLS hides them).
      // These are DB-state assertions, not RLS policy assertions.
      const { data: checkUra } = await s
        .from("user_role_assignments")
        .select("id, deleted_at")
        .eq("id", uraD.id)
        .single();
      expect(checkUra?.deleted_at).not.toBeNull();

      const { data: checkMem } = await s
        .from("organization_members")
        .select("id, deleted_at")
        .eq("organization_id", fx.orgId)
        .eq("user_id", ud.user.id)
        .single();
      expect(checkMem?.deleted_at).not.toBeNull();

      // Clean up user D (service role)
      await s.from("user_effective_permissions").delete().eq("user_id", ud.user.id);
      await s
        .from("user_role_assignments")
        .delete()
        .eq("user_id", ud.user.id)
        .eq("scope_id", fx.orgId);
      await s
        .from("organization_members")
        .delete()
        .eq("organization_id", fx.orgId)
        .eq("user_id", ud.user.id);
      await s.auth.admin.deleteUser(ud.user.id);
    }
  );
});
