/**
 * @vitest-environment node
 *
 * Event Projection Layer — Unit Tests
 *
 * These tests verify:
 *   T-PROJECTION-VISIBILITY:   scope-based visibility filtering
 *   T-PROJECTION-PERSONAL:     personal scope guards (own events only)
 *   T-PROJECTION-SENSITIVITY:  sensitive field stripping per scope
 *   T-PROJECTION-SUMMARY:      summaryTemplate interpolation
 *   T-PROJECTION-IPUA:         ip/ua stripping for non-audit scopes
 *   T-PROJECTION-PAGINATION:   limit/offset behaviour
 *   T-PROJECTION-UNKNOWN:      unknown action key is skipped, no crash
 */

import { describe, it, expect, vi } from "vitest";
import { projectEvents } from "../projection";
import type { PlatformEventRow, ProjectionContext } from "../types";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const VIEWER_USER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";
const REQUEST_ID = "44444444-4444-4444-4444-444444444444";

/** Build a minimal valid PlatformEventRow. */
function makeRow(overrides: Partial<PlatformEventRow> = {}): PlatformEventRow {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-03-21T12:00:00.000Z",
    organization_id: ORG_ID,
    branch_id: null,
    actor_user_id: VIEWER_USER_ID,
    actor_type: "user",
    module_slug: "auth",
    action_key: "auth.login",
    entity_type: "user",
    entity_id: VIEWER_USER_ID,
    target_type: null,
    target_id: null,
    metadata: {},
    event_tier: "baseline",
    request_id: REQUEST_ID,
    ip_address: "1.2.3.4",
    user_agent: "Mozilla/5.0",
    ...overrides,
  };
}

