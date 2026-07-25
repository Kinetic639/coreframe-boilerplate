/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { WddMatcherService } from "../wdd-matcher.service";

type QueryResponse = { data?: unknown; error?: { message: string; code?: string } | null };

function query(response: QueryResponse) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    order: vi.fn(() => Promise.resolve(response)),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    then: (resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return api;
}

function supabaseMock(responses: Record<string, QueryResponse[]>) {
  const from = vi.fn((table: string) => {
    const next = responses[table]?.shift();
    if (!next) throw new Error(`No mock response for ${table}`);
    return query(next);
  });
  return { from } as never;
}

describe("WddMatcherService.getMovementImportCandidates", () => {
  it("returns WDD lines with matched order context and direct incoming lines without order", async () => {
    const session = {
      id: "session-1",
      organization_id: "org-1",
      branch_id: "branch-1",
      name: "Dostawa 26.06.2026 22:09",
      status: "ready_for_review",
      match_summary: null,
      created_by: "user-1",
      approved_by: null,
      approved_at: null,
      created_at: "2026-06-26T20:09:00.000Z",
      updated_at: "2026-06-26T20:09:00.000Z",
    };
    const blocks = [
      {
        id: "wdd-block-1",
        session_file_id: "file-1",
        session_id: "session-1",
        organization_id: "org-1",
        block_index: 2,
        block_type: "wdd_reconciliation",
        block_header_text: "WDD block",
        warehouse_section: null,
        brand_label: null,
        from_section: null,
        to_section: null,
        is_excluded: false,
        page_number: 1,
        metadata: {
          wdd_number: "WDD/1488/26/3142",
          group_name: "BRA_SKO",
          warehouse_code: "115",
        },
        created_at: "2026-06-26T20:09:00.000Z",
      },
      {
        id: "direct-block-1",
        session_file_id: "file-1",
        session_id: "session-1",
        organization_id: "org-1",
        block_index: 3,
        block_type: "direct_order",
        block_header_text: "Direct block",
        warehouse_section: null,
        brand_label: null,
        from_section: null,
        to_section: null,
        is_excluded: false,
        page_number: 2,
        metadata: {},
        created_at: "2026-06-26T20:09:00.000Z",
      },
      {
        id: "brand-block-1",
        session_file_id: "file-2",
        session_id: "session-1",
        organization_id: "org-1",
        block_index: 1,
        block_type: "brand_order",
        block_header_text: "Order block",
        warehouse_section: null,
        brand_label: null,
        from_section: null,
        to_section: null,
        is_excluded: false,
        page_number: 1,
        metadata: { order_number: "BLWK/6", zl_number: "ZL/1" },
        created_at: "2026-06-26T20:09:00.000Z",
      },
    ];
    const supabase = supabaseMock({
      wdd_matcher_sessions: [{ data: session, error: null }],
      wdd_matcher_blocks: [{ data: blocks, error: null }],
      wdd_matcher_block_matches: [
        {
          data: [
            {
              id: "match-1",
              session_id: "session-1",
              organization_id: "org-1",
              bc_block_id: "wdd-block-1",
              brand_block_id: "brand-block-1",
              wdd_block_id: null,
              block_match_type: "exact",
              block_confidence: 98,
              block_match_reasons: {},
              review_status: "pending",
              reviewed_by: null,
              reviewed_at: null,
              reviewer_notes: null,
              created_at: "2026-06-26T20:09:00.000Z",
              updated_at: "2026-06-26T20:09:00.000Z",
            },
          ],
          error: null,
        },
      ],
      wdd_matcher_lines: [
        {
          data: [
            {
              id: "line-wdd-1",
              block_id: "wdd-block-1",
              session_id: "session-1",
              organization_id: "org-1",
              line_number: 1,
              product_code: "57H823031",
              product_name: "Pokrywa przednia",
              quantity: 1,
              unit: "SZT",
              location: "PRZY A1",
              raw_text: null,
              page_number: 1,
              metadata: { idp_raw: "1" },
              created_at: "2026-06-26T20:09:00.000Z",
            },
            {
              id: "line-direct-1",
              block_id: "direct-block-1",
              session_id: "session-1",
              organization_id: "org-1",
              line_number: 1,
              product_code: "ABC123",
              product_name: "Direct item",
              quantity: 2,
              unit: "SZT",
              location: null,
              raw_text: null,
              page_number: 2,
              metadata: {},
              created_at: "2026-06-26T20:09:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });

    const result = await WddMatcherService.getMovementImportCandidates(
      supabase,
      "session-1",
      "org-1",
      "branch-1"
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lines).toHaveLength(2);
    expect(result.data.lines[0]).toMatchObject({
      sourceLineId: "line-wdd-1",
      sourceBlockType: "wdd_reconciliation",
      wddNumber: "WDD/1488/26/3142",
      orderNumber: "BLWK/6",
      parsedLocation: "PRZY A1",
    });
    expect(result.data.lines[1]).toMatchObject({
      sourceLineId: "line-direct-1",
      sourceBlockType: "direct_order",
      orderNumber: null,
    });
  });

  it("rejects cross-branch sessions", async () => {
    const supabase = supabaseMock({
      wdd_matcher_sessions: [
        {
          data: {
            id: "session-1",
            organization_id: "org-1",
            branch_id: "other-branch",
            name: "Dostawa",
            status: "ready_for_review",
            match_summary: null,
            created_by: "user-1",
            approved_by: null,
            approved_at: null,
            created_at: "2026-06-26T20:09:00.000Z",
            updated_at: "2026-06-26T20:09:00.000Z",
          },
          error: null,
        },
      ],
    });

    const result = await WddMatcherService.getMovementImportCandidates(
      supabase,
      "session-1",
      "org-1",
      "branch-1"
    );

    expect(result).toEqual({
      success: false,
      error: "Matcher session belongs to another branch",
    });
  });
});
