/**
 * @repo/domain — Event Visibility Tests
 *
 * Tests canViewerSeeEvent() using the domain structural interfaces directly.
 * No EventRegistryEntry, no ZodTypeAny, no app registry dependencies.
 *
 * Suites:
 *   T-VIS-UNKNOWN:   Unknown / null entry → deny
 *   T-VIS-ACTOR:     actorVisible intrinsic path
 *   T-VIS-SELF:      selfVisible intrinsic path
 *   T-VIS-AUDIT:     audit.events.read superpower + scope gate
 *   T-VIS-SCOPE:     viewerScope exclusion of audit-class events
 *   T-VIS-CLASS:     permission-based visibility (visibilityClass)
 *
 * NOTE: factory defaults have selfVisible=true and entity_id=USER_A.
 * Tests that verify other paths explicitly set selfVisible=false and use
 * entity_id=ORG_ID to prevent accidental selfVisible short-circuits.
 */

import { describe, it, expect } from "vitest";
import { canViewerSeeEvent } from "../../events/visibility.js";
import {
  makeEventVisibilityRow,
  makeEventVisibilityDefinition,
  makeVisibilityInput,
} from "@repo/testing/factories/events";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ORG_ID = "11111111-1111-1111-1111-111111111111";

// A neutral event row that doesn't trigger selfVisible (entity is an org, not USER_A)
const neutralEvent = makeEventVisibilityRow({
  actor_user_id: USER_B,
  entity_type: "org",
  entity_id: ORG_ID,
  target_type: null,
  target_id: null,
});

// ---------------------------------------------------------------------------
// T-VIS-UNKNOWN: null/undefined entry → deny
// ---------------------------------------------------------------------------

describe("T-VIS-UNKNOWN: unknown entry", () => {
  it("returns false when entry is null", () => {
    expect(canViewerSeeEvent(makeVisibilityInput({ entry: null }))).toBe(false);
  });

  it("returns false when entry is undefined", () => {
    expect(canViewerSeeEvent(makeVisibilityInput({ entry: undefined }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-ACTOR: actorVisible intrinsic path
// ---------------------------------------------------------------------------

describe("T-VIS-ACTOR: actorVisible", () => {
  it("returns true when actorVisible=true and viewer is the actor", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: [] },
          event: makeEventVisibilityRow({
            actor_user_id: USER_A,
            entity_type: "org",
            entity_id: ORG_ID,
          }),
          entry: makeEventVisibilityDefinition({
            actorVisible: true,
            selfVisible: false,
            visibilityClass: undefined,
            scope: "organization",
          }),
        })
      )
    ).toBe(true);
  });

  it("returns false when actorVisible=true but viewer is different user", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_B, permissions: [] },
          event: makeEventVisibilityRow({
            actor_user_id: USER_A,
            entity_type: "org",
            entity_id: ORG_ID,
          }),
          entry: makeEventVisibilityDefinition({
            actorVisible: true,
            selfVisible: false,
            visibilityClass: undefined,
            scope: "organization",
          }),
        })
      )
    ).toBe(false);
  });

  it("returns false when actorVisible=true but viewer.userId is null", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: null, permissions: [] },
          event: makeEventVisibilityRow({
            actor_user_id: USER_A,
            entity_type: "org",
            entity_id: ORG_ID,
          }),
          entry: makeEventVisibilityDefinition({
            actorVisible: true,
            selfVisible: false,
            visibilityClass: undefined,
            scope: "organization",
          }),
        })
      )
    ).toBe(false);
  });

  it("returns false when actorVisible=false even if viewer matches actor", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: [] },
          event: makeEventVisibilityRow({
            actor_user_id: USER_A,
            entity_type: "org",
            entity_id: ORG_ID,
          }),
          // selfVisible=false, no visibilityClass → only actorVisible path can fire
          entry: makeEventVisibilityDefinition({
            actorVisible: false,
            selfVisible: false,
            visibilityClass: undefined,
            scope: "organization",
          }),
          viewerScope: "org",
        })
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-SELF: selfVisible intrinsic path
// ---------------------------------------------------------------------------

describe("T-VIS-SELF: selfVisible", () => {
  it("returns true when selfVisible=true and viewer is entity", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: [] },
          event: makeEventVisibilityRow({
            entity_type: "user",
            entity_id: USER_A,
            actor_user_id: USER_B,
          }),
          entry: makeEventVisibilityDefinition({
            actorVisible: false,
            selfVisible: true,
            visibilityClass: undefined,
            scope: "organization",
          }),
          viewerScope: "personal",
        })
      )
    ).toBe(true);
  });

  it("returns true when selfVisible=true and viewer is target", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: [] },
          event: makeEventVisibilityRow({
            entity_type: "org",
            entity_id: ORG_ID,
            target_type: "user",
            target_id: USER_A,
            actor_user_id: USER_B,
          }),
          entry: makeEventVisibilityDefinition({
            actorVisible: false,
            selfVisible: true,
            visibilityClass: undefined,
            scope: "organization",
          }),
          viewerScope: "personal",
        })
      )
    ).toBe(true);
  });

  it("returns false when selfVisible=true but viewer is neither entity nor target", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: [] },
          event: makeEventVisibilityRow({
            entity_type: "user",
            entity_id: USER_B,
            actor_user_id: USER_B,
          }),
          entry: makeEventVisibilityDefinition({
            actorVisible: false,
            selfVisible: true,
            visibilityClass: undefined,
            scope: "organization",
          }),
          viewerScope: "personal",
        })
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-AUDIT: audit superpower + scope gate
// ---------------------------------------------------------------------------

