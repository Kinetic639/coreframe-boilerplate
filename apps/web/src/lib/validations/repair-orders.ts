/**
 * Zone 3 Phase 7 -- zod input schemas for RepairOrder header create/edit,
 * advisor assignment, and lifecycle transitions.
 *
 * Mirrors the `optionalTrimmed` idiom already established in
 * `src/lib/validations/crm.ts` (trims, then converts an empty string to
 * null -- so a cleared form field means "clear this value", not "leave
 * unchanged").
 */
import { z } from "zod";
import { REPAIR_ORDER_STATUSES } from "@/lib/types/repair-orders";

const optionalTrimmed = z
  .string()
  .trim()
  .max(300)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

/**
 * Editable business/descriptive header fields shared by create and update.
 * Deliberately excludes: id, organization_id, branch_id (always server-
 * trusted, never client input), identity_status (derived server-side from
 * zl_number's presence, never accepted directly from the client),
 * advisor_contact_id (separate assignAdvisor flow -- RLS treats it with
 * stricter, ownership-specific rules), status (separate lifecycle flow),
 * created_by/created_at/updated_at/deleted_at (system-managed).
 */
const repairOrderHeaderFieldsSchema = z.object({
  zl_number: optionalTrimmed,
  order_number: optionalTrimmed,
  vin: optionalTrimmed,
  vehicle_brand: optionalTrimmed,
  client_name: optionalTrimmed,
  dealer_name: optionalTrimmed,
});

/**
 * Manual RepairOrder header creation (Phase 7, PITCH). org/branch are never
 * part of this schema -- both are always taken from the caller's trusted
 * server-side active context, never from client input.
 */
export const createRepairOrderSchema = repairOrderHeaderFieldsSchema.extend({
  /** Optional at creation -- manage_own may only name themselves or leave
   * this null (enforced by repair_orders_insert's RLS WITH CHECK); manage_all
   * may name any contact or leave it null. */
  advisor_contact_id: z.string().uuid().nullable().optional(),
});
export type CreateRepairOrderInput = z.infer<typeof createRepairOrderSchema>;

/**
 * Header edit -- every field optional (partial update); only the fields
 * actually present in the payload are changed. zl_number's presence, when
 * included, re-derives identity_status server-side (see
 * RepairOrdersService.updateHeader) -- identity_status itself is never
 * accepted as direct input.
 */
export const updateRepairOrderHeaderSchema = repairOrderHeaderFieldsSchema.partial().extend({
  id: z.string().uuid(),
});
export type UpdateRepairOrderHeaderInput = z.infer<typeof updateRepairOrderHeaderSchema>;

export const assignRepairOrderAdvisorSchema = z.object({
  id: z.string().uuid(),
  advisorContactId: z.string().uuid().nullable(),
});
export type AssignRepairOrderAdvisorInput = z.infer<typeof assignRepairOrderAdvisorSchema>;

export const repairOrderStatusSchema = z.enum(REPAIR_ORDER_STATUSES as [string, ...string[]]);

export const changeRepairOrderStatusSchema = z.object({
  id: z.string().uuid(),
  fromStatus: repairOrderStatusSchema,
  toStatus: repairOrderStatusSchema,
});
export type ChangeRepairOrderStatusInput = z.infer<typeof changeRepairOrderStatusSchema>;

/**
 * Phase 10A -- reserve stock for one RepairOrderLine via the existing
 * generic reservation engine. `locationId` is a hard requirement of the
 * underlying `inventory_create_reservation` RPC itself (LIVE VERIFIED:
 * "Phase 2 hard reservations require location_id") -- never defaulted or
 * inferred here.
 */
export const reserveRepairOrderLineSchema = z.object({
  repairOrderLineId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type ReserveRepairOrderLineInput = z.infer<typeof reserveRepairOrderLineSchema>;

/**
 * Phase 10A -- release a reservation previously created for one
 * RepairOrderLine. `cancel` defaults to true (release + mark cancelled) --
 * the only granularity the underlying `inventory_release_reservation` RPC
 * actually offers (LIVE VERIFIED: whole-reservation release, no
 * partial-quantity primitive exists).
 */
export const releaseRepairOrderLineReservationSchema = z.object({
  repairOrderLineId: z.string().uuid(),
  reservationId: z.string().uuid(),
  cancel: z.boolean().optional(),
});
export type ReleaseRepairOrderLineReservationInput = z.infer<
  typeof releaseRepairOrderLineReservationSchema
>;

/**
 * Phase 10B -- convert an existing reservation line into an allocation.
 * Deliberately no `locationId` field: the target location is ALWAYS
 * derived server-side from the reservation line itself
 * (`RepairOrdersService.allocateForLine`'s own doc comment has the full
 * rationale) -- accepting one here would let a client submit a value that
 * is silently ignored at best, or misleadingly imply client control over
 * something the server never actually honors, at worst.
 */
export const allocateRepairOrderLineSchema = z.object({
  repairOrderLineId: z.string().uuid(),
  reservationLineId: z.string().uuid(),
  quantity: z.number().positive(),
});
export type AllocateRepairOrderLineInput = z.infer<typeof allocateRepairOrderLineSchema>;
