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
  it("personal scope: events with visibleTo=['self'] are visible", () => {
    // auth.login has visibleTo: ['self', 'auditor']
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("personal scope: events with visibleTo=['auditor'] only are not visible", () => {
    // auth.login.failed has visibleTo: ['auditor']
    // personal scope qualifiers: ['self'] — no overlap
    const result = projectEvents({
      events: [makeRow({ action_key: "auth.login.failed", actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(0);
  });

  it("org scope: events with visibleTo=['org_member', 'org_admin', 'auditor'] are visible", () => {
    // org.created has visibleTo: ['org_member', 'org_admin', 'auditor']
    const result = projectEvents({
      events: [makeRow({ action_key: "org.created" })],
      context: makeContext({ viewerScope: "org" }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("org scope: events with visibleTo=['org_admin', 'auditor'] are visible (org_admin in org qualifiers)", () => {
    // org.member.invited has visibleTo: ['org_admin', 'auditor']
    // org scope qualifiers: ['self', 'org_member', 'org_admin'] — org_admin matches
    const result = projectEvents({
      events: [
        makeRow({ action_key: "org.member.invited", metadata: { invitee_email: "x@example.com" } }),
      ],
      context: makeContext({ viewerScope: "org" }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("audit scope: all registered events are visible", () => {
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

describe("T-PROJECTION-PERSONAL: personal scope shows only viewer's own events", () => {
  it("includes event where actor_user_id === viewerUserId", () => {
    const result = projectEvents({
      events: [makeRow({ actor_user_id: VIEWER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(1);
  });

  it("excludes event where actor_user_id !== viewerUserId", () => {
    const result = projectEvents({
      events: [makeRow({ actor_user_id: OTHER_USER_ID })],
      context: makeContext({ viewerScope: "personal" }),
    });
    expect(result.events).toHaveLength(0);
  });

  it("excludes system actor events in personal scope", () => {
    const result = projectEvents({
      events: [makeRow({ actor_type: "system", actor_user_id: null })],
      context: makeContext({ viewerScope: "personal" }),
    });
    // actor_user_id is null — null !== viewerUserId — filtered out
    expect(result.events).toHaveLength(0);
  });

  it("org scope does NOT apply personal actor guard", () => {
    // Both viewer and other user events should be visible at org scope
    // org.created is visible to org_member
    const result = projectEvents({
      events: [
        makeRow({ id: "aaa", action_key: "org.created", actor_user_id: VIEWER_USER_ID }),
        makeRow({ id: "bbb", action_key: "org.created", actor_user_id: OTHER_USER_ID }),
      ],
      context: makeContext({ viewerScope: "org" }),
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

  it("org scope: strips sensitive fields from metadata", () => {
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
      context: makeContext({ viewerScope: "org" }),
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
    const result = projectEvents({
      events: [
        makeRow({
          action_key: "org.updated",
          metadata: { updated_fields: ["name", "description"] },
        }),
      ],
      context: makeContext({ viewerScope: "org" }),
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
    // auth.login.failed summaryTemplate: "Failed login attempt"
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
    const result = projectEvents({
      events: [makeRow({ action_key: "org.created", ip_address: "1.2.3.4", user_agent: "UA" })],
      context: makeContext({ viewerScope: "org" }),
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
    // Mix of VIEWER and OTHER user events; personal scope filters to viewer's only
    const rows = [
      ...makeRows(5), // viewer events
      ...Array.from(
        { length: 3 },
        (
          _,
          i // other user events
        ) => makeRow({ id: `other-${i}`, actor_user_id: OTHER_USER_ID })
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
    expect(typeof event.actor_display).toBe("string");
    expect(typeof event.entity_type).toBe("string");
    expect(typeof event.entity_id).toBe("string");
    expect(typeof event.summary).toBe("string");
    expect(typeof event.metadata).toBe("object");
    expect(typeof event.event_tier).toBe("string");
    // request_id may be string or null
    expect(event.request_id === null || typeof event.request_id === "string").toBe(true);
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
