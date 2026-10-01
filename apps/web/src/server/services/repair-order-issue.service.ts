import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Phase 10F (product correction 2026-10-01): issuing parts to the
 * technician for a repair order is an INTERNAL issue -- RW, movement 261
 * (AutoStacja's "WU") -- not an external WZ. One issue document carries:
 *   - "to prepare": allocated parts, normally inside the order's containers;
 *   - "to tick off": bulk material reserved at its fixed bin (clips etc.),
 *     taken by the mechanics themselves, still issued from stock here.
 * `repair_order_issue_parts` consumes each commitment exactly once and
 * posts the RW atomically; this service reads the candidates and maps.
 */

export type IssueCandidateKind = "allocation" | "reservation";

export interface IssueCandidate {
  kind: IssueCandidateKind;
  /** allocation line id or reservation line id */
  sourceId: string;
  repairOrderLineId: string;
  productCode: string | null;
  productName: string | null;
  sku: string | null;
  outstanding: number;
  location: { id: string; code: string | null; name: string | null } | null;
  containers: string[];
}

export type IssueError =
  | "unauthorized"
  | "not_found"
  | "not_enough"
  | "recipient_required"
  | "insufficient_stock"
  | "unexpected";

export interface IssueResult {
  movementId: string;
  documentNumber: string | null;
  lineCount: number;
}

function mapIssueError(error: { code?: string; message: string }): IssueError {
  const message = error.message ?? "";
  if (error.code === "28000" || error.code === "42501") return "unauthorized";
  if (/recipient is required/i.test(message)) return "recipient_required";
  if (/only .* left to issue/i.test(message)) return "not_enough";
  if (error.code === "P0003") return "insufficient_stock";
  if (error.code === "P0002") return "not_found";
  return "unexpected";
}

export class RepairOrderIssueService {
  static async listCandidates(
    supabase: SupabaseClient,
    repairOrderId: string
  ): Promise<ServiceResult<IssueCandidate[]>> {
    const { data: lineRows, error: linesError } = await supabase
      .from("repair_order_lines")
      .select("id, product_code, product_name, variant_id")
      .eq("repair_order_id", repairOrderId)
      .is("deleted_at", null);
    if (linesError) return { success: false, error: "Failed to load repair-order lines" };
    const lines = (lineRows ?? []) as Array<{
      id: string;
      product_code: string | null;
      product_name: string | null;
      variant_id: string | null;
    }>;
    if (lines.length === 0) return { success: true, data: [] };
    const lineById = new Map(lines.map((l) => [l.id, l]));

    const { data: resRows, error: resError } = await supabase
      .from("inventory_reservations")
      .select("id, reference_id, status")
      .eq("reference_type", "repair_order_line")
      .in(
        "reference_id",
        lines.map((l) => l.id)
      )
      .neq("status", "cancelled")
      .is("deleted_at", null);
    if (resError) return { success: false, error: "Failed to load reservations" };
    const reservations = (resRows ?? []) as Array<{ id: string; reference_id: string }>;
    const rolByReservation = new Map(reservations.map((r) => [r.id, r.reference_id]));
    if (reservations.length === 0) return { success: true, data: [] };

    const { data: rlRows } = await supabase
      .from("inventory_reservation_lines")
      .select(
        "id, reservation_id, variant_id, location_id, reserved_quantity, released_quantity, fulfilled_quantity"
      )
      .in(
        "reservation_id",
        reservations.map((r) => r.id)
      );
    const resLines = (rlRows ?? []) as Array<{
      id: string;
      reservation_id: string;
      variant_id: string;
      location_id: string | null;
      reserved_quantity: number;
      released_quantity: number;
      fulfilled_quantity: number;
    }>;
    const rolByResLine = new Map(
      resLines.map((rl) => [rl.id, rolByReservation.get(rl.reservation_id) ?? ""])
    );

    const { data: alRows } = resLines.length
      ? await supabase
          .from("inventory_allocation_lines")
          .select(
            "id, reservation_line_id, variant_id, location_id, allocated_quantity, fulfilled_quantity"
          )
          .in(
            "reservation_line_id",
            resLines.map((rl) => rl.id)
          )
      : { data: [] };
    const allocLines = (alRows ?? []) as Array<{
      id: string;
      reservation_line_id: string;
      variant_id: string;
      location_id: string;
      allocated_quantity: number;
      fulfilled_quantity: number;
    }>;

    // Containers holding each allocation line (active placements).
    const containersByAlloc = new Map<string, string[]>();
    if (allocLines.length > 0) {
      const { data: linkRows } = await supabase
        .from("inventory_allocation_container_links")
        .select("allocation_line_id, container_line_id")
        .in(
          "allocation_line_id",
          allocLines.map((a) => a.id)
        )
        .is("deleted_at", null);
      const links = (linkRows ?? []) as Array<{
        allocation_line_id: string;
        container_line_id: string;
      }>;
      if (links.length > 0) {
        const { data: clRows } = await supabase
          .from("inventory_container_lines")
          .select("id, container_id")
          .in(
            "id",
            links.map((l) => l.container_line_id)
          );
        const containerByLine = new Map(
          ((clRows ?? []) as Array<{ id: string; container_id: string }>).map((c) => [
            c.id,
            c.container_id,
          ])
        );
        const containerIds = [...new Set([...containerByLine.values()])];
        const { data: cRows } = containerIds.length
          ? await supabase.from("inventory_containers").select("id, code").in("id", containerIds)
          : { data: [] };
        const codeById = new Map(
          ((cRows ?? []) as Array<{ id: string; code: string }>).map((c) => [c.id, c.code])
        );
        for (const link of links) {
          const cid = containerByLine.get(link.container_line_id);
          const code = cid ? codeById.get(cid) : undefined;
          if (!code) continue;
          const list = containersByAlloc.get(link.allocation_line_id) ?? [];
          if (!list.includes(code)) list.push(code);
          containersByAlloc.set(link.allocation_line_id, list);
        }
      }
    }

    const variantIds = [
      ...new Set([...allocLines.map((a) => a.variant_id), ...resLines.map((r) => r.variant_id)]),
    ];
    const locationIds = [
      ...new Set(
        [...allocLines.map((a) => a.location_id), ...resLines.map((r) => r.location_id)].filter(
          (id): id is string => !!id
        )
      ),
    ];
    const [{ data: vRows }, { data: locRows }] = await Promise.all([
      variantIds.length
        ? supabase.from("inventory_variants").select("id, sku").in("id", variantIds)
        : Promise.resolve({ data: [] }),
      locationIds.length
        ? supabase.from("warehouse_locations").select("id, code, name").in("id", locationIds)
        : Promise.resolve({ data: [] }),
    ]);
    const skuById = new Map(
      ((vRows ?? []) as Array<{ id: string; sku: string | null }>).map((v) => [v.id, v.sku])
    );
    const locById = new Map(
      ((locRows ?? []) as Array<{ id: string; code: string | null; name: string | null }>).map(
        (l) => [l.id, l]
      )
    );

    const candidates: IssueCandidate[] = [];
    for (const a of allocLines) {
      const outstanding = Number(a.allocated_quantity) - Number(a.fulfilled_quantity);
      const rolId = rolByResLine.get(a.reservation_line_id);
      const rol = rolId ? lineById.get(rolId) : undefined;
      if (outstanding <= 0 || !rol) continue;
      candidates.push({
        kind: "allocation",
        sourceId: a.id,
        repairOrderLineId: rol.id,
        productCode: rol.product_code,
        productName: rol.product_name,
        sku: skuById.get(a.variant_id) ?? null,
        outstanding,
        location: locById.get(a.location_id) ?? null,
        containers: containersByAlloc.get(a.id) ?? [],
      });
    }
    for (const r of resLines) {
      const outstanding =
        Number(r.reserved_quantity) - Number(r.released_quantity) - Number(r.fulfilled_quantity);
      const rol = lineById.get(rolByResLine.get(r.id) ?? "");
      if (outstanding <= 0 || !rol || !r.location_id) continue;
      candidates.push({
        kind: "reservation",
        sourceId: r.id,
        repairOrderLineId: rol.id,
        productCode: rol.product_code,
        productName: rol.product_name,
        sku: skuById.get(r.variant_id) ?? null,
        outstanding,
        location: locById.get(r.location_id) ?? null,
        containers: [],
      });
    }
    return { success: true, data: candidates };
  }

  static async issue(
    supabase: SupabaseClient,
    input: {
      actorUserId: string;
      organizationId: string;
      branchId: string;
      repairOrderId: string;
      recipient: string;
      note: string | null;
      lines: Array<{
        kind: IssueCandidateKind;
        sourceId: string;
        repairOrderLineId: string;
        quantity: number;
      }>;
    }
  ): Promise<ServiceResult<IssueResult>> {
    const { data, error } = await supabase.rpc("repair_order_issue_parts", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_repair_order_id: input.repairOrderId,
      p_lines: input.lines.map((l) => ({
        repair_order_line_id: l.repairOrderLineId,
        quantity: l.quantity,
        ...(l.kind === "allocation"
          ? { allocation_line_id: l.sourceId }
          : { reservation_line_id: l.sourceId }),
      })),
      p_recipient: input.recipient,
      p_note: input.note,
    });
    if (error) return { success: false, error: mapIssueError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        movementId: String(r.movement_id),
        documentNumber: (r.document_number as string | null) ?? null,
        lineCount: Number(r.line_count ?? input.lines.length),
      },
    };
  }
}