describe("T-VIS-AUDIT: audit.events.read superpower", () => {
  // Entry that doesn't fire via actorVisible or selfVisible
  const baseEntry = makeEventVisibilityDefinition({
    actorVisible: false,
    selfVisible: false,
    scope: "organization",
    visibilityClass: "org_sensitive",
  });

  it("returns true in audit scope with audit.events.read", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["audit.events.read"] },
          event: neutralEvent,
          entry: baseEntry,
          viewerScope: "audit",
        })
      )
    ).toBe(true);
  });

  it("returns false in org scope with audit.events.read (scope gate)", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["audit.events.read"] },
          event: neutralEvent,
          entry: baseEntry,
          viewerScope: "org",
        })
      )
    ).toBe(false);
  });

  it("returns false in personal scope with audit.events.read (scope gate)", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["audit.events.read"] },
          event: neutralEvent,
          entry: baseEntry,
          viewerScope: "personal",
        })
      )
    ).toBe(false);
  });

  it("returns true when viewerScope is unspecified (backward compat)", () => {
    expect(
      canViewerSeeEvent({
        viewer: { userId: USER_A, permissions: ["audit.events.read"] },
        event: neutralEvent,
        entry: baseEntry,
        // viewerScope intentionally omitted
      })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-SCOPE: audit-class events excluded from org/personal feeds
// ---------------------------------------------------------------------------

describe("T-VIS-SCOPE: audit-class exclusion from non-audit feeds", () => {
  const auditClassEntry = makeEventVisibilityDefinition({
    actorVisible: false,
    selfVisible: false,
    scope: "organization",
    visibilityClass: "audit",
  });

  it("audit-class event is hidden in org feed even with audit.events.read", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["audit.events.read"] },
          event: neutralEvent,
          entry: auditClassEntry,
          viewerScope: "org",
        })
      )
    ).toBe(false);
  });

  it("audit-class event is hidden in personal feed even with audit.events.read", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["audit.events.read"] },
          event: neutralEvent,
          entry: auditClassEntry,
          viewerScope: "personal",
        })
      )
    ).toBe(false);
  });

  it("audit-class event is visible in audit feed with audit.events.read", () => {
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["audit.events.read"] },
          event: neutralEvent,
          entry: auditClassEntry,
          viewerScope: "audit",
        })
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T-VIS-CLASS: permission-based visibility
// ---------------------------------------------------------------------------

describe("T-VIS-CLASS: visibilityClass permission gate", () => {
  it("org_activity class requires events.org_activity.read", () => {
    const entry = makeEventVisibilityDefinition({
      actorVisible: false,
      selfVisible: false,
      scope: "organization",
      visibilityClass: "org_activity",
    });
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["events.org_activity.read"] },
          event: neutralEvent,
          entry,
          viewerScope: "org",
        })
      )
    ).toBe(true);
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: [] },
          event: neutralEvent,
          entry,
          viewerScope: "org",
        })
      )
    ).toBe(false);
  });

  it("org_sensitive class requires events.org_sensitive.read", () => {
    const entry = makeEventVisibilityDefinition({
      actorVisible: false,
      selfVisible: false,
      scope: "organization",
      visibilityClass: "org_sensitive",
    });
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["events.org_sensitive.read"] },
          event: neutralEvent,
          entry,
          viewerScope: "org",
        })
      )
    ).toBe(true);
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["events.org_activity.read"] },
          event: neutralEvent,
          entry,
          viewerScope: "org",
        })
      )
    ).toBe(false);
  });

  it("no visibilityClass → returns false (only intrinsic paths apply)", () => {
    const entry = makeEventVisibilityDefinition({
      actorVisible: false,
      selfVisible: false,
      scope: "organization",
      visibilityClass: undefined,
    });
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["events.org_activity.read"] },
          event: neutralEvent,
          entry,
          viewerScope: "org",
        })
      )
    ).toBe(false);
  });

  it("branch-scope entry returns true when viewer has the required permission", () => {
    const entry = makeEventVisibilityDefinition({
      actorVisible: false,
      selfVisible: false,
      scope: "branch",
      visibilityClass: "org_activity",
    });
    expect(
      canViewerSeeEvent(
        makeVisibilityInput({
          viewer: { userId: USER_A, permissions: ["events.org_activity.read"] },
          event: neutralEvent,
          entry,
          viewerScope: "org",
        })
      )
    ).toBe(true);
  });
});
