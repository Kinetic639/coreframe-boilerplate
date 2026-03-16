/**
 * Reference Enrichment — Backend Only
 *
 * Server-side batch enrichment layer that resolves UUIDs and entity IDs in
 * projected events to human-readable display names. Applied after projection
 * and after actor enrichment, before data is returned to the client.
 *
 * Enriches:
 *   - actor_user_id      → user display name  (actorName / actor entity label)
 *   - target_id          → user display name  (targetName / target entity label)
 *                          when target_type = "user"
 *   - target_id          → used directly as label (no lookup) when target_type = "invitation_email"
 *   - entity_id          → role name          (roleName / role entity label)
 *                          when entity_type = "role"; prefers metadata.role_name
 *   - entity_id          → branch name        (branchName / branch entity label)
 *                          when entity_type = "branch"; prefers metadata.branch_name
 *   - branch_id          → branch name        (branchName / branch entity label)
 *                          when set on the raw event; prefers metadata.branch_name
 *
 * Design rules:
 *  - ONE batch query per resource type — never N+1.
 *  - Uses service-role client (bypasses RLS — enrichment runs server-side after
 *    visibility filtering, so the event set is already safe).
 *  - If any query fails, an empty map is returned for that type — feed never crashes.
 *  - metadata.role_name / metadata.branch_name are checked FIRST — prefer the
 *    denormalized value recorded at emit time over a DB lookup.
 *  - Does NOT write anything back to the database — read-only, in-memory only.
 *  - server-only: must never be imported by client code.
 *
 * Architecture ref: docs/event-system/README.md
 * Plan ref:         docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md
 */

