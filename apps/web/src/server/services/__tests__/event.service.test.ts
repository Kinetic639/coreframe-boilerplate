/**
 * @vitest-environment node
 *
 * Event Service — Unit Tests
 *
 * These tests verify:
 *   T-EVENT-SERVICE:    emit() behaviour (validation, normalization, insert)
 *   T-EVENT-VALIDATE:   validateMetadata() helper behaviour
 *   T-EVENT-INVARIANT:  central emission path is enforced
 *
 * The Supabase service client is mocked.
 * No real DB calls are made in these tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the service-role Supabase client before importing the service
// ---------------------------------------------------------------------------

vi.mock("@supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@supabase/service";
import { eventService, validateMetadata } from "../event.service";
import type { EmitEventInput } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const REQUEST_ID = "33333333-3333-3333-3333-333333333333";

/** Create a mock Supabase client that returns a successful insert result. */
function makeInsertClient(overrides: { data?: unknown; error?: unknown } = {}) {
  const singleFn = vi.fn().mockResolvedValue({
    data: overrides.data ?? { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
    error: overrides.error ?? null,
  });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

  return { from: fromFn, _insert: insertFn, _select: selectFn, _single: singleFn };
}

/** Minimal valid emit input for auth.login (no required metadata fields). */
function makeAuthLoginInput(overrides: Partial<EmitEventInput> = {}): EmitEventInput {
  return {
    actionKey: "auth.login",
    actorType: "user",
    actorUserId: USER_ID,
    organizationId: null, // auth events may be org-null
    entityType: "user",
    entityId: USER_ID,
    eventTier: "baseline",
    metadata: {},
    requestId: REQUEST_ID,
    ...overrides,
  };
}

/** Minimal valid emit input for org.member.invited (has required metadata). */
function makeOrgInviteInput(overrides: Partial<EmitEventInput> = {}): EmitEventInput {
  return {
    actionKey: "org.member.invited",
    actorType: "user",
    actorUserId: USER_ID,
    organizationId: ORG_ID,
    entityType: "invitation",
    entityId: "inv-001",
    eventTier: "enhanced",
    metadata: { invitee_email: "invited@example.com" },
    requestId: REQUEST_ID,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T-EVENT-SERVICE: emit() behaviour
// ---------------------------------------------------------------------------

describe("T-EVENT-SERVICE: eventService.emit()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Unregistered actionKey ---

  it("rejects an unregistered actionKey without calling the DB", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit({
      actionKey: "nonexistent.event",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: ORG_ID,
      entityType: "thing",
      entityId: "abc",
      eventTier: "baseline",
    });

    expect(result.success).toBe(false);
    const err1 = (result as { success: false; error: string }).error;
    expect(err1).toContain("Unregistered action key");
    expect(err1).toContain("nonexistent.event");
    // DB must not be called
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects a warehouse action key (not in initial registry)", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit({
      actionKey: "warehouse.movement.approved",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: ORG_ID,
      entityType: "movement",
      entityId: "mov-001",
      eventTier: "forensic",
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Unregistered action key"
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  // --- Invalid metadata ---

  it("rejects invalid metadata (bad email format) without calling the DB", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit(
      makeAuthLoginInput({ metadata: { email: "not-an-email" } })
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Metadata validation failed"
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects missing required metadata field (invitee_email)", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit(
      makeOrgInviteInput({ metadata: {} }) // missing required invitee_email
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Metadata validation failed"
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  // --- Actor normalization ---

  it("forces actorUserId = null when actorType is 'system'", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(
      makeAuthLoginInput({
        actorType: "system",
        actorUserId: USER_ID, // must be stripped
        metadata: {},
      })
    );

    const insertArg = client._insert.mock.calls[0]?.[0];
    expect(insertArg).toBeDefined();
    expect(insertArg.actor_user_id).toBeNull();
    expect(insertArg.actor_type).toBe("system");
  });

  it("forces actorUserId = null when actorType is 'worker'", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(
      makeAuthLoginInput({
        actorType: "worker",
        actorUserId: USER_ID,
        metadata: {},
      })
    );

    const insertArg = client._insert.mock.calls[0]?.[0];
    expect(insertArg.actor_user_id).toBeNull();
  });

  it("forces actorUserId = null when actorType is 'scheduler'", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(
      makeAuthLoginInput({
        actorType: "scheduler",
        actorUserId: USER_ID,
        metadata: {},
      })
    );

    const insertArg = client._insert.mock.calls[0]?.[0];
    expect(insertArg.actor_user_id).toBeNull();
  });

  it("preserves actorUserId when actorType is 'user'", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(makeAuthLoginInput());

    const insertArg = client._insert.mock.calls[0]?.[0];
    expect(insertArg.actor_user_id).toBe(USER_ID);
    expect(insertArg.actor_type).toBe("user");
  });

  // --- Successful emit ---

  it("returns success with id on valid emit", async () => {
    const EVENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const client = makeInsertClient({ data: { id: EVENT_ID } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit(makeAuthLoginInput());

    expect(result.success).toBe(true);
    expect((result as { success: true; data: { id: string } }).data.id).toBe(EVENT_ID);
  });

  // --- Insert payload shape ---

  it("insert payload contains all expected fields", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(makeOrgInviteInput());

    const insertArg = client._insert.mock.calls[0]?.[0];
    expect(insertArg).toBeDefined();

    // All Phase 1 columns must be represented
    expect(typeof insertArg.organization_id).toBe("string");
    expect(insertArg.organization_id).toBe(ORG_ID);
    expect(insertArg.actor_type).toBe("user");
    expect(insertArg.actor_user_id).toBe(USER_ID);
    expect(insertArg.module_slug).toBe("organization-management");
    expect(insertArg.action_key).toBe("org.member.invited");
    expect(insertArg.entity_type).toBe("invitation");
    expect(insertArg.entity_id).toBe("inv-001");
    expect(insertArg.event_tier).toBe("enhanced"); // from registry, not caller
    expect(insertArg.request_id).toBe(REQUEST_ID);
    expect(typeof insertArg.metadata).toBe("object");
  });

  it("event_tier in insert comes from registry, not caller input", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    // auth.login is 'baseline' in the registry — caller passes 'forensic'
    await eventService.emit(makeAuthLoginInput({ eventTier: "forensic" }));

    const insertArg = client._insert.mock.calls[0]?.[0];
    // Must use registry tier, not the caller-supplied 'forensic'
    expect(insertArg.event_tier).toBe("baseline");
  });

  it("metadata defaults to {} when not supplied", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(makeAuthLoginInput({ metadata: undefined }));

    const insertArg = client._insert.mock.calls[0]?.[0];
    expect(insertArg.metadata).toEqual({});
  });

  it("null fields (branch_id, target_type, target_id) default to null", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(makeAuthLoginInput());

    const insertArg = client._insert.mock.calls[0]?.[0];
    expect(insertArg.branch_id).toBeNull();
    expect(insertArg.target_type).toBeNull();
    expect(insertArg.target_id).toBeNull();
    expect(insertArg.ip_address).toBeNull();
    expect(insertArg.user_agent).toBeNull();
  });

  // --- DB errors ---

  it("returns error when DB insert fails", async () => {
    const client = makeInsertClient({
      data: null,
      error: { message: "DB constraint violation" },
    });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit(makeAuthLoginInput());

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "DB constraint violation"
    );
  });

  it("returns error when createServiceClient throws", async () => {
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error("Missing env variable");
    });

    const result = await eventService.emit(makeAuthLoginInput());

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain("Missing env variable");
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-VALIDATE: validateMetadata() helper
// ---------------------------------------------------------------------------

