/**
 * Event Service — Central Mode A Emission Path
 *
 * This is the ONLY application-code path that may insert into public.platform_events.
 * All server actions that emit events must call eventService.emit().
 * Direct inserts into public.platform_events from any other location are
 * an architectural violation (see README Architectural Invariant section).
 *
 * Mode A — Best-effort app-side emission:
 *   server action → domain write → eventService.emit()
 *   If the emit fails after a successful domain write, the domain change is
 *   preserved and the failure is logged. This trade-off is acceptable for
 *   baseline and enhanced tier events.
 *
 * Mode B — Atomic DB-side emission (NOT implemented here):
 *   Used for forensic workflows. Implemented via Postgres security-definer
 *   functions. Metadata is pre-validated at the action layer using this
 *   service's validation helpers before calling the RPC.
 *
 * Architecture ref: docs/event-system/README.md
 * Plan ref:         docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md
 */

import "server-only";

import { ZodError } from "zod";
import { createServiceClient } from "@supabase/service";
import { getRegistryEntry } from "@/server/audit/event-registry";
import type { EmitEventInput, EventServiceResult } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const eventService = {
  emit,
  validateMetadata,
};

// ---------------------------------------------------------------------------
// emit() — Mode A
// ---------------------------------------------------------------------------

/**
 * Validate and emit a single platform event.
 *
 * Steps:
 *  1. Look up registry entry — reject if actionKey is not registered
 *  2. Validate metadata against the registered Zod schema
 *  3. Normalize actor: force actorUserId = null when actorType !== 'user'
 *  4. Insert into public.platform_events via the service-role client
 *  5. Return typed success { id } or typed error { error }
 *
 * The service never generates requestId — the caller is responsible for
 * generating it once at the workflow entry point and passing it here.
 */
async function emit(input: EmitEventInput): Promise<EventServiceResult<{ id: string }>> {
  // Step 1: Registry lookup
  const entry = getRegistryEntry(input.actionKey);
  if (!entry) {
    return {
      success: false,
      error: `Unregistered action key: "${input.actionKey}". Register it in event-registry.ts before emitting.`,
    };
  }

  // Step 2: Metadata validation
  const rawMetadata = input.metadata ?? {};
  const validationResult = validateMetadata(input.actionKey, rawMetadata);
  if (!validationResult.success) {
    // Explicit re-wrap: TS cannot narrow EventServiceResult<Record> to
    // EventServiceResult<{id}> across the discriminant boundary.
    return {
      success: false as const,
      error: (validationResult as { success: false; error: string }).error,
    };
  }
  const validatedMetadata = (validationResult as { success: true; data: Record<string, unknown> })
    .data;

  // Step 3: Actor normalization
  // Non-user actors (system, api, worker, scheduler, automation) must not carry
  // a actorUserId — the DB schema allows null and the architecture requires it.
  const actorUserId = input.actorType === "user" ? (input.actorUserId ?? null) : null;

  // Step 4: Build insert row
  const insertRow = {
    organization_id: input.organizationId ?? null,
    branch_id: input.branchId ?? null,
    actor_user_id: actorUserId,
    actor_type: input.actorType,
    module_slug: entry.moduleSlug,
    action_key: input.actionKey,
    entity_type: input.entityType,
    entity_id: input.entityId,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata: validatedMetadata,
    event_tier: entry.eventTier, // always use registry tier, not caller-supplied
    request_id: input.requestId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  };

  // Step 5: Insert via service-role client (bypasses RLS — required for INSERT)
  try {
    const client = createServiceClient();
    // platform_events is a new table not yet in generated DB types.
    // Using `as any` cast for the table name only — all application-level
    // types above remain strongly typed.

    const { data, error } = await (client as any)
      .from("platform_events")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      console.error("[eventService.emit] DB insert failed", {
        actionKey: input.actionKey,
        organizationId: input.organizationId,
        actorUserId,
        error: error.message,
      });
      return {
        success: false,
        error: `Event insert failed: ${error.message}`,
      };
    }

    return { success: true, data: { id: data.id as string } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[eventService.emit] Unexpected error", {
      actionKey: input.actionKey,
      error: message,
    });
    return { success: false, error: `Event emit error: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// validateMetadata() — reusable for Mode B pre-validation at action layer
// ---------------------------------------------------------------------------

/**
 * Validate a metadata object against the registry schema for a given actionKey.
 *
 * Used internally by emit() for Mode A.
 * Also exported for use in Mode B workflows: server actions must pre-validate
 * metadata using this function before calling any atomic DB-side RPC.
 *
 * Returns the parsed (validated + stripped unknown keys) metadata on success.
 */
export function validateMetadata(
  actionKey: string,
  metadata: Record<string, unknown>
): EventServiceResult<Record<string, unknown>> {
  const entry = getRegistryEntry(actionKey);
  if (!entry) {
    return {
      success: false,
      error: `Unregistered action key: "${actionKey}". Cannot validate metadata.`,
    };
  }

  try {
    const parsed = entry.metadataSchema.parse(metadata) as Record<string, unknown>;
    return { success: true, data: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.errors
        .map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`)
        .join("; ");
      return {
        success: false,
        error: `Metadata validation failed for "${actionKey}": ${issues}`,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Metadata validation error: ${message}` };
  }
}
