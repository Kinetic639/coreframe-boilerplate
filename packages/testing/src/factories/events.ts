/**
 * Event Visibility Factories
 *
 * Reusable builders for @repo/domain event visibility test fixtures.
 * Uses only domain-layer types — no app-local EventRegistryEntry or ZodTypeAny.
 */

// Inline structural interfaces — mirror EventVisibilityRow/Definition/VisibilityInput from
// @repo/domain/events/visibility. Kept local to avoid creating a @repo/testing → @repo/domain
// dependency cycle (domain uses @repo/testing as a devDep for its own tests).
// TypeScript structural subtyping ensures domain types remain assignable without importing domain.

type EventVisibilityClass = "org_activity" | "org_sensitive" | "audit";
type EventScope = "platform" | "organization" | "branch";

interface EventVisibilityRow {
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  target_type: string | null;
  target_id: string | null;
}

interface EventVisibilityDefinition {
  actorVisible: boolean;
  selfVisible?: boolean;
  visibilityClass?: EventVisibilityClass;
  scope: EventScope;
}

interface VisibilityInput {
  viewer: {
    userId: string | null;
    permissions: string[];
    branchId?: string | null;
  };
  event: EventVisibilityRow;
  entry: EventVisibilityDefinition | null | undefined;
  viewerScope?: "personal" | "org" | "audit";
}

// ---------------------------------------------------------------------------
// Stable test UUIDs
// ---------------------------------------------------------------------------

export const TEST_USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const TEST_USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
export const TEST_ORG_ID = "11111111-1111-1111-1111-111111111111";
export const TEST_BRANCH_ID = "22222222-2222-2222-2222-222222222222";

// ---------------------------------------------------------------------------
// EventVisibilityRow factory
// ---------------------------------------------------------------------------

const DEFAULT_VISIBILITY_ROW: EventVisibilityRow = {
  actor_user_id: TEST_USER_A,
  entity_type: "user",
  entity_id: TEST_USER_A,
  target_type: null,
  target_id: null,
};

/**
 * Build an EventVisibilityRow with optional overrides.
 *
 * @example
 * makeEventVisibilityRow({ actor_user_id: USER_A, entity_id: ORG_ID })
 */
export function makeEventVisibilityRow(
  overrides?: Partial<EventVisibilityRow>
): EventVisibilityRow {
  return { ...DEFAULT_VISIBILITY_ROW, ...overrides };
}

// ---------------------------------------------------------------------------
// EventVisibilityDefinition factory
// ---------------------------------------------------------------------------

const DEFAULT_VISIBILITY_DEFINITION: EventVisibilityDefinition = {
  actorVisible: true,
  selfVisible: true,
  visibilityClass: "audit",
  scope: "platform",
};

/**
 * Build an EventVisibilityDefinition with optional overrides.
 *
 * @example
 * makeEventVisibilityDefinition({ visibilityClass: "org_member", scope: "organization" })
 */
export function makeEventVisibilityDefinition(
  overrides?: Partial<EventVisibilityDefinition>
): EventVisibilityDefinition {
  return { ...DEFAULT_VISIBILITY_DEFINITION, ...overrides };
}

// ---------------------------------------------------------------------------
// VisibilityInput factory
// ---------------------------------------------------------------------------

const DEFAULT_VISIBILITY_INPUT: VisibilityInput = {
  viewer: {
    userId: TEST_USER_A,
    permissions: [],
    branchId: null,
  },
  event: DEFAULT_VISIBILITY_ROW,
  entry: DEFAULT_VISIBILITY_DEFINITION,
  viewerScope: "personal",
};

/**
 * Build a VisibilityInput with optional overrides.
 *
 * @example
 * makeVisibilityInput({
 *   viewer: { userId: USER_B, permissions: ["audit.events.read"], branchId: null },
 *   viewerScope: "audit",
 * })
 */
export function makeVisibilityInput(overrides?: Partial<VisibilityInput>): VisibilityInput {
  return { ...DEFAULT_VISIBILITY_INPUT, ...overrides };
}
