/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { HelpdeskTicketsService } from "../helpdesk-tickets.service";
import type { DataViewListParams } from "@/lib/data-view/types";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

type Operation = {
  table: string;
  action: string;
  args?: unknown[];
};

/**
 * Minimal chainable Supabase query builder mock, following the pattern used
 * by crm-parties.service.test.ts: every filter method records the call and
 * returns the same chain, and the final call in the chain (`.range()` /
 * `.limit()`) sets the resolved `data`/`count`. Awaiting a non-Promise chain
 * object resolves to the object itself, which is enough to destructure
 * `{ data, error, count }` the way the service does.
 */
function createChain(table: string, operations: Operation[]) {
  const chain = {
    data: [] as unknown[],
    error: null as { message: string } | null,
    count: 0 as number | null,
    select(...args: unknown[]) {
      operations.push({ table, action: "select", args });
      return chain;
    },
    eq(...args: unknown[]) {
      operations.push({ table, action: "eq", args });
      return chain;
    },
    is(...args: unknown[]) {
      operations.push({ table, action: "is", args });
      return chain;
    },
    in(...args: unknown[]) {
      operations.push({ table, action: "in", args });
      return chain;
    },
    or(...args: unknown[]) {
      operations.push({ table, action: "or", args });
      return chain;
    },
    gte(...args: unknown[]) {
      operations.push({ table, action: "gte", args });
      return chain;
    },
    lte(...args: unknown[]) {
      operations.push({ table, action: "lte", args });
      return chain;
    },
    neq(...args: unknown[]) {
      operations.push({ table, action: "neq", args });
      return chain;
    },
    not(...args: unknown[]) {
      operations.push({ table, action: "not", args });
      return chain;
    },
    order(...args: unknown[]) {
      operations.push({ table, action: "order", args });
      return chain;
    },
    limit(...args: unknown[]) {
      operations.push({ table, action: "limit", args });
      return chain;
    },
    range(...args: unknown[]) {
      operations.push({ table, action: "range", args });
      return chain;
    },
  };
  return chain;
}

function createSupabaseMock() {
  const operations: Operation[] = [];
  return {
    operations,
    client: {
      from: vi.fn((table: string) => createChain(table, operations)),
    } as unknown as import("@supabase/supabase-js").SupabaseClient,
  };
}

function baseParams(overrides: Partial<DataViewListParams> = {}): DataViewListParams {
  return {
    search: "",
    sort: { field: "created_at", direction: "desc" },
    page: 1,
    pageSize: 20,
    filters: {},
    ...overrides,
  };
}

function getOrArg(operations: Operation[]): string {
  const orCalls = operations.filter((op) => op.table === "helpdesk_tickets" && op.action === "or");
  expect(orCalls).toHaveLength(1);
  return orCalls[0].args?.[0] as string;
}

// ---------------------------------------------------------------------------
// Grammar-safety oracle
//
// These two helpers are a minimal, deliberately narrow re-implementation of
// the *value* grammar PostgREST actually uses for or()/and() logic-tree
// filters (see PostgREST.ApiRequest.QueryParams: `pLogicSingleVal` splits
// unquoted values on `noneOf ",)"`; `pQuotedValue`/`pCharsOrSlashed` reads a
// quoted value as `noneOf "\\\""`, with `\` escaping the following
// character). They exist only to prove, against the real parsing rules,
// that our escaping keeps the filter structure intact — not as a general
// PostgREST parser.
// ---------------------------------------------------------------------------

/** Splits a `cond1,cond2` or() body on commas that are outside any quoted
 * span, mirroring how PostgREST's `sepBy1 pLogicTree (char ',')` would see
 * it. A "," or ")" embedded inside a properly quoted+escaped value must
 * never produce an extra element here. */
function splitTopLevelConditions(orBody: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < orBody.length; i++) {
    const ch = orBody[i];
    if (inQuotes) {
      if (ch === "\\" && i + 1 < orBody.length) {
        current += ch + orBody[i + 1];
        i++;
        continue;
      }
      if (ch === '"') inQuotes = false;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      current += ch;
      continue;
    }
    if (ch === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/** Mirrors PostgREST's `pCharsOrSlashed`: inside a quoted value, `\` escapes
 * (and is dropped before) the very next character; everything else is
 * literal. Recovers the exact bytes PostgREST would hand to Postgres as the
 * ILIKE pattern. */
function unescapeQuotedValue(quoted: string): string {
  const inner = quoted.slice(1, -1); // strip surrounding "
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && i + 1 < inner.length) {
      out += inner[i + 1];
      i++;
    } else {
      out += inner[i];
    }
  }
  return out;
}

/** Independent re-derivation (not imported from production code) of what
 * the final ILIKE pattern Postgres receives *should* be for a given raw
 * search term: user-typed LIKE metacharacters neutralized, wrapped in our
 * own wildcard `%`. */
