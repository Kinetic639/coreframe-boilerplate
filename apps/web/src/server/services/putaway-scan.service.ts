import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Scan-driven putaway (mobile). The putaway screen resolves what was
 * scanned -- a repair-order container, a fresh sticker or a location -- and
 * this service reads what that target needs (containers of an order, what
 * lies at a location) and posts a batch through `inventory_putaway_batch`.
 * "Do przepisania" lists repair orders whose locations changed, for the
 * temporary double entry into AutoStacja.
 */

export type LocationRef = { id: string; code: string | null; name: string | null };

export type RepairOrderContainer = {
  id: string;
  code: string;
  status: string;
  location: LocationRef | null;
};

export type ScannedContainer = RepairOrderContainer & {
  repairOrderId: string;
  zlNumber: string | null;
  clientName: string | null;
  vehicleBrand: string | null;
};

export type LocationContents = {
  location: LocationRef;
  isReceiving: boolean;
  containers: Array<
    RepairOrderContainer & {
      repairOrderId: string;
      zlNumber: string | null;
      clientName: string | null;
      itemCount: number;
    }
  >;
  loose: Array<{
    variantId: string;
    sku: string | null;
    productName: string | null;
    quantity: number;
    reserved: number;
  }>;
};

export type PutawayBatchError =
  | "unauthorized"
  | "not_found"
  | "mixed_orders"
  | "invalid_destination"
  | "not_enough"
  | "order_not_open"
  | "unexpected";

export type PutawayBatchResult = {
  locationId: string;
  containerId: string | null;
  containerCode: string | null;
  containerCreated: boolean;
  lineCount: number;
};

export type LocationChange = {
  repairOrderId: string;
  zlNumber: string | null;
  clientName: string | null;
  vehicleBrand: string | null;
  current: Array<LocationRef & { containers: string[]; isNew: boolean }>;
  released: LocationRef[];
  lastChangeAt: string;
};

function mapBatchError(error: { code?: string; message?: string }): PutawayBatchError {
  const message = error.message ?? "";
  if (error.code === "28000" || error.code === "42501") return "unauthorized";
  if (/another repair order|Only repair-order parts/i.test(message)) return "mixed_orders";
  if (/not open/i.test(message)) return "order_not_open";
  if (/Destination|destination location|has no location/i.test(message))
    return "invalid_destination";
  if (/Not enough|only .* is currently attributed|must be positive/i.test(message))
    return "not_enough";
  if (error.code === "P0002") return "not_found";
  return "unexpected";
}

async function locationsById(supabase: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, LocationRef>();
  const { data } = await supabase
    .from("warehouse_locations")
    .select("id, code, name")
    .in("id", unique);
  return new Map(((data ?? []) as LocationRef[]).map((l) => [l.id, l]));
}

async function repairOrdersById(supabase: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0)
    return new Map<
      string,
      {
        id: string;
        zl_number: string | null;
        client_name: string | null;
        vehicle_brand: string | null;
      }
    >();
  const { data } = await supabase
    .from("repair_orders")
    .select("id, zl_number, client_name, vehicle_brand")
    .in("id", unique);
  return new Map(
    (
      (data ?? []) as Array<{
        id: string;
        zl_number: string | null;
        client_name: string | null;
        vehicle_brand: string | null;
      }>
    ).map((r) => [r.id, r])
  );
}

