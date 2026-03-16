/**
 * @vitest-environment node
 *
 * Central Event Visibility Evaluator — Unit Tests
 *
 * Tests for canViewerSeeEvent() in src/server/audit/visibility.ts
 *
 * Suites:
 *   T-VIS-ACTOR:       Intrinsic actor visibility
 *   T-VIS-SELF:        Intrinsic self visibility (entity/target match)
 *   T-VIS-PERMISSION:  Permission-based visibility per class
 *   T-VIS-SCOPE:       Scope-aware evaluation (platform / org / branch)
 *   T-VIS-DENY:        Denial cases (no perms, unknown entry, null viewer)
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { canViewerSeeEvent } from "../visibility";
import { getRegistryEntry } from "../event-registry";
import type { PlatformEventRow, EventRegistryEntry } from "../types";
import type { VisibilityInput } from "../visibility";

// ---------------------------------------------------------------------------
// Test UUIDs
// ---------------------------------------------------------------------------

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const BRANCH_ID = "22222222-2222-2222-2222-222222222222";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<PlatformEventRow> = {}): PlatformEventRow {
  return {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    created_at: "2026-03-16T12:00:00.000Z",
    organization_id: ORG_ID,
    branch_id: null,
    actor_user_id: USER_A,
    actor_type: "user",
    module_slug: "auth",
    action_key: "auth.login",
    entity_type: "user",
    entity_id: USER_A,
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

/** Build a minimal registry entry for testing. */
function makeEntry(overrides: Partial<EventRegistryEntry> = {}): EventRegistryEntry {
  return {
    actionKey: "auth.login",
    moduleSlug: "auth",
    eventTier: "baseline",
    description: "Test event",
    metadataSchema: z.object({}),
    summaryTemplate: "{{actor}} acted",
    scope: "platform",
    actorVisible: true,
    selfVisible: true,
    visibilityClass: "audit",
    visibleTo: ["self", "auditor"],
    sensitiveFields: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<VisibilityInput> = {}): VisibilityInput {
  return {
    viewer: { userId: USER_A, permissions: [] },
    event: makeRow(),
    entry: makeEntry(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T-VIS-DENY: denial when entry is unknown
// ---------------------------------------------------------------------------

describe("T-VIS-DENY: unknown entry is always denied", () => {
  it("returns false when entry is null", () => {
    expect(canViewerSeeEvent(makeInput({ entry: null }))).toBe(false);
  });

  it("returns false when entry is undefined", () => {
    expect(canViewerSeeEvent(makeInput({ entry: undefined }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-ACTOR: intrinsic actor visibility
// ---------------------------------------------------------------------------

describe("T-VIS-ACTOR: viewer is the actor", () => {
  it("returns true when actorVisible=true and viewer.userId === actor_user_id", () => {
    const input = makeInput({
      viewer: { userId: USER_A, permissions: [] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({ actorVisible: true, selfVisible: false, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("returns false when actorVisible=false even if viewer is the actor", () => {
    const input = makeInput({
      viewer: { userId: USER_A, permissions: [] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({ actorVisible: false, selfVisible: false, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("returns false when viewer.userId !== actor_user_id (different actor)", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({ actorVisible: true, selfVisible: false, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("returns false when viewer.userId is null (unidentified viewer)", () => {
    const input = makeInput({
      viewer: { userId: null, permissions: [] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({ actorVisible: true, selfVisible: false, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("returns false when event.actor_user_id is null (system actor)", () => {
    const input = makeInput({
      viewer: { userId: USER_A, permissions: [] },
      event: makeRow({ actor_user_id: null, actor_type: "system" }),
      entry: makeEntry({ actorVisible: true, selfVisible: false, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-SELF: intrinsic self visibility
// ---------------------------------------------------------------------------

describe("T-VIS-SELF: event is about the viewer", () => {
  it("returns true when selfVisible=true and entity_type=user + entity_id === viewer.userId", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] },
      event: makeRow({
        actor_user_id: USER_A, // different actor
        entity_type: "user",
        entity_id: USER_B, // viewer is the subject
      }),
      entry: makeEntry({ actorVisible: false, selfVisible: true, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("returns true when selfVisible=true and target_type=user + target_id === viewer.userId", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] },
      event: makeRow({
        actor_user_id: USER_A, // different actor
        entity_type: "invitation",
        entity_id: "inv-001",
        target_type: "user",
        target_id: USER_B, // viewer is the target
      }),
      entry: makeEntry({ actorVisible: false, selfVisible: true, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("returns false when selfVisible=false even if entity_id matches viewer", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] },
      event: makeRow({ actor_user_id: USER_A, entity_type: "user", entity_id: USER_B }),
      entry: makeEntry({ actorVisible: false, selfVisible: false, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("returns false when entity_type is not 'user' even if entity_id matches", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] },
      event: makeRow({
        actor_user_id: USER_A,
        entity_type: "invitation", // not 'user'
        entity_id: USER_B,
      }),
      entry: makeEntry({ actorVisible: false, selfVisible: true, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("returns false when viewer.userId is null for self check", () => {
    const input = makeInput({
      viewer: { userId: null, permissions: [] },
      event: makeRow({ entity_type: "user", entity_id: USER_A }),
      entry: makeEntry({ actorVisible: false, selfVisible: true, visibilityClass: undefined }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-PERMISSION: permission-based visibility
// ---------------------------------------------------------------------------

describe("T-VIS-PERMISSION: permission-class gating", () => {
  it("org_activity class: viewer with events.org_activity.read can see event", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "organization",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("org_activity class: viewer without permission is denied", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "organization",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("org_sensitive class: viewer with events.org_sensitive.read can see event", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_sensitive.read"] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "organization",
        visibilityClass: "org_sensitive",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("org_sensitive class: viewer with only org_activity permission is denied", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "organization",
        visibilityClass: "org_sensitive",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("audit class: viewer with audit.events.read can see event", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["audit.events.read"] },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "platform",
        visibilityClass: "audit",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("audit class: viewer without audit.events.read is denied", () => {
    const input = makeInput({
      viewer: {
        userId: USER_B,
        permissions: ["events.org_activity.read", "events.org_sensitive.read"],
      },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "platform",
        visibilityClass: "audit",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("no visibilityClass and no intrinsic match → denied (even with org_activity permission)", () => {
    // Having a permission is not enough if the entry has no visibilityClass set.
    // Note: audit.events.read is intentionally NOT included — that would trigger the audit superpower.
    const input = makeInput({
      viewer: {
        userId: USER_B,
        permissions: ["events.org_activity.read", "events.org_sensitive.read"],
      },
      event: makeRow({ actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        visibilityClass: undefined,
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-SCOPE: scope-aware evaluation
// ---------------------------------------------------------------------------

describe("T-VIS-SCOPE: platform / organization / branch scopes", () => {
  it("platform scope: permission holder sees event regardless of org context", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["audit.events.read"] },
      event: makeRow({ organization_id: null, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "platform",
        visibilityClass: "audit",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("organization scope: permission holder sees event", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
      event: makeRow({ organization_id: ORG_ID, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "organization",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("branch scope: viewer with org-wide permission sees branch event", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
      event: makeRow({ organization_id: ORG_ID, branch_id: BRANCH_ID, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "branch",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("branch scope: viewer without permission is denied", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] },
      event: makeRow({ organization_id: ORG_ID, branch_id: BRANCH_ID, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "branch",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("branch scope: org_sensitive permission required for sensitive branch events", () => {
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_sensitive.read"] },
      event: makeRow({ organization_id: ORG_ID, branch_id: BRANCH_ID, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "branch",
        visibilityClass: "org_sensitive",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-REAL: spot-checks against actual registry entries
// ---------------------------------------------------------------------------

describe("T-VIS-REAL: spot-checks with actual registry entries", () => {
  it("auth.login: actor sees own login event without permissions", () => {
    const entry = getRegistryEntry("auth.login");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_A, permissions: [] },
        event: makeRow({ action_key: "auth.login", actor_user_id: USER_A }),
        entry,
      })
    ).toBe(true);
  });

  it("auth.login: different user cannot see login event without audit permission", () => {
    const entry = getRegistryEntry("auth.login");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: [] },
        event: makeRow({ action_key: "auth.login", actor_user_id: USER_A }),
        entry,
      })
    ).toBe(false);
  });

  it("auth.login: auditor with audit.events.read can see any login event", () => {
    const entry = getRegistryEntry("auth.login");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: ["audit.events.read"] },
        event: makeRow({ action_key: "auth.login", actor_user_id: USER_A }),
        entry,
      })
    ).toBe(true);
  });

  it("auth.login.failed: no actor (system), no permissions → denied", () => {
    const entry = getRegistryEntry("auth.login.failed");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_A, permissions: [] },
        event: makeRow({
          action_key: "auth.login.failed",
          actor_user_id: null,
          actor_type: "system",
        }),
        entry,
      })
    ).toBe(false);
  });

  it("auth.login.failed: auditor can see it", () => {
    const entry = getRegistryEntry("auth.login.failed");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: ["audit.events.read"] },
        event: makeRow({
          action_key: "auth.login.failed",
          actor_user_id: null,
          actor_type: "system",
        }),
        entry,
      })
    ).toBe(true);
  });

  it("auth.session.revoked: actor sees own revocation", () => {
    const entry = getRegistryEntry("auth.session.revoked");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_A, permissions: [] },
        event: makeRow({ action_key: "auth.session.revoked", actor_user_id: USER_A }),
        entry,
      })
    ).toBe(true);
  });

  it("auth.session.revoked: different user without audit permission is denied", () => {
    const entry = getRegistryEntry("auth.session.revoked");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: [] },
        event: makeRow({ action_key: "auth.session.revoked", actor_user_id: USER_A }),
        entry,
      })
    ).toBe(false);
  });

  it("org.created: member with org_activity permission sees it", () => {
    const entry = getRegistryEntry("org.created");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
        event: makeRow({ action_key: "org.created", actor_user_id: USER_A }),
        entry,
      })
    ).toBe(true);
  });

  it("org.member.invited: viewer without org_sensitive permission is denied", () => {
    const entry = getRegistryEntry("org.member.invited");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
        event: makeRow({
          action_key: "org.member.invited",
          actor_user_id: USER_A,
          metadata: { invitee_email: "x@example.com" },
        }),
        entry,
      })
    ).toBe(false);
  });

  it("org.member.invited: actor sees their own invited event", () => {
    const entry = getRegistryEntry("org.member.invited");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_A, permissions: [] },
        event: makeRow({
          action_key: "org.member.invited",
          actor_user_id: USER_A,
          metadata: { invitee_email: "x@example.com" },
        }),
        entry,
      })
    ).toBe(true);
  });

  it("org.member.removed: target user sees their own removal (selfVisible)", () => {
    const entry = getRegistryEntry("org.member.removed");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: [] },
        event: makeRow({
          action_key: "org.member.removed",
          actor_user_id: USER_A,
          target_type: "user",
          target_id: USER_B, // USER_B is the one being removed
        }),
        entry,
      })
    ).toBe(true);
  });

  it("org.branch.created: member with org_activity sees branch event", () => {
    const entry = getRegistryEntry("org.branch.created");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
        event: makeRow({
          action_key: "org.branch.created",
          actor_user_id: USER_A,
          branch_id: BRANCH_ID,
          metadata: { branch_name: "Main Branch" },
        }),
        entry,
      })
    ).toBe(true);
  });

  it("org.branch.deleted: member without org_sensitive permission is denied", () => {
    const entry = getRegistryEntry("org.branch.deleted");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
        event: makeRow({
          action_key: "org.branch.deleted",
          actor_user_id: USER_A,
          branch_id: BRANCH_ID,
        }),
        entry,
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-BRANCH-SCOPE: branch-scope permission model documentation tests
// ---------------------------------------------------------------------------
//
// The permission snapshot is a flat string[] of concrete slugs. Branch-scope
// resolution is handled by PermissionServiceV2.getPermissionSnapshotForUser:
//   - Org-wide grants (branch_id IS NULL in user_effective_permissions) appear
//     in the snapshot regardless of active branch.
//   - Branch-specific grants appear only when that branch is the active context.
//
// These tests verify the evaluator's behaviour given a pre-resolved snapshot.
// They do NOT test the snapshot loader — that is tested in permission-v2.service.test.ts.

describe("T-VIS-BRANCH-SCOPE: branch-scope flat permission model", () => {
  const BRANCH_A = "aaaaaaaa-1111-1111-1111-111111111111";
  const BRANCH_B = "bbbbbbbb-2222-2222-2222-222222222222";

  it("org-wide grant in snapshot allows branch event (branch_id IS NULL at DB level)", () => {
    // Viewer has org-wide events.org_activity.read (snapshot loaded with any branch context).
    // Org-wide grant = permission slug present in flat array regardless of active branch.
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
      event: makeRow({ organization_id: ORG_ID, branch_id: BRANCH_A, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "branch",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("branch-specific grant appears in snapshot only when that branch is active context", () => {
    // When PermissionServiceV2 loads the snapshot with BRANCH_A active, it includes
    // org-wide slugs + BRANCH_A-specific slugs. This test simulates that state:
    // viewer has events.org_activity.read in their snapshot (could be org-wide or branch-A-specific).
    // The evaluator sees only the flat array — if the slug is present, access is granted.
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["events.org_activity.read"] },
      event: makeRow({ organization_id: ORG_ID, branch_id: BRANCH_A, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "branch",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("when permission slug absent from snapshot, branch event is denied", () => {
    // Simulates viewer whose snapshot was loaded with BRANCH_B active, but they only
    // have a branch-A-specific grant. PermissionServiceV2 would NOT include the slug
    // in the snapshot → slug absent → denied.
    const input = makeInput({
      viewer: { userId: USER_B, permissions: [] }, // slug absent from snapshot
      event: makeRow({ organization_id: ORG_ID, branch_id: BRANCH_A, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "branch",
        visibilityClass: "org_activity",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(false);
  });

  it("audit.events.read in snapshot grants access to branch events (audit superpower)", () => {
    // Auditors have org-wide audit.events.read. This grants access to all events
    // in their org — including events scoped to any branch — via the audit superpower.
    const input = makeInput({
      viewer: { userId: USER_B, permissions: ["audit.events.read"] },
      event: makeRow({ organization_id: ORG_ID, branch_id: BRANCH_B, actor_user_id: USER_A }),
      entry: makeEntry({
        actorVisible: false,
        selfVisible: false,
        scope: "branch",
        visibilityClass: "org_sensitive",
      }),
    });
    expect(canViewerSeeEvent(input)).toBe(true);
  });

  it("selfVisible path works for branch-scoped events (no permission needed)", () => {
    // org.member.role_assigned is a branch-scoped event. The target (viewer) can
    // see their own role assignment via selfVisible, even without any permission.
    const entry = getRegistryEntry("org.member.role_assigned");
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_B, permissions: [] },
        event: makeRow({
          action_key: "org.member.role_assigned",
          actor_user_id: USER_A,
          branch_id: BRANCH_A,
          target_type: "user",
          target_id: USER_B, // USER_B is the target — their role was assigned
          entity_type: "user",
          entity_id: USER_A,
          metadata: { role_name: "branch_viewer" },
        }),
        entry,
      })
    ).toBe(true);
  });
});