import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import type { ProjectedEvent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReferenceEnrichmentContext = {
  users: Map<string, string>; // userId → display name
  roles: Map<string, string>; // roleId → role name
  branches: Map<string, string>; // branchId → branch name
};

// ---------------------------------------------------------------------------
// Reference collection
// ---------------------------------------------------------------------------

/**
 * Scan a list of projected events and collect all entity IDs that need lookup.
 *
 * Collection rules:
 *  - actor_user_id (non-null) → userIds
 *  - target_id when target_type === "user" → userIds
 *  - entity_id when entity_type === "role" → roleIds
 *  - entity_id when entity_type === "branch" → branchIds
 *  - branch_id (non-null) from the event row → branchIds
 */
export function collectReferences(events: ProjectedEvent[]): {
  userIds: Set<string>;
  roleIds: Set<string>;
  branchIds: Set<string>;
} {
  const userIds = new Set<string>();
  const roleIds = new Set<string>();
  const branchIds = new Set<string>();

  for (const event of events) {
    // Actor user ID — stored in summaryEntities.actor when actor is a user
    const actorId = event.summaryEntities?.actor?.id;
    if (actorId && actorId !== "system") {
      userIds.add(actorId);
    }

    // Target user
    if (event.target_type === "user" && event.target_id) {
      userIds.add(event.target_id);
    }

    // Role entity
    if (event.entity_type === "role" && event.entity_id) {
      roleIds.add(event.entity_id);
    }

    // Branch entity
    if (event.entity_type === "branch" && event.entity_id) {
      branchIds.add(event.entity_id);
    }

    // Also collect the role entity from summaryEntities.role (covers role assignments)
    const roleEntityId = event.summaryEntities?.role?.id;
    if (roleEntityId && roleEntityId !== "unknown") {
      roleIds.add(roleEntityId);
    }

    // Branch from summaryEntities.branch
    const branchEntityId = event.summaryEntities?.branch?.id;
    if (branchEntityId && branchEntityId !== "unknown") {
      branchIds.add(branchEntityId);
    }
  }

  return { userIds, roleIds, branchIds };
}

// ---------------------------------------------------------------------------
// Batch loader
// ---------------------------------------------------------------------------

/**
 * Execute at most three batch queries (one per resource type) to resolve all
 * collected IDs to display names.
 *
 * Skips a query entirely when the corresponding ID set is empty.
 * Never throws — any query failure returns an empty map for that type.
 */
export async function batchLoadReferences(refs: {
  userIds: Set<string>;
  roleIds: Set<string>;
  branchIds: Set<string>;
}): Promise<ReferenceEnrichmentContext> {
  const [users, roles, branches] = await Promise.all([
    refs.userIds.size > 0
      ? fetchUserDisplayNames([...refs.userIds])
      : Promise.resolve(new Map<string, string>()),
    refs.roleIds.size > 0
      ? fetchRoleNames([...refs.roleIds])
      : Promise.resolve(new Map<string, string>()),
    refs.branchIds.size > 0
      ? fetchBranchNames([...refs.branchIds])
      : Promise.resolve(new Map<string, string>()),
  ]);

  return { users, roles, branches };
}

// ---------------------------------------------------------------------------
// Apply enrichment
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Apply the resolved reference context to each projected event's summaryParams
 * and summaryEntities. Returns new event objects — input is never mutated.
 *
 * Enrichment order per event:
 *  1. Actor (user lookup)
 *  2. Target:
 *     - target_type="user"             → user lookup
 *     - target_type="invitation_email" → use target_id directly (IS the email)
 *  3. Role:
 *     - checks metadata.role_name FIRST; falls back to roles map
 *  4. Branch:
 *     - checks metadata.branch_name FIRST; falls back to branches map
 *     - also applies when a branch entity ref exists without entity_type="branch"
 *
 * Fallbacks when lookup returns nothing:
 *   users    → "User <first-8-chars>"
 *   roles    → "Role <first-8-chars>"
 *   branches → "Branch <first-8-chars>"
 */
export function applyReferenceEnrichment(
  events: ProjectedEvent[],
  ctx: ReferenceEnrichmentContext
): ProjectedEvent[] {
  return events.map((event) => enrichEvent(event, ctx));
}

// ---------------------------------------------------------------------------
// Per-event enrichment
// ---------------------------------------------------------------------------

function enrichEvent(event: ProjectedEvent, ctx: ReferenceEnrichmentContext): ProjectedEvent {
  let summaryParams = { ...event.summaryParams };
  let summaryEntities = { ...event.summaryEntities };

  // 1. Actor enrichment
  const actorId = summaryEntities.actor?.id;
  if (actorId && actorId !== "system" && UUID_PATTERN.test(actorId)) {
    const resolved = ctx.users.get(actorId) ?? `User ${actorId.slice(0, 8)}`;
    summaryParams = { ...summaryParams, actorName: resolved };
    if (summaryEntities.actor) {
      summaryEntities = {
        ...summaryEntities,
        actor: { ...summaryEntities.actor, label: resolved },
      };
    }
  }

  // 2. Target enrichment
  if (event.target_type === "user" && event.target_id) {
    const targetId = event.target_id;
    const resolved = ctx.users.get(targetId) ?? `User ${targetId.slice(0, 8)}`;
    summaryParams = { ...summaryParams, targetName: resolved };
    if (summaryEntities.target) {
      summaryEntities = {
        ...summaryEntities,
        target: { ...summaryEntities.target, label: resolved },
      };
    }
  } else if (event.target_type === "invitation_email" && event.target_id) {
    // For invitation_email targets, the target_id IS the email address — no lookup needed
    const email = event.target_id;
    summaryParams = { ...summaryParams, targetName: email };
    if (summaryEntities.target) {
      summaryEntities = {
        ...summaryEntities,
        target: { ...summaryEntities.target, label: email },
      };
    }
  }

  // 3. Role enrichment
  // Applies when entity_type="role" OR when summaryEntities.role is set (e.g. role assignments)
  const roleEntityId =
    event.entity_type === "role" ? event.entity_id : (summaryEntities.role?.id ?? null);

  if (roleEntityId && roleEntityId !== "unknown") {
    const metadata = event.metadata as Record<string, unknown>;
    // Prefer denormalized metadata.role_name recorded at emit time
    const metaRoleName =
      typeof metadata.role_name === "string" && metadata.role_name.trim().length > 0
        ? metadata.role_name.trim()
        : null;

    const resolved =
      metaRoleName ??
      ctx.roles.get(roleEntityId) ??
      (UUID_PATTERN.test(roleEntityId) ? `Role ${roleEntityId.slice(0, 8)}` : null);

    if (resolved) {
      summaryParams = { ...summaryParams, roleName: resolved };
      if (summaryEntities.role) {
        summaryEntities = {
          ...summaryEntities,
          role: { ...summaryEntities.role, label: resolved },
        };
      }
      // Also update entity slot when entity_type === "role"
      if (event.entity_type === "role" && summaryEntities.entity) {
        summaryEntities = {
          ...summaryEntities,
          entity: { ...summaryEntities.entity, label: resolved },
        };
      }
    }
  }

  // 4. Branch enrichment
  // Applies when entity_type="branch" OR when summaryEntities.branch is set
  const branchEntityId =
    event.entity_type === "branch" ? event.entity_id : (summaryEntities.branch?.id ?? null);

  if (branchEntityId && branchEntityId !== "unknown") {
    const metadata = event.metadata as Record<string, unknown>;
    const metaBranchName =
      typeof metadata.branch_name === "string" && metadata.branch_name.trim().length > 0
        ? metadata.branch_name.trim()
        : null;

    const resolved =
      metaBranchName ??
      ctx.branches.get(branchEntityId) ??
      (UUID_PATTERN.test(branchEntityId) ? `Branch ${branchEntityId.slice(0, 8)}` : null);

    if (resolved) {
      summaryParams = { ...summaryParams, branchName: resolved };
      if (summaryEntities.branch) {
        summaryEntities = {
          ...summaryEntities,
          branch: { ...summaryEntities.branch, label: resolved },
        };
      }
      // Also update entity slot when entity_type === "branch"
      if (event.entity_type === "branch" && summaryEntities.entity) {
        summaryEntities = {
          ...summaryEntities,
          entity: { ...summaryEntities.entity, label: resolved },
        };
      }
    }
  }

  return { ...event, summaryParams, summaryEntities };
}

// ---------------------------------------------------------------------------
// Internal DB fetch helpers
// ---------------------------------------------------------------------------

/**
 * Batch-fetch user display names for the given user IDs.
 *
 * Priority: "${first_name} ${last_name}".trim() → email → "User <first-8>"
 * Never throws — returns empty map on error.
 */
async function fetchUserDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  try {
    const client = createServiceClient();
    const { data, error } = await (client as any)
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    if (error) {
      console.warn("[reference-enrichment] users query failed (non-fatal)", {
        count: userIds.length,
        error: error.message,
      });
      return new Map();
    }

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const id: string = row.id;
      const firstName: string | null = row.first_name ?? null;
      const lastName: string | null = row.last_name ?? null;
      const email: string | null = row.email ?? null;

      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (fullName) {
        map.set(id, fullName);
      } else if (email) {
        map.set(id, email);
      } else {
        map.set(id, `User ${id.slice(0, 8)}`);
      }
    }
    return map;
  } catch (err) {
    console.warn("[reference-enrichment] users fetch threw (non-fatal)", {
      count: userIds.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Map();
  }
}

/**
 * Batch-fetch role names for the given role IDs.
 *
 * Display: name → "Role <first-8>"
 * Never throws — returns empty map on error.
 */
async function fetchRoleNames(roleIds: string[]): Promise<Map<string, string>> {
  try {
    const client = createServiceClient();
    const { data, error } = await (client as any)
      .from("roles")
      .select("id, name")
      .in("id", roleIds);

    if (error) {
      console.warn("[reference-enrichment] roles query failed (non-fatal)", {
        count: roleIds.length,
        error: error.message,
      });
      return new Map();
    }

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const id: string = row.id;
      const name: string | null = row.name ?? null;
      map.set(id, name ?? `Role ${id.slice(0, 8)}`);
    }
    return map;
  } catch (err) {
    console.warn("[reference-enrichment] roles fetch threw (non-fatal)", {
      count: roleIds.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Map();
  }
}

/**
 * Batch-fetch branch names for the given branch IDs.
 *
 * Display: name → "Branch <first-8>"
 * Never throws — returns empty map on error.
 */
async function fetchBranchNames(branchIds: string[]): Promise<Map<string, string>> {
  try {
    const client = createServiceClient();
    const { data, error } = await (client as any)
      .from("branches")
      .select("id, name")
      .in("id", branchIds);

    if (error) {
      console.warn("[reference-enrichment] branches query failed (non-fatal)", {
        count: branchIds.length,
        error: error.message,
      });
      return new Map();
    }

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const id: string = row.id;
      const name: string | null = row.name ?? null;
      map.set(id, name ?? `Branch ${id.slice(0, 8)}`);
    }
    return map;
  } catch (err) {
    console.warn("[reference-enrichment] branches fetch threw (non-fatal)", {
      count: branchIds.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Map();
  }
}