export class PutawayScanService {
  /** Active containers of the given repair orders, with their location. */
  static async containersForRepairOrders(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    repairOrderIds: string[]
  ): Promise<ServiceResult<Record<string, RepairOrderContainer[]>>> {
    if (repairOrderIds.length === 0) return { success: true, data: {} };
    const { data, error } = await supabase
      .from("inventory_containers")
      .select("id, code, status, current_location_id, reference_id")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("reference_type", "repair_order")
      .in("reference_id", repairOrderIds)
      .in("status", ["active", "empty"])
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: "Failed to load containers" };
    const rows = (data ?? []) as Array<{
      id: string;
      code: string;
      status: string;
      current_location_id: string | null;
      reference_id: string;
    }>;
    const locs = await locationsById(
      supabase,
      rows.map((r) => r.current_location_id ?? "")
    );
    const byOrder: Record<string, RepairOrderContainer[]> = {};
    for (const r of rows) {
      (byOrder[r.reference_id] ??= []).push({
        id: r.id,
        code: r.code,
        status: r.status,
        location: r.current_location_id ? (locs.get(r.current_location_id) ?? null) : null,
      });
    }
    return { success: true, data: byOrder };
  }

  /** A scanned container: which order it belongs to and where it is. */
  static async getContainer(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    containerId: string
  ): Promise<ServiceResult<ScannedContainer | null>> {
    const { data, error } = await supabase
      .from("inventory_containers")
      .select("id, code, status, current_location_id, reference_type, reference_id, branch_id")
      .eq("id", containerId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { success: false, error: "Failed to load the container" };
    const row = data as {
      id: string;
      code: string;
      status: string;
      current_location_id: string | null;
      reference_type: string | null;
      reference_id: string | null;
      branch_id: string;
    } | null;
    if (!row || row.branch_id !== branchId) return { success: true, data: null };
    if (row.reference_type !== "repair_order" || !row.reference_id) {
      return { success: true, data: null };
    }
    const [locs, ros] = await Promise.all([
      locationsById(supabase, [row.current_location_id ?? ""]),
      repairOrdersById(supabase, [row.reference_id]),
    ]);
    const ro = ros.get(row.reference_id);
    return {
      success: true,
      data: {
        id: row.id,
        code: row.code,
        status: row.status,
        location: row.current_location_id ? (locs.get(row.current_location_id) ?? null) : null,
        repairOrderId: row.reference_id,
        zlNumber: ro?.zl_number ?? null,
        clientName: ro?.client_name ?? null,
        vehicleBrand: ro?.vehicle_brand ?? null,
      },
    };
  }

  /** What is at a location: repair-order containers and loose stock. */
  static async getLocationContents(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    locationId: string
  ): Promise<ServiceResult<LocationContents | null>> {
    const { data: locRow, error: locError } = await supabase
      .from("warehouse_locations")
      .select("id, code, name, purpose, can_store_inventory, branch_id")
      .eq("id", locationId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (locError) return { success: false, error: "Failed to load the location" };
    const loc = locRow as
      | (LocationRef & { purpose: string | null; can_store_inventory: boolean; branch_id: string })
      | null;
    if (!loc || loc.branch_id !== branchId) return { success: true, data: null };

    const [containersRes, balancesRes] = await Promise.all([
      supabase
        .from("inventory_containers")
        .select("id, code, status, reference_type, reference_id")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId)
        .eq("current_location_id", locationId)
        .in("status", ["active", "empty"])
        .is("deleted_at", null)
        .order("code", { ascending: true }),
      supabase
        .from("inventory_balances")
        .select("variant_id, on_hand_quantity, reserved_quantity, allocated_quantity")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId)
        .eq("location_id", locationId)
        .gt("on_hand_quantity", 0),
    ]);
    const containers = (containersRes.data ?? []) as Array<{
      id: string;
      code: string;
      status: string;
      reference_type: string | null;
      reference_id: string | null;
    }>;
    const balances = (balancesRes.data ?? []) as Array<{
      variant_id: string;
      on_hand_quantity: number;
      reserved_quantity: number;
      allocated_quantity: number;
    }>;

    const containerIds = containers.map((c) => c.id);
    const { data: clRows } = containerIds.length
      ? await supabase
          .from("inventory_container_lines")
          .select("container_id, variant_id, quantity")
          .in("container_id", containerIds)
          .is("deleted_at", null)
      : { data: [] };
    const containerLines = (clRows ?? []) as Array<{
      container_id: string;
      variant_id: string;
      quantity: number;
    }>;
    const inContainers = new Map<string, number>();
    const itemsByContainer = new Map<string, number>();
    for (const cl of containerLines) {
      inContainers.set(cl.variant_id, (inContainers.get(cl.variant_id) ?? 0) + Number(cl.quantity));
      itemsByContainer.set(cl.container_id, (itemsByContainer.get(cl.container_id) ?? 0) + 1);
    }

    const variantIds = balances.map((b) => b.variant_id);
    const [{ data: vRows }, ros] = await Promise.all([
      variantIds.length
        ? supabase
            .from("inventory_variants")
            .select("id, sku, product:inventory_products(name)")
            .in("id", variantIds)
        : Promise.resolve({ data: [] }),
      repairOrdersById(
        supabase,
        containers
          .filter((c) => c.reference_type === "repair_order")
          .map((c) => c.reference_id ?? "")
      ),
    ]);
    const variantById = new Map(
      ((vRows ?? []) as Array<{ id: string; sku: string | null; product: unknown }>).map((v) => {
        const product = Array.isArray(v.product) ? v.product[0] : v.product;
        return [v.id, { sku: v.sku, name: (product as { name?: string } | null)?.name ?? null }];
      })
    );

    return {
      success: true,
      data: {
        location: { id: loc.id, code: loc.code, name: loc.name },
        isReceiving: loc.purpose === "receiving",
        containers: containers
          .filter((c) => c.reference_type === "repair_order" && c.reference_id)
          .map((c) => {
            const ro = ros.get(c.reference_id!);
            return {
              id: c.id,
              code: c.code,
              status: c.status,
              location: { id: loc.id, code: loc.code, name: loc.name },
              repairOrderId: c.reference_id!,
              zlNumber: ro?.zl_number ?? null,
              clientName: ro?.client_name ?? null,
              itemCount: itemsByContainer.get(c.id) ?? 0,
            };
          }),
        loose: balances
          .map((b) => {
            const loose = Number(b.on_hand_quantity) - (inContainers.get(b.variant_id) ?? 0);
            const v = variantById.get(b.variant_id);
            return {
              variantId: b.variant_id,
              sku: v?.sku ?? null,
              productName: v?.name ?? null,
              quantity: loose,
              reserved: Math.max(Number(b.reserved_quantity) - Number(b.allocated_quantity), 0),
            };
          })
          .filter((l) => l.quantity > 0)
          .sort((a, b) => (a.sku ?? "").localeCompare(b.sku ?? "")),
      },
    };
  }

  static async putawayBatch(
    supabase: SupabaseClient,
    input: {
      actorUserId: string;
      organizationId: string;
      branchId: string;
      locationId: string | null;
      containerId: string | null;
      newContainerRepairOrderId: string | null;
      lines: Array<{ variantId: string; quantity: number; repairOrderLineId: string | null }>;
    }
  ): Promise<ServiceResult<PutawayBatchResult>> {
    const { data, error } = await supabase.rpc("inventory_putaway_batch", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_location_id: input.locationId,
      p_container_id: input.containerId,
      p_new_container_repair_order_id: input.newContainerRepairOrderId,
      p_lines: input.lines.map((l) => ({
        variant_id: l.variantId,
        quantity: l.quantity,
        repair_order_line_id: l.repairOrderLineId,
      })),
    });
    if (error) return { success: false, error: mapBatchError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        locationId: String(r.location_id),
        containerId: (r.container_id as string | null) ?? null,
        containerCode: (r.container_code as string | null) ?? null,
        containerCreated: r.container_created === true,
        lineCount: Number(r.line_count ?? input.lines.length),
      },
    };
  }

  /**
   * Repair orders whose locations changed since `since`: parts put away,
   * containers moved, parts issued. For each: where the order is now (new
   * ones flagged) and locations it left -- what to copy into AutoStacja.
   */
  static async listLocationChanges(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    since: string
  ): Promise<ServiceResult<LocationChange[]>> {
    const { data: headerRows, error: headerError } = await supabase
      .from("inventory_movement_headers")
      .select("id, movement_type_code, posted_at")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("status", "posted")
      .in("movement_type_code", ["801", "261"])
      .gte("posted_at", since)
      .order("posted_at", { ascending: true });
    if (headerError) return { success: false, error: "Failed to load movements" };
    const headers = (headerRows ?? []) as Array<{
      id: string;
      movement_type_code: string;
      posted_at: string;
    }>;
    if (headers.length === 0) return { success: true, data: [] };
    const headerById = new Map(headers.map((h) => [h.id, h]));

    const { data: lineRows } = await supabase
      .from("inventory_movement_lines")
      .select("id, movement_id, container_id, source_location_id, destination_location_id")
      .in(
        "movement_id",
        headers.map((h) => h.id)
      )
      .is("deleted_at", null);
    const lines = (lineRows ?? []) as Array<{
      id: string;
      movement_id: string;
      container_id: string | null;
      source_location_id: string | null;
      destination_location_id: string | null;
    }>;
    if (lines.length === 0) return { success: true, data: [] };

    // Lines linked to repair orders (putaway = relocation, RW = issue).
    const { data: linkRows } = await supabase
      .from("repair_order_line_movement_links")
      .select(
        "inventory_movement_line_id, relation_type, repair_order_line:repair_order_lines(repair_order_id)"
      )
      .in(
        "inventory_movement_line_id",
        lines.map((l) => l.id)
      )
      .in("relation_type", ["relocation", "issue"]);
    const roByLine = new Map<string, string>();
    for (const row of (linkRows ?? []) as Array<{
      inventory_movement_line_id: string;
      repair_order_line: unknown;
    }>) {
      const rol = Array.isArray(row.repair_order_line)
        ? row.repair_order_line[0]
        : row.repair_order_line;
      const roId = (rol as { repair_order_id?: string } | null)?.repair_order_id;
      if (roId) roByLine.set(row.inventory_movement_line_id, roId);
    }

    // Whole-container moves carry the container on the line.
    const movedContainerIds = [
      ...new Set(lines.map((l) => l.container_id).filter((id): id is string => !!id)),
    ];
    const { data: movedRows } = movedContainerIds.length
      ? await supabase
          .from("inventory_containers")
          .select("id, reference_type, reference_id")
          .in("id", movedContainerIds)
      : { data: [] };
    const roByContainer = new Map(
      (
        (movedRows ?? []) as Array<{
          id: string;
          reference_type: string | null;
          reference_id: string | null;
        }>
      )
        .filter((c) => c.reference_type === "repair_order" && c.reference_id)
        .map((c) => [c.id, c.reference_id!])
    );

    const receivingRes = await supabase
      .from("warehouse_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("purpose", "receiving")
      .is("deleted_at", null);
    const receivingIds = new Set(
      ((receivingRes.data ?? []) as Array<{ id: string }>).map((r) => r.id)
    );

    type Touch = { added: Set<string>; left: Set<string>; last: string };
    const touched = new Map<string, Touch>();
    for (const line of lines) {
      const header = headerById.get(line.movement_id);
      if (!header) continue;
      const roId =
        roByLine.get(line.id) ??
        (line.container_id ? roByContainer.get(line.container_id) : undefined);
      if (!roId) continue;
      const t = touched.get(roId) ?? { added: new Set(), left: new Set(), last: header.posted_at };
      if (header.movement_type_code === "801" && line.destination_location_id) {
        t.added.add(line.destination_location_id);
      }
      if (line.source_location_id && !receivingIds.has(line.source_location_id)) {
        t.left.add(line.source_location_id);
      }
      if (header.posted_at > t.last) t.last = header.posted_at;
      touched.set(roId, t);
    }
    const roIds = [...touched.keys()];
    if (roIds.length === 0) return { success: true, data: [] };

    // Where each order is now: its containers, plus bulk material reserved
    // for its lines at a location.
    const [containersRes, ros, rolRes] = await Promise.all([
      this.containersForRepairOrders(supabase, organizationId, branchId, roIds),
      repairOrdersById(supabase, roIds),
      supabase
        .from("repair_order_lines")
        .select("id, repair_order_id")
        .in("repair_order_id", roIds),
    ]);
    const containersByRo = containersRes.success ? containersRes.data : {};
    const roByRol = new Map(
      ((rolRes.data ?? []) as Array<{ id: string; repair_order_id: string }>).map((r) => [
        r.id,
        r.repair_order_id,
      ])
    );
    const { data: resRows } = roByRol.size
      ? await supabase
          .from("inventory_reservations")
          .select(
            "reference_id, lines:inventory_reservation_lines(location_id, reserved_quantity, released_quantity, fulfilled_quantity)"
          )
          .eq("reference_type", "repair_order_line")
          .in("reference_id", [...roByRol.keys()])
          .neq("status", "cancelled")
          .is("deleted_at", null)
      : { data: [] };
    const bulkLocsByRo = new Map<string, Set<string>>();
    for (const r of (resRows ?? []) as Array<{
      reference_id: string;
      lines: Array<{
        location_id: string | null;
        reserved_quantity: number;
        released_quantity: number;
        fulfilled_quantity: number;
      }> | null;
    }>) {
      const roId = roByRol.get(r.reference_id);
      if (!roId) continue;
      for (const rl of r.lines ?? []) {
        const open =
          Number(rl.reserved_quantity) -
          Number(rl.released_quantity) -
          Number(rl.fulfilled_quantity);
        if (open > 0 && rl.location_id && !receivingIds.has(rl.location_id)) {
          const set = bulkLocsByRo.get(roId) ?? new Set<string>();
          set.add(rl.location_id);
          bulkLocsByRo.set(roId, set);
        }
      }
    }

    const allLocIds = [
      ...roIds.flatMap((id) => [...(touched.get(id)?.left ?? [])]),
      ...roIds.flatMap((id) => [...(bulkLocsByRo.get(id) ?? [])]),
    ];
    const locs = await locationsById(supabase, allLocIds);

    const result: LocationChange[] = roIds.map((roId) => {
      const t = touched.get(roId)!;
      const current = new Map<string, LocationRef & { containers: string[]; isNew: boolean }>();
      for (const c of containersByRo[roId] ?? []) {
        if (!c.location || c.status !== "active") continue;
        const entry = current.get(c.location.id) ?? {
          ...c.location,
          containers: [],
          isNew: t.added.has(c.location.id),
        };
        entry.containers.push(c.code);
        current.set(c.location.id, entry);
      }
      for (const locId of bulkLocsByRo.get(roId) ?? []) {
        if (current.has(locId)) continue;
        const l = locs.get(locId);
        if (l) current.set(locId, { ...l, containers: [], isNew: t.added.has(locId) });
      }
      const released = [...t.left]
        .filter((id) => !current.has(id))
        .map((id) => locs.get(id))
        .filter((l): l is LocationRef => !!l);
      const ro = ros.get(roId);
      return {
        repairOrderId: roId,
        zlNumber: ro?.zl_number ?? null,
        clientName: ro?.client_name ?? null,
        vehicleBrand: ro?.vehicle_brand ?? null,
        current: [...current.values()].sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "")),
        released,
        lastChangeAt: t.last,
      };
    });
    result.sort((a, b) => b.lastChangeAt.localeCompare(a.lastChangeAt));
    return { success: true, data: result };
  }
}