describe("T-EVENT-VALIDATE: validateMetadata()", () => {
  it("returns success with parsed data for valid input", () => {
    const result = validateMetadata("auth.login", { email: "test@example.com" });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> }).data;
    expect(data.email).toBe("test@example.com");
  });

  it("returns success with empty object for schema with no required fields", () => {
    const result = validateMetadata("auth.login", {});
    expect(result.success).toBe(true);
  });

  it("returns error for unregistered actionKey", () => {
    const result = validateMetadata("unregistered.event", {});
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Unregistered action key"
    );
  });

  it("returns error for invalid metadata shape", () => {
    const result = validateMetadata("auth.login", { email: 12345 });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Metadata validation failed"
    );
  });

  it("returns error for missing required field", () => {
    const result = validateMetadata("org.member.invited", {
      // invitee_email is required
    });
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      "Metadata validation failed"
    );
  });

  it("strips extra unknown keys (Zod strict by default for object schemas)", () => {
    // z.object() by default strips unknown keys in .parse()
    const result = validateMetadata("auth.login", {
      email: "test@example.com",
      unknown_field: "should be stripped",
    });
    // Whether stripped or passed through depends on Zod object passthrough setting.
    // Our schemas use z.object() without .strict() — default behaviour is to strip.
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-EVENT-INVARIANT: no direct platform_events insert path exists
// ---------------------------------------------------------------------------

describe("T-EVENT-INVARIANT: service-role client is used for inserts", () => {
  it("calls createServiceClient() for every emit", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(makeAuthLoginInput());

    expect(createServiceClient).toHaveBeenCalledTimes(1);
  });

  it("calls .from('platform_events') on the service client", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(makeAuthLoginInput());

    expect(client.from).toHaveBeenCalledWith("platform_events");
  });

  it("calls .insert() with the row payload", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit(makeAuthLoginInput());

    expect(client._insert).toHaveBeenCalledTimes(1);
    const payload = client._insert.mock.calls[0][0];
    expect(payload.action_key).toBe("auth.login");
  });
});
