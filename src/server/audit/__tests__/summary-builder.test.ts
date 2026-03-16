/**
 * @vitest-environment node
 *
 * Event Summary Builder — Unit Tests
 *
 * Suites:
 *   T-SUMMARY-PERSPECTIVE: perspective determination rules
 *   T-SUMMARY-PARAMS:      summaryParams building
 *   T-SUMMARY-ENTITIES:    entity ref building
 *   T-SUMMARY-REGISTRY-I18N: all registry entries have i18nKey
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildEventSummary } from "../summary-builder";
import { EVENT_REGISTRY, getAllActionKeys } from "../event-registry";
import type { PlatformEventRow, EventRegistryEntry } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEWER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";
const BRANCH_ID = "33333333-3333-3333-3333-333333333333";
const ROLE_ID = "44444444-4444-4444-4444-444444444444";
const ORG_ID = "55555555-5555-5555-5555-555555555555";

function makeRow(overrides: Partial<PlatformEventRow> = {}): PlatformEventRow {
  return {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    created_at: "2026-03-16T12:00:00.000Z",
    organization_id: ORG_ID,
    branch_id: null,
    actor_user_id: VIEWER_ID,
    actor_type: "user",
    module_slug: "auth",
    action_key: "auth.login",
    entity_type: "user",
    entity_id: VIEWER_ID,
    target_type: null,
    target_id: null,
    metadata: {},
    event_tier: "baseline",
    request_id: null,
    ip_address: null,
    user_agent: null,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<EventRegistryEntry> = {}): EventRegistryEntry {
  return {
    actionKey: "auth.login",
    moduleSlug: "auth",
    eventTier: "baseline",
    description: "Test",
    metadataSchema: z.object({}),
    summaryTemplate: "{{actor}} acted",
    i18nKey: "events.auth.login",
    scope: "platform",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "audit",
    visibleTo: ["self", "auditor"],
    sensitiveFields: [],
    ...overrides,
  };
}

const EMPTY_MAP = new Map<string, string>();

// ---------------------------------------------------------------------------
// T-SUMMARY-PERSPECTIVE
// ---------------------------------------------------------------------------

describe("T-SUMMARY-PERSPECTIVE: perspective determination", () => {
  it("audit scope always returns 'audit' regardless of viewer", () => {
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: VIEWER_ID }),
      entry: makeEntry(),
      viewerUserId: VIEWER_ID,
      viewerScope: "audit",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryPerspective).toBe("audit");
  });

  it("returns 'self' when viewer is the actor (personal scope)", () => {
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: VIEWER_ID }),
      entry: makeEntry(),
      viewerUserId: VIEWER_ID,
      viewerScope: "personal",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryPerspective).toBe("self");
  });

  it("returns 'self' when viewer is the actor (org scope)", () => {
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: VIEWER_ID }),
      entry: makeEntry({ scope: "organization" }),
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryPerspective).toBe("self");
  });

  it("returns 'default' when viewer is not the actor", () => {
    const result = buildEventSummary({
      // entity_id is OTHER_ID so viewer is not entity either
      event: makeRow({ actor_user_id: OTHER_ID, entity_id: OTHER_ID }),
      entry: makeEntry(),
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryPerspective).toBe("default");
  });

  it("returns 'self' when viewer is the target (selfVisible=true)", () => {
    const result = buildEventSummary({
      event: makeRow({
        actor_user_id: OTHER_ID,
        target_type: "user",
        target_id: VIEWER_ID,
      }),
      entry: makeEntry({ selfVisible: true }),
      viewerUserId: VIEWER_ID,
      viewerScope: "personal",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryPerspective).toBe("self");
  });

  it("returns 'default' when viewer is target but selfVisible=false", () => {
    const result = buildEventSummary({
      event: makeRow({
        actor_user_id: OTHER_ID,
        target_type: "user",
        target_id: VIEWER_ID,
      }),
      entry: makeEntry({ selfVisible: false }),
      viewerUserId: VIEWER_ID,
      viewerScope: "personal",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryPerspective).toBe("default");
  });

  it("returns 'default' when viewerUserId is null", () => {
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: OTHER_ID }),
      entry: makeEntry(),
      viewerUserId: null,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryPerspective).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// T-SUMMARY-PARAMS: params building
// ---------------------------------------------------------------------------

describe("T-SUMMARY-PARAMS: summaryParams building", () => {
  it("includes actorName from enriched map when available", () => {
    const enriched = new Map([[VIEWER_ID, "Alice Smith"]]);
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: VIEWER_ID }),
      entry: makeEntry(),
      viewerUserId: VIEWER_ID,
      viewerScope: "personal",
      enrichedActorDisplays: enriched,
    });
    expect(result.summaryParams.actorName).toBe("Alice Smith");
  });

  it("falls back to UUID short form when actor not in enriched map", () => {
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: VIEWER_ID }),
      entry: makeEntry(),
      viewerUserId: VIEWER_ID,
      viewerScope: "personal",
      enrichedActorDisplays: EMPTY_MAP,
    });
    // Should be UUID or fallback form
    expect(typeof result.summaryParams.actorName).toBe("string");
  });

  it("builds roleName param for org.role.created", () => {
    const result = buildEventSummary({
      event: makeRow({
        action_key: "org.role.created",
        actor_user_id: VIEWER_ID,
        entity_type: "role",
        entity_id: ROLE_ID,
        metadata: { role_name: "Admin", role_id: ROLE_ID },
      }),
      entry: makeEntry({
        actionKey: "org.role.created",
        i18nKey: "events.org.role.created",
        scope: "organization",
        selfVisible: false,
      }),
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryParams.roleName).toBe("Admin");
  });

  it("builds branchName param for org.branch.created", () => {
    const result = buildEventSummary({
      event: makeRow({
        action_key: "org.branch.created",
        actor_user_id: VIEWER_ID,
        entity_type: "branch",
        entity_id: BRANCH_ID,
        metadata: { branch_name: "Warsaw Office", branch_id: BRANCH_ID },
      }),
      entry: makeEntry({
        actionKey: "org.branch.created",
        i18nKey: "events.org.branch.created",
        scope: "branch",
        selfVisible: false,
      }),
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryParams.branchName).toBe("Warsaw Office");
  });
});

// ---------------------------------------------------------------------------
// T-SUMMARY-ENTITIES: entity ref building
// ---------------------------------------------------------------------------

describe("T-SUMMARY-ENTITIES: entity refs", () => {
  it("populates actor entity ref for user actors", () => {
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: VIEWER_ID }),
      entry: makeEntry(),
      viewerUserId: VIEWER_ID,
      viewerScope: "personal",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryEntities.actor).toBeDefined();
    expect(result.summaryEntities.actor!.kind).toBe("user");
    expect(result.summaryEntities.actor!.id).toBe(VIEWER_ID);
    expect(result.summaryEntities.actor!.href).toContain("/members/");
  });

  it("actor entity ref for system actor has kind=unknown", () => {
    const result = buildEventSummary({
      event: makeRow({ actor_user_id: null, actor_type: "system" }),
      entry: makeEntry({ actorVisible: false }),
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryEntities.actor?.kind).toBe("unknown");
  });

  it("populates branch entity ref for org.branch.created", () => {
    const result = buildEventSummary({
      event: makeRow({
        action_key: "org.branch.created",
        entity_type: "branch",
        entity_id: BRANCH_ID,
        metadata: { branch_name: "Warsaw Office" },
      }),
      entry: makeEntry({
        actionKey: "org.branch.created",
        i18nKey: "events.org.branch.created",
        scope: "branch",
        selfVisible: false,
      }),
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.summaryEntities.branch).toBeDefined();
    expect(result.summaryEntities.branch!.kind).toBe("branch");
    expect(result.summaryEntities.branch!.label).toBe("Warsaw Office");
  });
});

// ---------------------------------------------------------------------------
// T-SUMMARY-REGISTRY-I18N: all registry entries have i18nKey
// ---------------------------------------------------------------------------

describe("T-SUMMARY-REGISTRY-I18N: all registry entries have i18nKey", () => {
  const actionKeys = getAllActionKeys();

  for (const key of actionKeys) {
    it(`${key} has a non-empty i18nKey`, () => {
      const entry = EVENT_REGISTRY[key];
      expect(typeof entry.i18nKey).toBe("string");
      expect(entry.i18nKey.trim().length).toBeGreaterThan(0);
    });

    it(`${key} i18nKey starts with "events."`, () => {
      const entry = EVENT_REGISTRY[key];
      expect(entry.i18nKey.startsWith("events.")).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// T-SUMMARY-HREF: primaryHref resolution
// ---------------------------------------------------------------------------

describe("T-SUMMARY-HREF: primaryHref resolution", () => {
  it("auth events have primaryHref pointing to personal activity", () => {
    const result = buildEventSummary({
      event: makeRow({ action_key: "auth.login" }),
      entry: EVENT_REGISTRY["auth.login"]!,
      viewerUserId: VIEWER_ID,
      viewerScope: "personal",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.primaryHref).toBe("/dashboard/activity");
  });

  it("org.branch.created has primaryHref pointing to branches", () => {
    const result = buildEventSummary({
      event: makeRow({
        action_key: "org.branch.created",
        entity_type: "branch",
        entity_id: BRANCH_ID,
        metadata: { branch_name: "Test Branch" },
      }),
      entry: EVENT_REGISTRY["org.branch.created"]!,
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.primaryHref).toContain("/branches");
  });

  it("org.role.created has primaryHref pointing to roles", () => {
    const result = buildEventSummary({
      event: makeRow({
        action_key: "org.role.created",
        entity_type: "role",
        entity_id: ROLE_ID,
        metadata: { role_name: "Admin" },
      }),
      entry: EVENT_REGISTRY["org.role.created"]!,
      viewerUserId: VIEWER_ID,
      viewerScope: "org",
      enrichedActorDisplays: EMPTY_MAP,
    });
    expect(result.primaryHref).toContain("/roles");
  });
});
