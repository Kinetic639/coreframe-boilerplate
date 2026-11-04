import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InventoryMovementsService } from "../inventory-movements.service";

function headerClient(rows: unknown[] = []) {
  const orFilters: string[] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "order"]) chain[m] = () => chain;
  chain.or = (filter: string) => (orFilters.push(filter), chain);
  chain.limit = () => Promise.resolve({ data: rows, error: null });
  return { client: { from: () => chain } as never, orFilters };
}

describe("InventoryMovementsService.getMovementDetail lookup", () => {
  it("falls back to the document number when a posted header has no route_key", async () => {
    const { client, orFilters } = headerClient();
    await InventoryMovementsService.getMovementDetail(client, "org", "br", "PZ-2026-000006");
    expect(orFilters).toEqual([
      'route_key.eq."PZ-2026-000006",draft_number.eq."PZ-2026-000006",document_number.like."PZ_2026_000006",draft_number.like."PZ_2026_000006"',
    ]);
  });

  it("finds an AutoStacja number with brackets (PZ(315)/1/26/3332)", async () => {
    const { client, orFilters } = headerClient();
    await InventoryMovementsService.getMovementDetail(client, "org", "br", "PZ(315)-1-26-3332");
    expect(orFilters[0]).toContain('document_number.like."PZ(315)_1_26_3332"');
  });

  it("keeps the filter intact: values are quoted, quotes and commas are stripped", async () => {
    const { client, orFilters } = headerClient();
    await InventoryMovementsService.getMovementDetail(client, "org", "br", 'PZ-1",id.eq.x)');
    expect(orFilters[0]).not.toContain(",id.");
    // four values, each one quoted: no quote got through from the input
    expect(orFilters[0].split('"').length - 1).toBe(8);
    expect(orFilters[0]).toContain('route_key.eq."PZ-1IDEQX)"');
  });
});
