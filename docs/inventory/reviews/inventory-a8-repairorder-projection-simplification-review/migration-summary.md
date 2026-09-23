# Inventory Core — A8 RepairOrder Projection Simplification — Migration Summary

7 migrations, applied live via MCP in the order below (each independently
live-verified — grants, `proacl`, `pg_get_functiondef`, trigger bindings,
overload counts, and live functional behavior all confirmed via direct
SQL and functional pgTAP-style probes, never trusting `apply_migration`'s
own success response alone), then mirrored locally under
`apps/web/supabase-target/supabase/migrations/` using the exact
live-reported timestamps. Order matters: the new read-only primitive is
added first (harmless, unwired), the 3 orchestrator functions are updated
next (each still functions correctly against the still-present old
schema during this window, since none of them depend on the trigger for
correctness), and only then are the trigger, the rebuild RPCs, and
finally the tables removed — at every step, the system remains fully
functional.

## 1. `20260922110637_a8_add_live_physical_state_read.sql`

Creates `get_repair_order_line_physical_state(p_organization_id uuid,
p_branch_id uuid, p_repair_order_line_id uuid) RETURNS jsonb` — the new
live-read primitive replacing the incremental projection.

**Scope**: bounded to exactly the `(location, variant)` buckets the given
RepairOrderLine has ever touched via `repair_order_line_movement_links`
— never the whole organization's attribution graph (per the task's own
"narrowest useful query" requirement).