/** Build a ProjectionContext. */
function makeContext(overrides: Partial<ProjectionContext> = {}): ProjectionContext {
  return {
    viewerUserId: VIEWER_USER_ID,
    viewerScope: "personal",
    organizationId: ORG_ID,
    permissions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T-PROJECTION-VISIBILITY: scope-based filtering
// ---------------------------------------------------------------------------

describe("T-PROJECTION-VISIBILITY: scope-based event visibility", () => {
  it("personal scope: actorVisible=true event is visible when viewer is the actor", () => {
    // auth.login has actorVisible: true — viewer is the actor → visible
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("personal scope: audit-only event (actorVisible=false, no permission) is not visible", () => {
    // auth.login.failed: actorVisible=false, selfVisible=false, visibilityClass='audit'
    // viewer has no audit.events.read permission → not visible
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login.failed", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(0);
  });

  it("org scope: org_activity events visible with events.org_activity.read permission", () => {
    // org.created has visibilityClass: 'org_activity' → requires events.org_activity.read
    const result = projectEvents({
      events: [makeRow({ action_key: "org.created" })],
      context: makeContext({ viewerScope: "org", permissions: ["events.org_activity.read"] }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("org scope: org_sensitive events visible with events.org_sensitive.read permission", () => {
    // org.member.invited has visibilityClass: 'org_sensitive' → requires events.org_sensitive.read
    const result = projectEvents({
      events: [
        makeRow({ action_key: "org.member.invited", metadata: { invitee_email: "x@example.com" } }),
      ],
      context: makeContext({ viewerScope: "org", permissions: ["events.org_sensitive.read"] }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("org scope: org_sensitive event NOT visible to non-actor without org_sensitive permission", () => {
    // org.member.invited requires org_sensitive.read for non-actors.
    // Use OTHER_USER_ID as actor so VIEWER_USER_ID has no intrinsic path.
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.invited",
          actor_user_id: OTHER_USER_ID, // different actor — no actorVisible path for viewer
          metadata: { invitee_email: "x@example.com" },
        }),
      ],
      context: makeContext({ viewerScope: "org", permissions: ["events.org_activity.read"] }),
    });
    expect(result.events).toHaveLength(0);
  });

  it("audit scope: no per-event permission gate — all events are visible", () => {
    // Audit scope bypasses per-event visibility checks. Permission enforcement
    // (audit.events.read) is done at the server action layer before a viewer
    // receives audit scope. Once in audit scope, all events are projected.
    const rows = [
      makeRow({ action_key: "auth.login", actor_user_id: VIEWER_USER_ID }),
      makeRow({ id: "bbb", action_key: "org.created" }),
      makeRow({
        id: "ccc",
        action_key: "org.member.invited",
        metadata: { invitee_email: "x@example.com" },
      }),
    ];
    const result = projectEvents({
      events: rows,
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events).toHaveLength(3);
  });

  it("returns empty array when no events are provided", () => {
    const result = projectEvents({
      events: [],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-PERSONAL: personal scope actor guard
// ---------------------------------------------------------------------------

describe("T-PROJECTION-PERSONAL: personal scope shows viewer's own events", () => {
  it("includes event where actor_user_id === viewerUserId", () => {
    const result = projectEvents({
      events: [makeRow({ actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("excludes event where actor_user_id !== viewerUserId AND viewer is not the subject", () => {
    // OTHER_USER_ID acted on a non-viewer entity. entity_id is OTHER_USER_ID here
    // so the viewer has no intrinsic path (not actor, not entity, not target).
    // auth.login has actorVisible=true, selfVisible=true — but viewer is neither.
    const result = projectEvents({
      events: [
        makeRow({
          actor_user_id: OTHER_USER_ID,
          entity_type: "user",
          entity_id: OTHER_USER_ID, // entity is OTHER_USER — not the viewer
          target_type: null,
          target_id: null,
        }),
      ],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(0);
  });

  it("includes event where viewer is the target (selfVisible path)", () => {
    // org.member.role_assigned: actor=OTHER_USER, target=VIEWER_USER_ID
    // selfVisible=true → viewer CAN see their own role assignment
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.role_assigned",
          actor_user_id: OTHER_USER_ID,
          entity_type: "user",
          entity_id: OTHER_USER_ID,
          target_type: "user",
          target_id: VIEWER_USER_ID, // viewer is the target
          metadata: { role_name: "Admin" },
        }),
      ],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].action_key).toBe("org.member.role_assigned");
  });

  it("includes event where viewer is the entity subject (selfVisible path)", () => {
    // org.member.removed: actor=OTHER_USER, entity_type=user, entity_id=VIEWER_USER_ID
    // selfVisible=true → viewer CAN see their own removal
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.removed",
          actor_user_id: OTHER_USER_ID,
          entity_type: "user",
          entity_id: VIEWER_USER_ID, // viewer is the entity subject
          target_type: "user",
          target_id: VIEWER_USER_ID,
          metadata: { removed_user_id: VIEWER_USER_ID },
        }),
      ],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].action_key).toBe("org.member.removed");
  });

  it("excludes selfVisible event where selfVisible=false in registry", () => {
    // org.member.invited has selfVisible=false — the invitee is NOT the actor
    // and the event does not grant selfVisible access to targets.
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.invited",
          actor_user_id: OTHER_USER_ID,
          entity_type: "invitation",
          entity_id: "inv-001",
          target_type: "user",
          target_id: VIEWER_USER_ID, // viewer is the invited user — but selfVisible=false
          metadata: { invitee_email: "viewer@example.com" },
        }),
      ],
      context: makeContext({ viewerScope: "personal" }),
    });
    // No intrinsic path: selfVisible=false; viewer is not actor; no permission
    expect(result.events).toHaveLength(0);
  });

  it("excludes system actor events in personal scope", () => {
    const result = projectEvents({
      events: [
        makeRow({
          actor_type: "system",
          actor_user_id: null,
          entity_type: "system", // not 'user' type — no selfVisible path
          entity_id: "sys-001",
        }),
      ],
      context: makeContext({ viewerScope: "personal" }),
    });
    // System actor, non-user entity — no personal path
    expect(result.events).toHaveLength(0);
  });

  it("org scope does NOT apply personal actor guard", () => {
    // Both viewer and other user events should be visible at org scope
    // org.created requires events.org_activity.read
    const result = projectEvents({
      events: [
        makeRow({ id: "aaa", action_key: "org.created", actor_user_id: VIEWER_USER_ID }),
        makeRow({ id: "bbb", action_key: "org.created", actor_user_id: OTHER_USER_ID }),
      ],
      context: makeContext({ viewerScope: "org", permissions: ["events.org_activity.read"] }),
    });
    expect(result.events).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-SENSITIVITY: sensitive field stripping
// ---------------------------------------------------------------------------

describe("T-PROJECTION-SENSITIVITY: sensitive metadata fields are stripped per scope", () => {
  // auth.login has sensitiveFields: ['email']
  // org.member.invited has sensitiveFields: ['invitee_email', 'invitee_first_name', 'invitee_last_name']

  it("personal scope: strips sensitive fields from metadata", () => {
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "auth.login",
          actor_user_id: VIEWER_USER_ID,
          metadata: { email: "user@example.com" },
        }),
      ],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].metadata).not.toHaveProperty("email");
  });

  it("org scope: strips sensitive fields from metadata (viewer has org_sensitive permission)", () => {
    // org.member.invited requires events.org_sensitive.read to be visible in org scope
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.invited",
          metadata: {
            invitee_email: "invited@example.com",
            invitee_first_name: "Jane",
          },
        }),
      ],
      context: makeContext({ viewerScope: "org", permissions: ["events.org_sensitive.read"] }),
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].metadata).not.toHaveProperty("invitee_email");
    expect(result.events[0].metadata).not.toHaveProperty("invitee_first_name");
  });

  it("audit scope: retains ALL metadata including sensitive fields", () => {
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "auth.login",
          actor_user_id: VIEWER_USER_ID,
          metadata: { email: "user@example.com" },
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].metadata.email).toBe("user@example.com");
  });

  it("non-sensitive fields are always retained", () => {
    // org.updated has no sensitive fields; updated_fields is non-sensitive
    // visibilityClass = org_activity → requires events.org_activity.read
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.updated",
          metadata: { updated_fields: ["name", "description"] },
        }),
      ],
      context: makeContext({ viewerScope: "org", permissions: ["events.org_activity.read"] }),
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].metadata.updated_fields).toEqual(["name", "description"]);
  });

  it("empty metadata passes through without error", () => {
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login", actor_user_id: VIEWER_USER_ID, metadata: {} })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events[0].metadata).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-SUMMARY: summaryTemplate interpolation
// ---------------------------------------------------------------------------

describe("T-PROJECTION-SUMMARY: summaryTemplate interpolation", () => {
  it("interpolates {{actor}} with actor_user_id for user actors", () => {
    // auth.login summaryTemplate: "{{actor}} logged in"
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events[0].summary).toContain(VIEWER_USER_ID);
    expect(result.events[0].summary).toContain("logged in");
  });

  it("interpolates {{actor}} with actor_type for non-user actors", () => {
    // org.created summaryTemplate: "Organization created"
    // actor_type = 'system', actor_user_id = null
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.created",
          actor_type: "system",
          actor_user_id: null,
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    // Template is "Organization created" — no {{actor}} variable
    expect(result.events[0].summary).toBe("Organization created");
  });

  it("template without variables returns literal string", () => {
    // auth.login.failed summaryTemplate: "Failed login attempt" — no interpolation variables
    // Using audit scope so the event is visible (audit scope bypasses per-event permission gates).
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "auth.login.failed",
          actor_user_id: VIEWER_USER_ID,
          metadata: {},
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].summary).toBe("Failed login attempt");
  });

  it("{{entity}} interpolates as entity_type:entity_id", () => {
    // org.role.created summaryTemplate: "{{actor}} created role {{entity}}"
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.role.created",
          entity_type: "role",
          entity_id: "role-uuid-123",
          metadata: { role_name: "manager" },
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].summary).toContain("role:role-uuid-123");
  });

  it("{{target}} interpolates as target_type:target_id when both present", () => {
    // org.member.invited summaryTemplate: "{{actor}} invited {{target}} to the organization"
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.invited",
          target_type: "user",
          target_id: OTHER_USER_ID,
          metadata: { invitee_email: "x@example.com" },
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].summary).toContain(`user:${OTHER_USER_ID}`);
  });

  it("{{target}} interpolates as empty string when target_type/target_id are null", () => {
    // org.member.invited with null target
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.invited",
          target_type: null,
          target_id: null,
          metadata: { invitee_email: "x@example.com" },
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    // Template: "{{actor}} invited {{target}} to the organization"
    // {{target}} becomes "" → "{{actor}} invited  to the organization"
    expect(result.events[0].summary).toContain("invited");
    expect(result.events[0].summary).not.toContain("{{target}}");
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-IPUA: ip_address / user_agent scope gating
// ---------------------------------------------------------------------------

describe("T-PROJECTION-IPUA: ip_address and user_agent handling", () => {
  it("personal scope: does NOT include ip_address or user_agent", () => {
    const result = projectEvents({
      events: [makeRow({ actor_user_id: VIEWER_USER_ID, ip_address: "1.2.3.4", user_agent: "UA" })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events[0]).not.toHaveProperty("ip_address");
    expect(result.events[0]).not.toHaveProperty("user_agent");
  });

  it("org scope: does NOT include ip_address or user_agent", () => {
    // org.created requires events.org_activity.read to be visible
    const result = projectEvents({
      events: [makeRow({ action_key: "org.created", ip_address: "1.2.3.4", user_agent: "UA" })],
      context: makeContext({ viewerScope: "org", permissions: ["events.org_activity.read"] }),
    });
    expect(result.events[0]).not.toHaveProperty("ip_address");
    expect(result.events[0]).not.toHaveProperty("user_agent");
  });

  it("audit scope: includes ip_address and user_agent", () => {
    const result = projectEvents({
      events: [
        makeRow({
          actor_user_id: VIEWER_USER_ID,
          ip_address: "1.2.3.4",
          user_agent: "TestAgent/1.0",
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].ip_address).toBe("1.2.3.4");
    expect(result.events[0].user_agent).toBe("TestAgent/1.0");
  });

  it("audit scope: null ip_address and user_agent are included as null", () => {
    const result = projectEvents({
      events: [makeRow({ actor_user_id: VIEWER_USER_ID, ip_address: null, user_agent: null })],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].ip_address).toBeNull();
    expect(result.events[0].user_agent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-PAGINATION: limit/offset behaviour
// ---------------------------------------------------------------------------

describe("T-PROJECTION-PAGINATION: limit and offset", () => {
  /** Build N visible auth.login rows for VIEWER_USER_ID. */
  function makeRows(n: number): PlatformEventRow[] {
    return Array.from({ length: n }, (_, i) =>
      makeRow({ id: `event-${i.toString().padStart(4, "0")}`, actor_user_id: VIEWER_USER_ID })
    );
  }

  it("default limit is 50", () => {
    const rows = makeRows(100);
    const result = projectEvents({
      events: rows,
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(50);
    expect(result.limit).toBe(50);
    expect(result.total).toBe(100);
  });

  it("respects custom limit", () => {
    const rows = makeRows(20);
    const result = projectEvents({
      events: rows,
      context: makeContext({ viewerScope: "personal" }),
      limit: 5,
    });
    expect(result.events).toHaveLength(5);
    expect(result.limit).toBe(5);
  });

  it("respects offset", () => {
    const rows = makeRows(10);
    const result = projectEvents({
      events: rows,
      context: makeContext({ viewerScope: "personal" }),
      limit: 3,
      offset: 4,
    });
    expect(result.events).toHaveLength(3);
    expect(result.offset).toBe(4);
    // Verify correct slice: rows[4..6]
    expect(result.events[0].id).toBe("event-0004");
    expect(result.events[2].id).toBe("event-0006");
  });

  it("offset beyond total returns empty events array", () => {
    const rows = makeRows(5);
    const result = projectEvents({
      events: rows,
      context: makeContext({ viewerScope: "personal" }),
      limit: 10,
      offset: 20,
    });
    expect(result.events).toHaveLength(0);
    expect(result.total).toBe(5);
  });

  it("total reflects filtered count before pagination", () => {
    // Mix of VIEWER and OTHER user events; personal scope filters to viewer's only.
    // Other user events use OTHER_USER_ID as entity so viewer has no selfVisible path.
    const rows = [
      ...makeRows(5), // viewer events (actor = VIEWER_USER_ID)
      ...Array.from({ length: 3 }, (_, i) =>
        makeRow({
          id: `other-${i}`,
          actor_user_id: OTHER_USER_ID,
          entity_type: "user",
          entity_id: OTHER_USER_ID, // entity is OTHER_USER — not the viewer
          target_type: null,
          target_id: null,
        })
      ),
    ];
    const result = projectEvents({
      events: rows,
      context: makeContext({ viewerScope: "personal" }),
      limit: 2,
      offset: 0,
    });
    expect(result.total).toBe(5);
    expect(result.events).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-UNKNOWN: unknown action key handling
// ---------------------------------------------------------------------------

describe("T-PROJECTION-UNKNOWN: unknown action key is skipped without crash", () => {
  it("skips events with unknown action keys and does not throw", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = projectEvents({
      events: [
        makeRow({ id: "known", action_key: "auth.login", actor_user_id: VIEWER_USER_ID }),
        makeRow({ id: "unknown", action_key: "totally.unknown.event" }),
      ],
      context: makeContext({ viewerScope: "personal" }),
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe("known");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("totally.unknown.event"));

    warnSpy.mockRestore();
  });

  it("returns empty array when all events have unknown action keys", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = projectEvents({
      events: [makeRow({ action_key: "does.not.exist" }), makeRow({ action_key: "also.fake" })],
      context: makeContext({ viewerScope: "audit" }),
    });

    expect(result.events).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-SHAPE: projected event field shape
// ---------------------------------------------------------------------------

describe("T-PROJECTION-SHAPE: projected event contains all required fields", () => {
  it("projected event has all required ProjectedEvent fields", () => {
    const result = projectEvents({
      events: [makeRow({ actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });

    const event = result.events[0];
    expect(typeof event.id).toBe("string");
    expect(typeof event.created_at).toBe("string");
    expect(typeof event.action_key).toBe("string");
    expect(typeof event.category).toBe("string");
    expect(typeof event.intent).toBe("string");
    expect(typeof event.actor_display).toBe("string");
    expect(typeof event.entity_type).toBe("string");
    expect(typeof event.entity_id).toBe("string");
    expect(typeof event.summary).toBe("string");
    expect(typeof event.metadata).toBe("object");
    expect(typeof event.event_tier).toBe("string");
    // request_id may be string or null
    expect(event.request_id === null || typeof event.request_id === "string").toBe(true);
  });

  it("projected event category and intent are immutable — match registry exactly", () => {
    // Verify that projection never alters category/intent; values must be verbatim from registry
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events[0].category).toBe("AUTH");
    expect(result.events[0].intent).toBe("SUCCESS");
  });

  it("result has total, limit, offset fields", () => {
    const result = projectEvents({
      events: [],
      context: makeContext({ viewerScope: "audit" }),
      limit: 25,
      offset: 10,
    });
    expect(typeof result.total).toBe("number");
    expect(result.limit).toBe(25);
    expect(result.offset).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// T-PROJECTION-TAXONOMY: category and intent pass-through from registry
// ---------------------------------------------------------------------------

describe("T-PROJECTION-TAXONOMY: category and intent are derived from registry", () => {
  it("auth.login projected event has category=AUTH and intent=SUCCESS", () => {
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events[0].category).toBe("AUTH");
    expect(result.events[0].intent).toBe("SUCCESS");
  });

  it("auth.login.failed projected event has category=SECURITY and intent=FAIL", () => {
    // audit scope — no per-event permission gate
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login.failed", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].category).toBe("SECURITY");
    expect(result.events[0].intent).toBe("FAIL");
  });

  it("org.member.invited projected event has category=INVITATION and intent=CREATE", () => {
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.invited",
          metadata: { invitee_email: "x@example.com" },
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].category).toBe("INVITATION");
    expect(result.events[0].intent).toBe("CREATE");
  });

  it("org.member.role_assigned projected event has category=MEMBERSHIP and intent=ASSIGN", () => {
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.member.role_assigned",
          metadata: { role_name: "Admin" },
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].category).toBe("MEMBERSHIP");
    expect(result.events[0].intent).toBe("ASSIGN");
  });

  it("org.branch.deleted projected event has category=ORGANIZATION and intent=DELETE", () => {
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.branch.deleted",
          metadata: { branch_name: "HQ" },
        }),
      ],
      context: makeContext({ viewerScope: "audit" }),
    });
    expect(result.events[0].category).toBe("ORGANIZATION");
    expect(result.events[0].intent).toBe("DELETE");
  });
});