function expectedIlikePattern(raw: string): string {
  const likeSafe = raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${likeSafe}%`;
}

describe("HelpdeskTicketsService.listForDataView search", () => {
  it("matches both title and ticket_number for a normal ticket number", async () => {
    const { client, operations } = createSupabaseMock();
    const result = await HelpdeskTicketsService.listForDataView(
      client,
      ORG_ID,
      baseParams({ search: "HD-000012" })
    );
    expect(result.success).toBe(true);

    const orArg = getOrArg(operations);
    const [titleCond, numberCond] = splitTopLevelConditions(orArg);
    expect(titleCond).toBe('title.ilike."%HD-000012%"');
    expect(numberCond).toBe('ticket_number.ilike."%HD-000012%"');
  });

  it("matches both title and ticket_number for normal title text with spaces", async () => {
    const { client, operations } = createSupabaseMock();
    const result = await HelpdeskTicketsService.listForDataView(
      client,
      ORG_ID,
      baseParams({ search: "Zwrot urządzenia" })
    );
    expect(result.success).toBe(true);

    const orArg = getOrArg(operations);
    const [titleCond] = splitTopLevelConditions(orArg);
    expect(titleCond).toBe('title.ilike."%Zwrot urządzenia%"');
  });

  it("does not filter by or() when no search term is provided", async () => {
    const { client, operations } = createSupabaseMock();
    const result = await HelpdeskTicketsService.listForDataView(client, ORG_ID, baseParams());
    expect(result.success).toBe(true);

    const orCalls = operations.filter(
      (op) => op.table === "helpdesk_tickets" && op.action === "or"
    );
    expect(orCalls).toHaveLength(0);
  });

  describe("edge-case search input cannot alter the OR filter structure", () => {
    const dangerousInputs = [
      "comma, inside",
      "trailing paren)",
      "nested (parens) here)",
      'quote " inside',
      "back\\slash",
      "mixed \\\"',) chaos",
      "percent 50% wildcard",
      "underscore a_b wildcard",
    ];

    it.each(dangerousInputs)("keeps exactly 2 top-level or() conditions for %j", async (search) => {
      const { client, operations } = createSupabaseMock();
      const result = await HelpdeskTicketsService.listForDataView(
        client,
        ORG_ID,
        baseParams({ search })
      );
      expect(result.success).toBe(true);

      const orArg = getOrArg(operations);
      const conditions = splitTopLevelConditions(orArg);
      // A comma/close-paren in `search` must not create a 3rd/4th
      // top-level condition (would mean the OR grammar was broken) and
      // must not disappear into one truncated condition (would mean it
      // silently narrowed instead of matching literally).
      expect(conditions).toHaveLength(2);
      expect(conditions[0].startsWith("title.ilike.")).toBe(true);
      expect(conditions[1].startsWith("ticket_number.ilike.")).toBe(true);
    });

    it.each(dangerousInputs)(
      "round-trips to the exact literal ILIKE pattern for %j",
      async (search) => {
        const { client, operations } = createSupabaseMock();
        await HelpdeskTicketsService.listForDataView(client, ORG_ID, baseParams({ search }));

        const orArg = getOrArg(operations);
        const [titleCond] = splitTopLevelConditions(orArg);
        const quotedValue = titleCond.slice("title.ilike.".length);

        // Recover what Postgres would actually receive as the ILIKE
        // pattern (mirroring PostgREST's own quoted-value unescaping) and
        // confirm it is exactly the literal, wildcard-escaped pattern we
        // intended — not a truncated or restructured one.
        expect(unescapeQuotedValue(quotedValue)).toBe(expectedIlikePattern(search));
      }
    );
  });
});

describe("HelpdeskTicketsService.listForCalendar unscheduled search", () => {
  const calendarParams = {
    rangeStart: "2026-09-01",
    rangeEnd: "2026-09-30",
    rangeStartIso: "2026-09-01T00:00:00.000Z",
    rangeEndIso: "2026-09-30T23:59:59.999Z",
    includeUnscheduled: true,
    unscheduledLimit: 10,
  };

  it("matches both title and ticket_number for the unscheduled-ticket picker", async () => {
    const { client, operations } = createSupabaseMock();
    const result = await HelpdeskTicketsService.listForCalendar(client, ORG_ID, {
      ...calendarParams,
      unscheduledSearch: "HD-000012",
    });
    expect(result.success).toBe(true);

    const orArg = getOrArg(operations);
    const [titleCond, numberCond] = splitTopLevelConditions(orArg);
    expect(titleCond).toBe('title.ilike."%HD-000012%"');
    expect(numberCond).toBe('ticket_number.ilike."%HD-000012%"');
  });

  it("keeps exactly 2 top-level or() conditions when the search contains a comma and a paren", async () => {
    const { client, operations } = createSupabaseMock();
    const result = await HelpdeskTicketsService.listForCalendar(client, ORG_ID, {
      ...calendarParams,
      unscheduledSearch: "Zwrot (pilne), dziś",
    });
    expect(result.success).toBe(true);

    const orArg = getOrArg(operations);
    expect(splitTopLevelConditions(orArg)).toHaveLength(2);
  });
});
