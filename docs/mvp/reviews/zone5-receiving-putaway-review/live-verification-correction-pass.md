# Zone 5 — Live/MCP Verification Pass: Narrow Correction Bundle

> Per the working rule: "Do NOT create another correction bundle unless code changes; if a real
> discrepancy DOES require code changes, create a narrow correction bundle for external review."
> This pass required two narrow, real code fixes (below) — this document exists because of those,
> not as a full regeneration of the static-review bundle (`review-context.md` /
> `migration-summary.md` / `changed-files.md`, which predate any live DB access and remain
> accurate for everything they cover). This document is additive: it records what changed and why,
> once Supabase MCP access made live verification possible for the first time this project.

## Scope

All 5 Zone 5 migrations were applied to the live Supabase target project this pass, each gated by
a live pre-apply compatibility check against the actual inventory engine contract (ledger table
shape, `inventory_movement_lines` shape, `inventory_balances` key/lock shape,
`inventory_create_and_finalize`'s exact signature, `has_branch_permission`'s signature, RLS
posture). **No load-bearing mismatch was found between the architecture's assumptions and live
reality** — the two real bugs found (below) were both implementation-detail bugs in the migrations'
own SQL bodies, invisible to any static/schema-level review, discoverable only by actual
execution. Full pgTAP re-execution, Zone 3 regression, and real two-connection concurrency testing
all followed; results are summarized in `05-receiving-putaway-progress.md`'s "Live/MCP
verification pass" section. This document focuses specifically on the **code changes**.

## Fix 1 — `max(uuid)` / `min(uuid)` do not exist in standard PostgreSQL

**Discovered by**: live execution of pgTAP `095` (attribution-sync trigger), test #2 — the
single-unambiguous-source propagation branch. Raises `ERROR: function max(uuid) does not exist`
only when the aggregate branch actually executes; invisible to `CREATE FUNCTION`, to any type
check, and to every prior static review pass (three correction passes, all of which read this
exact query text without catching it — `uuid` has comparison operators but no default aggregate,
which is not obvious from the type's own definition).

**Two instances, two different fix mechanisms** (per the "never edit an applied migration in
place" rule):

1. `repair_order_location_attribution_sync()` (the trigger) — **already applied** to the live DB
   before this bug was found. Fixed via a **new forward migration**:
   `20260913000000_zone5_attribution_sync_trigger_max_uuid_fix.sql`. `CREATE OR REPLACE FUNCTION`
   redefines the same function (same name/signature/OID); the already-attached trigger picks up
   the new body automatically — no `DROP`/`CREATE TRIGGER` needed.
2. `receive_repair_order_stock()` — **not yet applied** at the time this bug was found (this
   session applies migrations one-by-one, verifying each before moving to the next). Fixed
   directly in the local migration file
   (`20260912093000_zone5_receive_repair_order_stock_rpc.sql`) — legitimate, since nothing live
   existed yet to conflict with.

**The fix** (identical shape in both places): cast the `uuid` column to `text` for the aggregate,
then cast the result back to `uuid`.

```sql
-- Before (invalid — max(uuid)/min(uuid) do not exist):
SELECT sum(quantity), count(DISTINCT repair_order_line_id),
       max(repair_order_line_id), max(repair_order_id)
  INTO v_attributed_sum, v_distinct_lines, v_line_id, v_ro_id
  FROM locked_rows;

-- After:
SELECT sum(quantity), count(DISTINCT repair_order_line_id),
       max(repair_order_line_id::text)::uuid, max(repair_order_id::text)::uuid
  INTO v_attributed_sum, v_distinct_lines, v_line_id, v_ro_id
  FROM locked_rows;
```

**Why this is safe**: in both call sites, the aggregate is only ever _used_ once the same
statement's own `count(DISTINCT ...) = 1` check has confirmed exactly one distinct value exists
in the set. `max()`/`min()` over a single repeated value is that value, regardless of the
comparison/ordering semantics used to reach it — text-based lexicographic ordering is exactly as
safe as any other ordering when there is only ever one candidate.

## Fix 2 — `RAISE EXCEPTION` with a `%` placeholder and zero arguments

**Discovered by**: the first live `apply_migration` attempt for
`receive_repair_order_stock` — this bug surfaces at `CREATE FUNCTION` **compile** time (PL/pgSQL
validates `RAISE` argument counts against placeholders eagerly), so it was caught before any
pgTAP execution, but still only by actually attempting to apply the migration live — not by any
static review.

Two statements, both missing their intended `v_line_index` argument:

```sql
-- Before:
RAISE EXCEPTION 'Resolved RepairOrder for line % does not belong to the target organization/branch' USING ERRCODE = '42501';
RAISE EXCEPTION 'Resolved RepairOrderLine variant for line % does not match the received variant' USING ERRCODE = '22023';

-- After:
RAISE EXCEPTION 'Resolved RepairOrder for line % does not belong to the target organization/branch', v_line_index USING ERRCODE = '42501';
RAISE EXCEPTION 'Resolved RepairOrderLine variant for line % does not match the received variant', v_line_index USING ERRCODE = '22023';
```

Fixed directly in the local, not-yet-applied migration file (same file as Fix 1) — applied
together, in one `apply_migration` call, once both were corrected. All other `RAISE EXCEPTION`
statements across all 5 Zone 5 migrations were manually re-checked for the same class of bug after
this was found; no further instances exist.

## Non-code findings (fixture-only, no design change)

Every other live-execution issue found this pass was a gap in the **pgTAP test fixtures**
themselves (missing FK-satisfying rows, a newly-discovered composite unique index added by a later
migration, `auth.uid()` needing an explicit GUC outside a real PostgREST session, one wrong
expected SQLSTATE given an unpermissioned fixture actor) — never in the migrations' own DDL or the
RPCs'/trigger's actual logic. Full detail in `05-receiving-putaway-progress.md`.

One structural nuance worth flagging explicitly for future reference: `review-context.md` §I's
claim that ambiguous Matcher-line provenance is reachable via "no unique constraint exists on
`wdd_matcher_line_id`" is now **partially superseded** — a later migration
(`20260910075359_workshop_source_document_lines_matcher_line_unique.sql`, dated after the
migration the original claim cited) added a composite `UNIQUE (workshop_source_document_id,
wdd_matcher_line_id) WHERE wdd_matcher_line_id IS NOT NULL` index. The ambiguous-provenance
scenario remains genuinely reachable (confirmed live, `096` test 4), just via a structurally
different path: two lines under two _different_ source documents referencing the same matcher
line, rather than two lines under the _same_ document. `receive_repair_order_stock`'s own
ambiguity check operates purely on `wdd_matcher_line_id` regardless of which document(s) it came
from, so this is a refinement to how the scenario is _constructed_, not a change to the RPC's
actual rejection behavior.
