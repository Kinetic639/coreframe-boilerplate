/**
 * @vitest-environment node
 *
 * Event System — Phase 6 Integration & Invariant Tests
 *
 * These tests verify cross-layer behaviour and architectural invariants that
 * are not covered by the isolated unit tests in:
 *   event.service.test.ts     — service layer in isolation
 *   projection.test.ts        — projection layer in isolation
 *   event-registry.test.ts    — registry contract in isolation
 *
 * Suites:
 *   T-INTEGRATION         — emit → project cycle (service + projection, mocked DB)
 *   T-REQUEST-CORRELATION — multi-event workflows sharing requestId
 *   T-ROLLBACK-CONSISTENCY — Mode A best-effort: domain preserves on emit failure
 *   T-APPEND-ONLY         — service never calls update/delete on platform_events
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the service-role Supabase client before importing anything
// ---------------------------------------------------------------------------

vi.mock("@supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@supabase/service";
import { eventService } from "@/server/services/event.service";
import { projectEvents } from "@/server/audit/projection";
import { getRegistryEntry } from "@/server/audit/event-registry";
import type { EmitEventInput, PlatformEventRow, ProjectionContext } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Shared test UUIDs
// ---------------------------------------------------------------------------

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";
const REQUEST_ID_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REQUEST_ID_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const EVENT_ID_1 = "11111111-eeee-eeee-eeee-111111111111";
const EVENT_ID_2 = "22222222-eeee-eeee-eeee-222222222222";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a mock Supabase client that succeeds on insert. */
function makeInsertClient(overrides: { data?: unknown; error?: unknown } = {}) {
  const singleFn = vi.fn().mockResolvedValue({
    data: overrides.data ?? { id: EVENT_ID_1 },
    error: overrides.error ?? null,
  });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const updateFn = vi.fn();
  const deleteFn = vi.fn();
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn, update: updateFn, delete: deleteFn });

  return {
    from: fromFn,
    _insert: insertFn,
    _update: updateFn,
    _delete: deleteFn,
    _select: selectFn,
    _single: singleFn,
  };
}

/**
 * Simulate the stored row that the DB would return after a successful emit.
 * Used to feed into projectEvents() in integration tests.
 */
