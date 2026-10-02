import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InventoryMovementsService } from "../inventory-movements.service";

function headerClient() {
  const orFilters: string[] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "order"]) chain[m] = () => chain;
  chain.or = (filter: string) => (orFilters.push(filter), chain);
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return { client: { from: () => chain } as never, orFilters };
}

describe("InventoryMovementsService.getMovementDetail lookup", () => {
  it("falls back to the document number when a posted header has no route_key", async () => {
    const { client, orFilters } = headerClient();
    await InventoryMovementsService.getMovementDetail(client, "org", "br", "PZ-2026-000006");
    expect(orFilters).toEqual([
      'route_key.eq.PZ-2026-000006,draft_number.eq.PZ-2026-000006,document_number.eq."PZ/2026/000006"',
    ]);
  });

  it("strips characters that could break the filter", async () => {
    const { client, orFilters } = headerClient();
    await InventoryMovementsService.getMovementDetail(client, "org", "br", "PZ-1,id.eq.x)");
    expect(orFilters[0]).not.toMatch(/[,()]id/);
    expect(orFilters[0]).toContain("route_key.eq.PZ-1ideqx");
  });
});
