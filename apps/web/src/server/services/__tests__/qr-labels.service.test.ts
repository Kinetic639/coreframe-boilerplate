/**
 * @vitest-environment node
 *
 * QR label templates, layouts and print runs (docs/QR_LABELS_PLAN.md, Q3).
 * Supabase is mocked: every query chain resolves to the next queued result.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/service", () => ({ createServiceClient: vi.fn() }));

import {
  QrLabelLayoutsService,
  QrLabelTemplatesService,
  QrPrintBatchesService,
  zplSizeForConfig,
  type QrLabelTemplate,
} from "../qr-labels.service";
import { DEFAULT_LABEL_CONFIG } from "@/lib/qr/label-config";

type Result = { data?: unknown; error?: { message: string } | null };

/** A client whose every from()/rpc() chain resolves to the queued results in order. */
function mockClient(results: Result[]) {
  const calls: { table: string; ops: [string, unknown[]][] }[] = [];
  const next = () => {
    const r = results.shift() ?? { data: null, error: null };
    return { data: r.data ?? null, error: r.error ?? null };
  };
  const chain = (table: string) => {
    const entry = { table, ops: [] as [string, unknown[]][] };
    calls.push(entry);
    const proxy: Record<string, unknown> = {};
    for (const op of [
      "select",
      "insert",
      "update",
      "eq",
      "in",
      "is",
      "order",
      "limit",
      "single",
      "maybeSingle",
    ]) {
      proxy[op] = (...args: unknown[]) => {
        entry.ops.push([op, args]);
        return proxy;
      };
    }
    proxy.then = (resolve: (v: unknown) => unknown) => resolve(next());
    return proxy;
  };
  const client = {
    from: vi.fn((table: string) => chain(table)),
    rpc: vi.fn((fn: string, args: unknown) => {
      calls.push({ table: `rpc:${fn}`, ops: [["args", [args]]] });
      return Promise.resolve(next());
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const ORG = "org-1";

function template(overrides: Partial<QrLabelTemplate>): QrLabelTemplate {
  return {
    id: "tpl",
    organization_id: ORG,
    name: "T",
    target_type: null,
    layout_id: "layout-1",
    is_default: false,
    created_at: "",
    updated_at: "",
    layout: { id: "layout-1", format: "pdf", config: DEFAULT_LABEL_CONFIG },
    ...overrides,
  };
}

describe("zplSizeForConfig", () => {
  it("picks 70×40 for large labels in either orientation", () => {
    const at = (width: number, height: number) =>
      zplSizeForConfig({ ...DEFAULT_LABEL_CONFIG, dimension: { width, height } });
    expect(at(50, 30)).toBe("50x30");
    expect(at(70, 40)).toBe("70x40");
    expect(at(40, 70)).toBe("70x40");
  });
});

describe("QrLabelTemplatesService.pickDefault", () => {
  const general = template({ id: "general", is_default: true });
  const location = template({ id: "loc", target_type: "warehouse.location", is_default: true });
  const other = template({ id: "other", target_type: "warehouse.location" });

  it("prefers the object type's default", () => {
    expect(
      QrLabelTemplatesService.pickDefault([general, location, other], "warehouse.location")?.id
    ).toBe("loc");
  });

  it("falls back to the general default", () => {
    expect(QrLabelTemplatesService.pickDefault([general, location], "helpdesk.ticket")?.id).toBe(
      "general"
    );
    expect(QrLabelTemplatesService.pickDefault([general, location], null)?.id).toBe("general");
  });

  it("returns null when nothing is default", () => {
    expect(QrLabelTemplatesService.pickDefault([other], "warehouse.location")).toBeNull();
  });
});

describe("QrLabelLayoutsService.ensure", () => {
  it("returns the layout id from the server-only RPC", async () => {
    const { client, calls } = mockClient([{ data: "layout-9" }]);
    const result = await QrLabelLayoutsService.ensure(
      ORG,
      "zpl",
      DEFAULT_LABEL_CONFIG,
      "u",
      client
    );
    expect(result).toEqual({ success: true, data: "layout-9" });
    expect(calls[0].table).toBe("rpc:qr_label_layout_ensure");
    expect(calls[0].ops[0][1][0]).toMatchObject({ p_organization_id: ORG, p_format: "zpl" });
  });

  it("fails on an RPC error", async () => {
    const { client } = mockClient([{ error: { message: "boom" } }]);
    const result = await QrLabelLayoutsService.ensure(
      ORG,
      "pdf",
      DEFAULT_LABEL_CONFIG,
      null,
      client
    );
    expect(result.success).toBe(false);
  });
});

describe("QrLabelTemplatesService.update", () => {
  let service: { client: SupabaseClient; calls: { table: string; ops: [string, unknown[]][] }[] };
  beforeEach(async () => {
    const { createServiceClient } = await import("@/utils/supabase/service");
    const layoutClient = mockClient([{ data: "layout-new" }]);
    vi.mocked(createServiceClient).mockReturnValue(layoutClient.client as never);
    service = mockClient([{ data: template({ layout_id: "layout-new" }) }]);
  });

  it("points the template at the new layout version", async () => {
    const result = await QrLabelTemplatesService.update(service.client, ORG, "tpl", {
      config: DEFAULT_LABEL_CONFIG,
      format: "pdf",
      userId: "u",
    });
    expect(result.success).toBe(true);
    const patch = service.calls[0].ops.find(([op]) => op === "update")![1][0] as Record<
      string,
      unknown
    >;
    expect(patch.layout_id).toBe("layout-new");
    expect(patch).not.toHaveProperty("is_default");
  });

  it("drops the default flag when the type changes", async () => {
    await QrLabelTemplatesService.update(service.client, ORG, "tpl", {
      targetType: "planning.task",
      userId: "u",
    });
    const patch = service.calls[0].ops.find(([op]) => op === "update")![1][0] as Record<
      string,
      unknown
    >;
    expect(patch).toMatchObject({ target_type: "planning.task", is_default: false });
    expect(patch).not.toHaveProperty("layout_id");
  });
});

describe("QrPrintBatchesService", () => {
  it("createNew makes the batch first, then codes that belong to it", async () => {
    const { client, calls } = mockClient([
      { data: { id: "batch-1", kind: "new" } },
      { data: [{ id: "qr-1" }, { id: "qr-2" }] },
    ]);
    const result = await QrPrintBatchesService.createNew(client, ORG, {
      quantity: 2,
      name: "  Regał A ",
      layoutId: "layout-1",
      templateId: null,
      userId: "u",
    });
    expect(result.success).toBe(true);
    expect(calls[0].table).toBe("qr_print_batches");
    expect(calls[0].ops.find(([op]) => op === "insert")![1][0]).toMatchObject({
      kind: "new",
      quantity: 2,
      name: "Regał A",
      layout_id: "layout-1",
    });
    const rows = calls[1].ops.find(([op]) => op === "insert")![1][0] as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ batch_id: "batch-1", last_print_batch_id: "batch-1" });
  });

  it("recordReprint stores a reprint run and marks the codes", async () => {
    const { client, calls } = mockClient([{ data: { id: "batch-2" } }, {}]);
    const result = await QrPrintBatchesService.recordReprint(
      ORG,
      { qrCodeIds: ["a", "b", "a"], layoutId: "layout-1", templateId: "tpl", userId: "u" },
      client
    );
    expect(result.success).toBe(true);
    expect(calls[0].ops.find(([op]) => op === "insert")![1][0]).toMatchObject({
      kind: "reprint",
      quantity: 2,
      template_id: "tpl",
    });
    expect(calls[1].table).toBe("qr_codes");
    expect(calls[1].ops).toContainEqual(["update", [{ last_print_batch_id: "batch-2" }]]);
    expect(calls[1].ops).toContainEqual(["in", ["id", ["a", "b"]]]);
  });

  it("lastLayoutOf returns the shared layout only", async () => {
    const layout = { id: "L1", format: "pdf", config: DEFAULT_LABEL_CONFIG };
    const same = mockClient([
      {
        data: [
          { last_print_batch: { template_id: "tpl", layout } },
          { last_print_batch: { template_id: "tpl", layout } },
        ],
      },
    ]);
    const result = await QrPrintBatchesService.lastLayoutOf(same.client, ORG, ["a", "b"]);
    expect(result).toEqual({ success: true, data: { layout, templateId: "tpl" } });

    const mixed = mockClient([
      {
        data: [
          { last_print_batch: { template_id: null, layout } },
          { last_print_batch: { template_id: null, layout: { ...layout, id: "L2" } } },
        ],
      },
    ]);
    expect(await QrPrintBatchesService.lastLayoutOf(mixed.client, ORG, ["a", "b"])).toEqual({
      success: true,
      data: null,
    });

    const never = mockClient([{ data: [{ last_print_batch: null }] }]);
    expect(await QrPrintBatchesService.lastLayoutOf(never.client, ORG, ["a"])).toEqual({
      success: true,
      data: null,
    });
  });
});