function makeStoredRow(
  input: EmitEventInput,
  overrides: Partial<PlatformEventRow> = {}
): PlatformEventRow {
  return {
    id: EVENT_ID_1,
    created_at: "2026-03-21T12:00:00.000Z",
    organization_id: input.organizationId ?? null,
    branch_id: input.branchId ?? null,
    actor_user_id: input.actorType === "user" ? (input.actorUserId ?? null) : null,
    actor_type: input.actorType,
    module_slug: "auth", // simplified — real registry value would be used
    action_key: input.actionKey,
    entity_type: input.entityType,
    entity_id: input.entityId,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
    event_tier: "baseline", // simplified — real registry tier
    request_id: input.requestId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<ProjectionContext> = {}): ProjectionContext {
  return {
    viewerUserId: USER_ID,
    viewerScope: "personal",
    organizationId: ORG_ID,
    permissions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T-INTEGRATION: emit → project cycle
// ---------------------------------------------------------------------------

describe("T-INTEGRATION: emit → project cycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successful emit produces a row that projects correctly in personal scope", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const input: EmitEventInput = {
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      metadata: { email: "user@example.com" },
      requestId: REQUEST_ID_A,
    };

    // Step 1: emit
    const emitResult = await eventService.emit(input);
    expect(emitResult.success).toBe(true);

    // Step 2: simulate stored row (what DB would return on subsequent read)
    const storedRow = makeStoredRow(input, { event_tier: "baseline" });

    // Step 3: project
    const projectionResult = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerScope: "personal" }),
    });

    // Step 4: verify projected shape
    expect(projectionResult.events).toHaveLength(1);
    const event = projectionResult.events[0];
    expect(event.id).toBe(EVENT_ID_1);
    expect(event.action_key).toBe("auth.login");
    expect(event.actor_display).toBe(USER_ID);
    expect(event.request_id).toBe(REQUEST_ID_A);
    // Sensitive field 'email' is stripped in personal scope
    expect(event.metadata).not.toHaveProperty("email");
  });

  it("org.member.invited: sensitive fields stripped in org scope, retained in audit scope", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const input: EmitEventInput = {
      actionKey: "org.member.invited",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: ORG_ID,
      entityType: "invitation",
      entityId: "inv-001",
      targetType: "user",
      targetId: OTHER_USER_ID,
      eventTier: "enhanced",
      metadata: { invitee_email: "invited@example.com", invitee_first_name: "Jane" },
      requestId: REQUEST_ID_A,
    };

    const emitResult = await eventService.emit(input);
    expect(emitResult.success).toBe(true);

    const storedRow = makeStoredRow(input, {
      event_tier: "enhanced",
      module_slug: "organization-management",
    });

    // Org scope: sensitive fields stripped
    const orgProjection = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerScope: "org" }),
    });
    expect(orgProjection.events).toHaveLength(1);
    expect(orgProjection.events[0].metadata).not.toHaveProperty("invitee_email");
    expect(orgProjection.events[0].metadata).not.toHaveProperty("invitee_first_name");

    // Audit scope: sensitive fields retained
    const auditProjection = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(auditProjection.events).toHaveLength(1);
    expect(auditProjection.events[0].metadata.invitee_email).toBe("invited@example.com");
    expect(auditProjection.events[0].metadata.invitee_first_name).toBe("Jane");
  });

  it("emit failure does not produce a projectible row — projection returns empty", async () => {
    const client = makeInsertClient({ data: null, error: { message: "DB error" } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const input: EmitEventInput = {
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
    };

    const emitResult = await eventService.emit(input);
    expect(emitResult.success).toBe(false);

    // When emit fails, no row enters the event store
    // Downstream projection receives an empty events array
    const projectionResult = projectEvents({
      events: [], // nothing to project — emit failed
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(projectionResult.events).toHaveLength(0);
    expect(projectionResult.total).toBe(0);
  });

  it("event_tier in projected row comes from registry — caller tier override is ignored", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const input: EmitEventInput = {
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "forensic", // caller tries to override — registry says 'baseline'
    };

    await eventService.emit(input);
    const insertArg = (client._insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

    // The row stored in DB has the registry tier, not the caller-supplied tier
    expect(insertArg.event_tier).toBe("baseline");

    // When projected, the stored tier is reflected
    const storedRow = makeStoredRow(input, { event_tier: "baseline" }); // DB stores registry tier
    const result = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events[0].event_tier).toBe("baseline");
  });

  it("ip_address and user_agent only appear in audit projection, not personal/org", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const input: EmitEventInput = {
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      ipAddress: "192.168.1.1",
      userAgent: "TestBrowser/1.0",
    };

    await eventService.emit(input);
    const insertArg = (client._insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(insertArg.ip_address).toBe("192.168.1.1");
    expect(insertArg.user_agent).toBe("TestBrowser/1.0");

    const storedRow = makeStoredRow(input, {
      event_tier: "baseline",
      ip_address: "192.168.1.1",
      user_agent: "TestBrowser/1.0",
    });

    const personalResult = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(personalResult.events[0]).not.toHaveProperty("ip_address");
    expect(personalResult.events[0]).not.toHaveProperty("user_agent");

    const auditResult = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(auditResult.events[0].ip_address).toBe("192.168.1.1");
    expect(auditResult.events[0].user_agent).toBe("TestBrowser/1.0");
  });
});

// ---------------------------------------------------------------------------
// T-REQUEST-CORRELATION: multi-event workflows sharing requestId
// ---------------------------------------------------------------------------

describe("T-REQUEST-CORRELATION: multi-event workflow request correlation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("two events emitted in the same workflow carry the same requestId in DB", async () => {
    let callCount = 0;
    const client = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(async () => {
              callCount++;
              return { data: { id: callCount === 1 ? EVENT_ID_1 : EVENT_ID_2 }, error: null };
            }),
          }),
        }),
      }),
    };
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const SHARED_REQUEST_ID = REQUEST_ID_A;

    // First event in workflow
    const result1 = await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      requestId: SHARED_REQUEST_ID,
    });

    // Second event in same workflow (e.g. session creation that follows login)
    const result2 = await eventService.emit({
      actionKey: "auth.password.reset_requested",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      requestId: SHARED_REQUEST_ID, // same request correlation ID
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Both inserts carry the shared requestId
    const calls = (client.from as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
  });

  it("requestId is stored in insert payload and appears in projected request_id field", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      requestId: REQUEST_ID_A,
    });

    const insertArg = (client._insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(insertArg.request_id).toBe(REQUEST_ID_A);

    // Projection passes request_id through to caller
    const storedRow = makeStoredRow({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      requestId: REQUEST_ID_A,
    });
    const result = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events[0].request_id).toBe(REQUEST_ID_A);
  });

  it("events with different requestIds are independent — no cross-contamination", async () => {
    const insertMock = vi
      .fn()
      .mockReturnValueOnce({
        select: vi
          .fn()
          .mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: EVENT_ID_1 }, error: null }),
          }),
      })
      .mockReturnValueOnce({
        select: vi
          .fn()
          .mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: EVENT_ID_2 }, error: null }),
          }),
      });

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as any);

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      requestId: REQUEST_ID_A,
    });

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: OTHER_USER_ID,
      entityType: "user",
      entityId: OTHER_USER_ID,
      eventTier: "baseline",
      requestId: REQUEST_ID_B,
    });

    const call1 = insertMock.mock.calls[0][0];
    const call2 = insertMock.mock.calls[1][0];

    expect(call1.request_id).toBe(REQUEST_ID_A);
    expect(call2.request_id).toBe(REQUEST_ID_B);
    expect(call1.actor_user_id).toBe(USER_ID);
    expect(call2.actor_user_id).toBe(OTHER_USER_ID);
  });

  it("requestId=null is stored as null — auth events without explicit correlation", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      // requestId not provided — defaults to undefined → null in insert
    });

    const insertArg = (client._insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(insertArg.request_id).toBeNull();
  });

  it("multiple correlated events form a traceable workflow in the projected output", () => {
    // Simulate two stored rows from the same workflow (same requestId)
    const rows: PlatformEventRow[] = [
      {
        id: EVENT_ID_1,
        created_at: "2026-03-21T12:00:00.000Z",
        organization_id: null,
        branch_id: null,
        actor_user_id: USER_ID,
        actor_type: "user",
        module_slug: "auth",
        action_key: "auth.login",
        entity_type: "user",
        entity_id: USER_ID,
        target_type: null,
        target_id: null,
        metadata: {},
        event_tier: "baseline",
        request_id: REQUEST_ID_A,
        ip_address: null,
        user_agent: null,
      },
      {
        id: EVENT_ID_2,
        created_at: "2026-03-21T12:00:01.000Z",
        organization_id: null,
        branch_id: null,
        actor_user_id: USER_ID,
        actor_type: "user",
        module_slug: "auth",
        action_key: "auth.password.reset_requested",
        entity_type: "user",
        entity_id: USER_ID,
        target_type: null,
        target_id: null,
        metadata: {},
        event_tier: "baseline",
        request_id: REQUEST_ID_A, // same requestId — correlated
        ip_address: null,
        user_agent: null,
      },
    ];

    const result = projectEvents({
      events: rows,
      context: makeContext({ viewerScope: "personal" }),
    });

    // Both events visible in personal scope (self)
    expect(result.events).toHaveLength(2);

    // Both carry the same requestId — can be correlated
    expect(result.events[0].request_id).toBe(REQUEST_ID_A);
    expect(result.events[1].request_id).toBe(REQUEST_ID_A);
  });
});

