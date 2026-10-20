/**
 * @vitest-environment node
 *
 * Live check of the warehouse read queries against the real PostgREST API:
 * column names, embeds and FK hints (PGRST201, missing columns) only fail
 * there -- mocks accept any select string. Every query runs for an
 * organization that does not exist, so nothing real is read.
 *
 * Opt-in, skipped by default: LIVE_DB_TESTS=1 pnpm vitest run warehouse-queries.live
 * (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, read from .env.local).
 */
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(path.resolve(__dirname, "../../../../.env.local"));
} catch {
  // No .env.local: the suite is skipped below unless the env is set otherwise.
}

import { server } from "@/mocks/server";
import { createServiceClient } from "@/utils/supabase/service";
import { InventoryReservationsService } from "../inventory-reservations.service";
import { InventoryBlocksService } from "../inventory-blocks.service";
import { InventoryBalancesService } from "../inventory-balances.service";
import { InventoryReceivingService } from "../inventory-receiving.service";

const enabled =
  process.env.LIVE_DB_TESTS === "1" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const NONE = "00000000-0000-0000-0000-000000000000";

describe.skipIf(!enabled)("warehouse read queries (live PostgREST)", () => {
  // MSW intercepts every */rest/v1/* call and would answer with mock data.
  beforeAll(() => server.close());
  afterAll(() => server.listen({ onUnhandledRequest: "warn" }));

  const client = () => createServiceClient() as never;

  it.each([
    [
      "reservations: active, detailed",
      () => InventoryReservationsService.listActiveDetailed(client(), NONE, NONE, {}),
    ],
    [
      "reservations: by variant",
      () =>
        InventoryReservationsService.listActiveDetailed(client(), NONE, NONE, {
          variantIds: [NONE],
        }),
    ],
    [
      "reservations: history, detailed",
      () => InventoryReservationsService.listHistoryDetailed(client(), NONE, NONE, {}),
    ],
    [
      "reservations: available stock",
      () => InventoryReservationsService.listAvailableStock(client(), NONE, NONE, [NONE]),
    ],
    [
      "reservations: repair-order lines needing a part",
      () =>
        InventoryReservationsService.findLinesNeeding(client(), NONE, NONE, {
          variantId: NONE,
          sku: "ABC-1",
        }),
    ],
    [
      "blocks: active, detailed",
      () => InventoryBlocksService.listActiveDetailed(client(), NONE, NONE, {}),
    ],
    ["blocks: history", () => InventoryBlocksService.listHistory(client(), NONE, NONE, NONE)],
    [
      "balances: item stock per location",
      () => InventoryBalancesService.listForProduct(client(), NONE, NONE, NONE),
    ],
    [
      "receiving: documents behind the zone",
      () =>
        InventoryReceivingService.attachSources(client(), NONE, NONE, NONE, [
          { variantId: NONE, quantity: 1, repairOrderLineId: null } as never,
        ]),
    ],
  ])("%s", async (_name, run) => {
    const result = (await run()) as { success: boolean; error?: string };
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });
});