**Formula**: reuses, verbatim, the proportional contribution formula
`rebuild_repair_order_projection_bucket_internal` used (removed in
migration 6) — not independently re-derived — EXTENDED with
reversal-awareness: for a linked movement line whose own header was
reversed (`inventory_movement_headers.reversal_movement_id IS NOT
NULL`), a `LATERAL` join also nets in the reversal's own corresponding
line (same `line_number`, guaranteed identical `quantity` per
`inventory_reverse_movement`'s own `INSERT`), using the same
`applied_quantity / iml.quantity` ratio. This replaces the removed
trigger's own write-time reversal-link-mirroring with a read-time JOIN —
**discovered necessary mid-pass**: an initial version without this
extension falsely raised P0008 after a legitimate, fully-reversed
receipt (the reversal's own new ledger effects had no corresponding
canonical link, since nothing creates one anymore) — found, diagnosed,
and fixed via live reproduction before this migration was written.

**Conservation/P0008 contract**: a bucket-level history inconsistency
(known attribution exceeding physical on-hand, or a negative net
contribution for any line at that bucket) fails explicitly via `RAISE
EXCEPTION ... P0008` — the exact SQLSTATE the old rebuild primitive used
for the same concept — never silently clamped or guessed.

**Security**: `SECURITY INVOKER`, not `DEFINER` — every underlying table
(`repair_order_line_movement_links`, `inventory_movement_lines`,
`inventory_stock_ledger_entries`, `inventory_balances`,
`repair_order_lines`, `repair_orders`) has RLS FORCED with an
`authenticated` SELECT grant (live-verified before choosing this), so
the function needs no actor/permission check of its own — it inherits
the caller's own existing RLS-scoped visibility, matching the exact
no-actor-check design `getPhysicalStateForLine` has always had.

**Live-verified**: `prosecdef=false`, 1 overload, grants
`authenticated=true, anon=false, service_role=true`. Functionally
verified against a normal case (returns correct per-location quantities)
and the fabricated-inconsistency case (raises P0008 with the exact
message).

## 2. `20260922110652_a8_attach_remove_projection_rebuild_call.sql`

`CREATE OR REPLACE FUNCTION public.attach_repair_order_line_movement` —
removes the GUC-gated call to `rebuild_repair_order_projection_bucket_internal`
(its only purpose was maintaining the projection removed in migration 7).
`write_repair_order_line_movement_link_internal`'s own canonical link
write — the sole remaining effect of this function beyond its own
actor/permission/reference validation — is unchanged. This removal was
**necessary, not optional**: the function's old body called a function
this pass was about to drop; leaving the call in place would have broken
`attach_repair_order_line_movement` the moment migration 6 ran.

## 3. `20260922110707_a8_receive_remove_projection_write.sql`

`CREATE OR REPLACE FUNCTION public.receive_repair_order_stock` — removes
the direct `repair_order_line_locations` `INSERT ... ON CONFLICT DO
UPDATE` write and the now-pointless
`set_config('ambra.repair_order_attribution_authoritative', ...)` call
(its only reader, the trigger, is removed in migration 5).
`attach_repair_order_line_movement`'s own canonical link write is now
the sole persisted attribution effect of a receipt. Physical movement
path (`inventory_receive_stock` call), provenance resolution,
actor/permission checks, and all receiving semantics are byte-identical
to the pre-A8 body otherwise.

## 4. `20260922110722_a8_putaway_live_attribution_check.sql`

`CREATE OR REPLACE FUNCTION public.putaway_repair_order_stock` — the
largest and most carefully-redesigned function in this pass. Replaces
the removed `repair_order_line_locations`/`repair_order_location_
attribution_uncertain` reads and writes with a single, pre-engine-call,
live-computed availability + bucket-consistency check, reusing the same
reversal-aware formula as migration 1.

**Design correction found live, mid-pass**: an initial two-pass design
(mirroring the OLD unlocked-pre-check + locked-post-engine-recheck
shape) was WRONG — the engine call itself mutates
`inventory_balances.on_hand_quantity` at the same bucket between the two
passes, so a post-engine re-derivation from physical balance
incorrectly compared live attribution against an ALREADY-REDUCED
`on_hand`, causing every normal full/near-full putaway to falsely raise
P0008. Found via live testing (a legitimate two-line, same-bucket batch
putaway failed unexpectedly), root-caused, and fixed by collapsing to a
SINGLE pass before the engine call, locking `inventory_balances`
there and holding it for the rest of the transaction (achieving the
same cross-transaction serialization the old post-engine `FOR UPDATE`
achieved, via the real physical resource rather than a derived
projection row).

**Second bug found and fixed live**: the first correct-shaped version
used an in-memory same-batch consumption tracker
(`v_consumed_by_variant`) keyed by **variant**, which incorrectly
shared consumption across DIFFERENT RepairOrderLines with the same SKU —
breaking same-SKU independence (a required IC-5 invariant). Found via a
live two-line-same-bucket test (line B's own 4-unit share was
incorrectly reduced by line A's own unrelated 6-unit consumption).
Fixed by re-keying the tracker by `repair_order_line_id`
(`v_consumed_by_line`) — it now only guards the same line appearing
twice in one call, never cross-line. Both the original bug and the fix
were reproduced and verified live before this migration was written.

**Old `repair_order_location_attribution_uncertain` "cannot putaway,
ambiguous" gate (`55000`) replaced** by the same explicit P0008
history-inconsistency contract used everywhere else in this pass — there
is no more heuristic guessing to be ambiguous about under the new
architecture; the only failure mode left is a genuine, detectable
inconsistency between canonical attribution and physical reality.

The removed `repair_order_line_locations` `UPDATE`/`INSERT` (source
decrement, destination increment) is gone; only the canonical relocation
link (`write_repair_order_line_movement_link_internal`, unchanged) is
written, after the engine call as before (a real `movement_line_id` is
required). All physical movement semantics unchanged.

**Live-verified**: full putaway, partial putaway, over-draw rejection
(`22023`), same-batch multi-line independence, same-line double-counting
guard, reversal-then-putaway rejection (`22023`, 0 available — not a
false P0008) — all confirmed correct.

## 5. `20260922110737_a8_drop_projection_trigger.sql`

`DROP TRIGGER repair_order_line_locations_ledger_sync ON
public.inventory_stock_ledger_entries; DROP FUNCTION
public.repair_order_location_attribution_sync();`

Verified live before dropping: exactly one trigger referenced this
function (confirmed via `pg_trigger`), and no other function in
`pg_proc` called it. Its two jobs — (a) reversal-link mirroring + full
bucket rebuild, (b) heuristic incremental-decrease guessing for generic
movements — are both superseded: (a) by migration 1's own read-time
reversal JOIN; (b) by removing the persisted projection this heuristic
existed to maintain — there is nothing left to guess at incrementally.
This is a purely generic-core table
(`inventory_stock_ledger_entries`); no generic ledger/audit trigger on
the same table was touched (live-verified other triggers remain, see
`test-evidence.md`).

## 6. `20260922110752_a8_drop_rebuild_functions.sql`

`DROP FUNCTION public.rebuild_repair_order_location_projection(...);
DROP FUNCTION public.rebuild_repair_order_projection_bucket_internal(...);`

Public wrapper dropped first (its own sole caller was the internal
bucket helper's own one remaining SQL caller — the trigger, already
removed in migration 5), so the internal helper had zero remaining
callers at the moment it was dropped. Both `DROP FUNCTION` statements
themselves would additionally fail loudly with a dependency error if any
caller had been missed — neither did (both succeeded cleanly). Zero
TypeScript callers of either RPC confirmed via repo-wide grep before
dropping.

## 7. `20260922110807_a8_drop_projection_tables.sql`

`DROP TABLE public.repair_order_location_attribution_uncertain; DROP
TABLE public.repair_order_line_locations;`

**Disposition: immediate removal, not staged deprecation** — a
deliberate departure from the task's own default preference, justified
by the task's own explicit exception clause ("if live/repo evidence
proves absolutely no dependency and dropping them now meaningfully
simplifies migration/reproducibility, immediate removal is allowed").
Evidence, live-checked immediately before this migration:

- **Zero rows, ever**: both tables had exactly 0 rows, in any
  organization — re-confirmed immediately before this migration (not
  merely "no recent writes"; no row has EVER been written by real
  application code, since the entire container/receiving/putaway
  subsystem has zero production callers today).
- **Zero remaining code readers/writers**: the TS reader
  (`getPhysicalStateForLine`) was updated to the new RPC in this same
  pass; the SQL readers/writers (the trigger, both rebuild RPCs) were
  dropped in migrations 5–6.
- **No external/reporting/BI path** reads these tables (repo-wide grep).

Given zero rows were EVER written, staging these tables "unwritten for
one release cycle" adds no real safety margin — there is no live
business data to protect, and keeping two permanently-inert tables with
their own RLS policies/grants/indexes indefinitely is exactly the kind
of dead-weight complexity this pass exists to remove. See
`architecture-evidence.md` for the full disposition reasoning.

## Local mirroring

All 7 migrations mirrored under their exact live-reported timestamps
(`20260922110637` through `20260922110807`). None was edited after being
applied — the two mid-pass bugs found in migration 1's and migration 4's
own initial versions were fixed BEFORE writing the final migration file,
via live iteration against the actual database, not via editing an
already-mirrored file.

## Zero data destruction

No business data was destroyed. The 2 dropped tables held zero rows
(verified immediately before dropping). All other changes are function/
trigger definition replacements or removals — schema/function changes
only.