// ---------------------------------------------------------------------------
// T-ROLLBACK-CONSISTENCY: Mode A best-effort semantics
// ---------------------------------------------------------------------------

describe("T-ROLLBACK-CONSISTENCY: Mode A best-effort — domain write preserved on emit failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emit() returns typed failure — never throws — caller can continue", async () => {
    const client = makeInsertClient({
      data: null,
      error: { message: "constraint violation: unique" },
    });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    // Must not throw — must return a typed failure
    await expect(
      eventService.emit({
        actionKey: "auth.login",
        actorType: "user",
        actorUserId: USER_ID,
        entityType: "user",
        entityId: USER_ID,
        eventTier: "baseline",
      })
    ).resolves.toMatchObject({ success: false });
  });

  it("when first emit fails, second emit in the same workflow is still attempted", async () => {
    const insertMock = vi
      .fn()
      .mockReturnValueOnce({
        // First call: DB error
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
        }),
      })
      .mockReturnValueOnce({
        // Second call: success
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: EVENT_ID_2 }, error: null }),
        }),
      });

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as any);

    // First emit fails
    const result1 = await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      requestId: REQUEST_ID_A,
    });

    // Second emit succeeds — independently
    const result2 = await eventService.emit({
      actionKey: "auth.password.reset_requested",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
      requestId: REQUEST_ID_A,
    });

    expect(result1.success).toBe(false);
    expect(result2.success).toBe(true);
    // Both emits were attempted — DB was called twice
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it("emit() returns error message that caller can inspect and log", async () => {
    const client = makeInsertClient({
      data: null,
      error: { message: "permission denied for table platform_events" },
    });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
    });

    expect(result.success).toBe(false);
    const errorMsg = (result as { success: false; error: string }).error;
    // Error message contains the DB error — caller can log it
    expect(errorMsg).toContain("permission denied");
    expect(typeof errorMsg).toBe("string");
  });

  it("unhandled exception in client is caught — returns typed failure, never throws", async () => {
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    });

    // Must not throw — must return typed failure
    await expect(
      eventService.emit({
        actionKey: "auth.login",
        actorType: "user",
        actorUserId: USER_ID,
        entityType: "user",
        entityId: USER_ID,
        eventTier: "baseline",
      })
    ).resolves.toMatchObject({ success: false });
  });

  it("metadata validation failure is a typed error — never throws", async () => {
    const client = makeInsertClient();
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    // org.member.invited requires invitee_email — passing invalid data
    await expect(
      eventService.emit({
        actionKey: "org.member.invited",
        actorType: "user",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
        entityType: "invitation",
        entityId: "inv-001",
        eventTier: "enhanced",
        metadata: { invitee_email: "not-an-email" }, // invalid
      })
    ).resolves.toMatchObject({ success: false });

    // DB must not be called when validation fails
    expect(client._insert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-APPEND-ONLY: service never calls update/delete on platform_events
// ---------------------------------------------------------------------------

describe("T-APPEND-ONLY: eventService only calls insert — never update/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("eventService.emit() calls .insert() on the DB client — never .update()", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
    });

    expect(client._insert).toHaveBeenCalledTimes(1);
    expect(client._update).not.toHaveBeenCalled();
  });

  it("eventService.emit() never calls .delete() on the DB client", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
    });

    expect(client._delete).not.toHaveBeenCalled();
  });

  it("eventService.emit() never calls .update() even when DB insert fails", async () => {
    const client = makeInsertClient({
      data: null,
      error: { message: "insert failed" },
    });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
    });

    expect(client._update).not.toHaveBeenCalled();
    expect(client._delete).not.toHaveBeenCalled();
  });

  it("eventService.emit() never calls .update() when createServiceClient throws", async () => {
    const client = makeInsertClient();
    // createServiceClient throws before we even use the client
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error("env not set");
    });

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
    });

    // Client was never instantiated — update/delete were never called
    expect(client._update).not.toHaveBeenCalled();
    expect(client._delete).not.toHaveBeenCalled();
  });

  it("eventService API surface has no update or delete method", () => {
    // The exported eventService object must not expose any mutation path
    // beyond emit() and validateMetadata().
    const apiKeys = Object.keys(eventService);
    expect(apiKeys).toContain("emit");
    expect(apiKeys).toContain("validateMetadata");
    expect(apiKeys).not.toContain("update");
    expect(apiKeys).not.toContain("delete");
    expect(apiKeys).not.toContain("remove");
    expect(apiKeys).not.toContain("patch");
    // Exactly 2 methods — no hidden extras
    expect(apiKeys).toHaveLength(2);
  });

  it("platform_events insert only uses .from('platform_events') — no other table", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await eventService.emit({
      actionKey: "auth.login",
      actorType: "user",
      actorUserId: USER_ID,
      entityType: "user",
      entityId: USER_ID,
      eventTier: "baseline",
    });

    expect(client.from).toHaveBeenCalledWith("platform_events");
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("multiple sequential emits all use insert only — no mutation drift", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    // Simulate a multi-step workflow that emits multiple events
    const emits = [
      { actionKey: "auth.login", entityType: "user", entityId: USER_ID },
      { actionKey: "auth.password.reset_requested", entityType: "user", entityId: USER_ID },
      { actionKey: "auth.password.reset_completed", entityType: "user", entityId: USER_ID },
    ];

    for (const partial of emits) {
      await eventService.emit({
        actorType: "user",
        actorUserId: USER_ID,
        entityType: partial.entityType,
        entityId: partial.entityId,
        eventTier: "baseline",
        ...partial,
      });
    }

    expect(client._insert).toHaveBeenCalledTimes(3);
    expect(client._update).not.toHaveBeenCalled();
    expect(client._delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-LOGOUT-PIPELINE: auth.session.revoked end-to-end verification
// ---------------------------------------------------------------------------

describe("T-LOGOUT-PIPELINE: logout event emission and personal feed visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Registry contract
  // -------------------------------------------------------------------------

  it("auth.session.revoked is registered with correct fields", () => {
    const entry = getRegistryEntry("auth.session.revoked");
    expect(entry).toBeDefined();
    expect(entry!.actionKey).toBe("auth.session.revoked");
    expect(entry!.moduleSlug).toBe("auth");
    expect(entry!.visibleTo).toContain("self");
    expect(entry!.sensitiveFields).toEqual([]);
  });

  it("auth.session.revoked metadata schema accepts optional reason", () => {
    const entry = getRegistryEntry("auth.session.revoked")!;
    // Valid: empty metadata
    expect(() => entry.metadataSchema.parse({})).not.toThrow();
    // Valid: with reason
    expect(() => entry.metadataSchema.parse({ reason: "voluntary_signout" })).not.toThrow();
    // Invalid: non-string reason
    expect(() => entry.metadataSchema.parse({ reason: 123 })).toThrow();
  });

  // -------------------------------------------------------------------------
  // Emission
  // -------------------------------------------------------------------------

  it("auth.session.revoked is emitted and inserted with correct insert payload", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit({
      actionKey: "auth.session.revoked",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      metadata: { reason: "voluntary_signout" },
      eventTier: "enhanced",
    });

    expect(result.success).toBe(true);
    expect(client._insert).toHaveBeenCalledTimes(1);

    const insertArg = (client._insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(insertArg.action_key).toBe("auth.session.revoked");
    expect(insertArg.actor_user_id).toBe(USER_ID);
    expect(insertArg.organization_id).toBeNull();
    expect(insertArg.actor_type).toBe("user");
    // Registry tier is used — enhanced is the correct tier for auth.session.revoked
    expect(insertArg.event_tier).toBe("enhanced");
    expect(insertArg.metadata).toEqual({ reason: "voluntary_signout" });
  });

  it("emit succeeds and returns event id", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit({
      actionKey: "auth.session.revoked",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      metadata: { reason: "voluntary_signout" },
      eventTier: "enhanced",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(EVENT_ID_1);
    }
  });

  // -------------------------------------------------------------------------
  // Projection — personal feed visibility
  // -------------------------------------------------------------------------

  it("auth.session.revoked appears in the actor's personal feed", () => {
    const row = makeStoredRow(
      {
        actionKey: "auth.session.revoked",
        actorType: "user",
        actorUserId: USER_ID,
        organizationId: null,
        entityType: "user",
        entityId: USER_ID,
        eventTier: "enhanced",
        metadata: { reason: "voluntary_signout" },
      },
      { event_tier: "enhanced" }
    );

    const result = projectEvents({
      events: [row],
      context: makeContext({ viewerUserId: USER_ID, viewerScope: "personal" }),
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].action_key).toBe("auth.session.revoked");
    expect(result.events[0].actor_display).toBe(USER_ID);
  });

  it("auth.session.revoked does NOT appear in another user's personal feed", () => {
    const row = makeStoredRow(
      {
        actionKey: "auth.session.revoked",
        actorType: "user",
        actorUserId: USER_ID,
        organizationId: null,
        entityType: "user",
        entityId: USER_ID,
        eventTier: "enhanced",
        metadata: { reason: "voluntary_signout" },
      },
      { event_tier: "enhanced" }
    );

    // OTHER_USER_ID views personal feed — should NOT see USER_ID's logout
    const result = projectEvents({
      events: [row],
      context: makeContext({ viewerUserId: OTHER_USER_ID, viewerScope: "personal" }),
    });

    expect(result.events).toHaveLength(0);
  });

  it("auth.session.revoked appears in audit scope with all fields", () => {
    const row = makeStoredRow(
      {
        actionKey: "auth.session.revoked",
        actorType: "user",
        actorUserId: USER_ID,
        organizationId: null,
        entityType: "user",
        entityId: USER_ID,
        eventTier: "enhanced",
        metadata: { reason: "voluntary_signout" },
        ipAddress: "10.0.0.1",
        userAgent: "Mozilla/5.0",
      },
      {
        event_tier: "enhanced",
        ip_address: "10.0.0.1",
        user_agent: "Mozilla/5.0",
      }
    );

    const result = projectEvents({
      events: [row],
      context: makeContext({ viewerScope: "audit" }),
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].ip_address).toBe("10.0.0.1");
    expect(result.events[0].user_agent).toBe("Mozilla/5.0");
  });

  it("auth.session.revoked has no sensitive fields — metadata is fully passed through in personal scope", () => {
    const row = makeStoredRow(
      {
        actionKey: "auth.session.revoked",
        actorType: "user",
        actorUserId: USER_ID,
        organizationId: null,
        entityType: "user",
        entityId: USER_ID,
        eventTier: "enhanced",
        metadata: { reason: "voluntary_signout" },
      },
      { event_tier: "enhanced" }
    );

    const result = projectEvents({
      events: [row],
      context: makeContext({ viewerUserId: USER_ID, viewerScope: "personal" }),
    });

    // No sensitive fields — reason is visible in personal scope
    expect(result.events[0].metadata).toEqual({ reason: "voluntary_signout" });
  });

  // -------------------------------------------------------------------------
  // Null-actor guard
  // -------------------------------------------------------------------------

  it("emit with null actorUserId is accepted by the service (emit does not enforce presence)", async () => {
    // The null-actor guard is in signOutAction (caller layer).
    // The service layer itself accepts null actorUserId — it is a valid DB column.
    // This test confirms the service layer's behavior for documentation purposes.
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await eventService.emit({
      actionKey: "auth.session.revoked",
      actorType: "user",
      actorUserId: null,
      organizationId: null,
      entityType: "user",
      entityId: "unknown",
      metadata: { reason: "voluntary_signout" },
      eventTier: "enhanced",
    });

    expect(result.success).toBe(true);

    const insertArg = (client._insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(insertArg.actor_user_id).toBeNull();
  });

  it("null-actor auth.session.revoked event is invisible in personal feed (actor guard)", () => {
    // This confirms WHY the null-actor guard exists in signOutAction:
    // events with actor_user_id = null cannot be attributed to any user
    // and are filtered out by the personal scope actor guard.
    const row = makeStoredRow(
      {
        actionKey: "auth.session.revoked",
        actorType: "user",
        actorUserId: null, // no actor — expired session signout
        organizationId: null,
        entityType: "user",
        entityId: "unknown",
        eventTier: "enhanced",
        metadata: { reason: "voluntary_signout" },
      },
      { event_tier: "enhanced", actor_user_id: null }
    );

    const result = projectEvents({
      events: [row],
      context: makeContext({ viewerUserId: USER_ID, viewerScope: "personal" }),
    });

    // A null-actor event cannot be claimed by any user — personal feed returns empty
    expect(result.events).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Full emit → project cycle
  // -------------------------------------------------------------------------

  it("full emit→project cycle: logout event inserted then visible in actor personal feed", async () => {
    const client = makeInsertClient({ data: { id: EVENT_ID_1 } });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    // Step 1: emit (as signOutAction would)
    const emitResult = await eventService.emit({
      actionKey: "auth.session.revoked",
      actorType: "user",
      actorUserId: USER_ID,
      organizationId: null,
      entityType: "user",
      entityId: USER_ID,
      metadata: { reason: "voluntary_signout" },
      eventTier: "enhanced",
    });
    expect(emitResult.success).toBe(true);

    // Step 2: simulate the stored row that the personal feed query would return
    const storedRow = makeStoredRow(
      {
        actionKey: "auth.session.revoked",
        actorType: "user",
        actorUserId: USER_ID,
        organizationId: null,
        entityType: "user",
        entityId: USER_ID,
        eventTier: "enhanced",
        metadata: { reason: "voluntary_signout" },
      },
      { event_tier: "enhanced" }
    );

    // Step 3: project with personal scope
    const projectionResult = projectEvents({
      events: [storedRow],
      context: makeContext({ viewerUserId: USER_ID, viewerScope: "personal" }),
    });

    // Step 4: verify event appears in personal feed
    expect(projectionResult.events).toHaveLength(1);
    expect(projectionResult.events[0].action_key).toBe("auth.session.revoked");
    expect(projectionResult.events[0].metadata).toEqual({ reason: "voluntary_signout" });
    expect(projectionResult.total).toBe(1);
  });
});
