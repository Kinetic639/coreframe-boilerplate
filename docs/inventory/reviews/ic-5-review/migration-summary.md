# IC-5 Migration Summary

All 11 migrations applied live via `mcp__supabase-target__apply_migration`,
each individually live-verified afterward (`pg_get_functiondef`,
`pg_proc` overload check via `oid::regprocedure`, `has_function_
privilege` for `anon`/`authenticated`/`service_role`, `pg_policies` for
RLS, `pg_get_constraintdef` for CHECK constraints) — never trusted from
`apply_migration`'s own success response alone. All mirrored locally
under `apps/web/supabase-target/supabase/migrations/` using the exact
live-reported version/timestamp from `list_migrations`.

## 1. `20260916182701_ic5_projection_quantity_nonnegative_check.sql`

`ALTER TABLE repair_order_line_locations ADD CONSTRAINT repair_order_
line_locations_quantity_nonnegative CHECK (quantity >= 0);`

Pre-check: `SELECT count(*) FROM repair_order_line_locations` returned
`0` live, confirming this was safe to add unconditionally (no existing
row could violate it).

## 2. `20260916182708_ic5_projection_tables_restrictive_rls.sql`

Adds explicit `RESTRICTIVE ... TO authenticated WITH CHECK (false)` /
`USING (false)` policies for INSERT/UPDATE/DELETE on both
`repair_order_line_locations` and `repair_order_location_attribution_
uncertain`. Pre-check confirmed both tables previously carried only a
SELECT policy (implicit-deny already in effect for writes) — this
migration makes that explicit/self-documenting, matching the closure
convention already used on `repair_order_line_movement_links` and the
IC-4 branch-transfer tables.

## 3. `20260916182731_ic5_rebuild_repair_order_projection_bucket_internal.sql`

New function `rebuild_repair_order_projection_bucket_internal(p_
organization_id, p_branch_id, p_location_id, p_variant_id) RETURNS
jsonb`. `SECURITY DEFINER`, `SET search_path TO 'public', 'pg_temp'`.
`REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` — reachable
only via same-owner (`postgres`) `SECURITY DEFINER` callers, matching
this project's established `_internal` pattern. Locks the bucket via
`SELECT ... FROM inventory_balances WHERE ... FOR UPDATE` (the same row
every other writer already locks). Deletes then fully recomputes every
RepairOrderLine's own known quantity at the bucket from:

```sql
SELECT rol.id, rol.repair_order_id,
       SUM(CASE WHEN sle.direction = 'increase' THEN 1 ELSE -1 END
           * sle.quantity * (rolml.applied_quantity / iml.quantity)) AS net_qty
FROM repair_order_line_movement_links rolml
JOIN repair_order_lines rol ON rol.id = rolml.repair_order_line_id
JOIN inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
JOIN inventory_stock_ledger_entries sle ON sle.movement_line_id = iml.id
  AND sle.balance_field = 'on_hand'
WHERE iml.organization_id = p_organization_id AND iml.branch_id = p_branch_id
  AND sle.location_id = p_location_id AND sle.variant_id = p_variant_id
GROUP BY rol.id, rol.repair_order_id
HAVING SUM(...) <> 0
```

Raises `P0008` (new SQLSTATE) if any line's own `net_qty < 0`, or if
`v_total_known > v_physical_on_hand` — never clamped. Sets/clears the
UNKNOWN marker based on `v_total_known < v_physical_on_hand`. Returns a
jsonb summary (`physical_on_hand`, `total_known`, `known_line_count`,
`unknown`).

## 4. `20260916182747_ic5_rebuild_repair_order_location_projection_rpc.sql`

New public wrapper `rebuild_repair_order_location_projection(p_actor_
user_id, p_organization_id, p_branch_id, p_repair_order_id) RETURNS
jsonb`. `SECURITY DEFINER`, actor-identity check (`28000`), permission
check (`has_branch_permission(..., '.operate')` OR `'.adjust'`,
`42501`). `anon` revoked; `authenticated`/`service_role` granted. Finds
every distinct `(location_id, variant_id)` bucket the RepairOrder's own
attribution history has ever touched, calls the internal primitive for
each, returns an array of per-bucket results.

## 5. `20260916182821_ic5_repair_order_location_attribution_sync_reversal_aware.sql`

First version of the trigger rewrite — superseded functionally-
identically by item 10 (which only adds `'relocation'` to the
reversal-mirroring filter). Both mirrored per forward-only discipline.
Adds a reversal-detection branch ahead of the existing logic: on a
`direction='decrease'` row belonging to a reversal (`mh.original_
movement_id IS NOT NULL`), finds the original line via exact `line_
number` ordinal correlation, mirrors its own `'receipt'`/`'issue'`
links onto the reversal's own movement line as new `'reversal'`-typed
links (`ON CONFLICT ... DO NOTHING`), calls the rebuild primitive for
the reversal's own source and (if present) destination buckets, `RETURN
NULL`. All pre-existing logic (confidence-based inference, putaway
UNKNOWN-stickiness) left byte-for-byte unchanged below this branch.

## 6. `20260916183020_ic5_attach_repair_order_line_movement_projection_sync.sql`

First version of the attach fix — superseded by item 11 due to a
self-caught double-write bug (both mirrored). Adds, after the
successful link INSERT, an UNCONDITIONAL call to the rebuild primitive
for the relevant bucket (`destination_location_id` for `'receipt'`,
`source_location_id` for `'issue'`). This unconditional form is the
root cause of the 101/104 regression fixed by item 11.

## 7. `20260916184159_ic5_movement_links_allow_relocation_relation_type.sql`

`ALTER TABLE repair_order_line_movement_links DROP CONSTRAINT repair_
order_line_movement_links_relation_type_check; ADD CONSTRAINT ... CHECK
(relation_type = ANY (ARRAY['receipt','issue','reversal','relocation']));`
Self-caught live while proving rebuild-equals-incremental: putaway's
own relocations were invisible to the rebuild formula since no link
row existed for them at all.

## 8. `20260916184230_ic5_putaway_repair_order_stock_relocation_link.sql`

First version of putaway's own relocation-link write — self-caught
defective correlation (field-value match: source/destination/variant/
quantity all equal, `LIMIT 1`), superseded by item 9.

## 9. `20260916184329_ic5_putaway_repair_order_stock_fix_line_correlation.sql`

Corrected version: fetches `SELECT array_agg(id ORDER BY line_number)
INTO v_movement_line_ids FROM inventory_movement_lines WHERE movement_
id = v_movement_id` once, immediately after the engine call, then in
the second (write) loop uses `v_movement_line_ids[v_line_index]`
(ordinal correlation by input-array position) instead of field
matching. **This is the live, authoritative version of
`putaway_repair_order_stock`.**

## 10. `20260916184357_ic5_trigger_mirror_relocation_on_reversal.sql`

Updates the trigger's own reversal-mirroring filter from `relation_
type IN ('receipt', 'issue')` to `relation_type IN ('receipt', 'issue',
'relocation')`, so a reversed putaway movement correctly restores the
pre-putaway projection too. **This is the live, authoritative version
of `repair_order_location_attribution_sync`.**

## 11. `20260916185523_ic5_fix_attach_double_write_via_authoritative_guc.sql`

Corrected, final version of `attach_repair_order_line_movement`: the
auto-rebuild call is now gated by `IF current_setting('ambra.repair_
order_attribution_authoritative', true) IS DISTINCT FROM 'on' THEN ...
END IF`. Self-caught live via the FULL regression suite itself (not
the new `107_...` file) — tests 101 and 104 both broke ("have 20, want
10") because `receive_repair_order_stock` calls `attach_repair_order_
line_movement` internally, which was unconditionally re-triggering a
rebuild that DUPLICATED receive's own subsequent direct additive
UPSERT. **This is the live, authoritative version of
`attach_repair_order_line_movement`.**

## Live parity confirmation

For every function/trigger touched, `pg_get_functiondef` was re-fetched
live after the final migration and confirmed byte-identical to the
locally mirrored file. `pg_proc` was queried by `proname` to confirm
exactly one live overload exists per function (no stale arity
duplicates left behind — this project's own known pitfall, re-checked
every time per standing discipline). Default-privilege re-grant was
re-checked via `has_function_privilege` after every `CREATE OR REPLACE`
— `anon` confirmed still revoked on both new/changed `SECURITY DEFINER`
functions.

## Backfill / existing-data disposition

Both `repair_order_line_locations` and `repair_order_location_
attribution_uncertain` were confirmed live, read-only, to hold zero
rows at the start of this phase. No drift analysis or backfill was
required or performed — this is disclosed explicitly rather than
silently assumed.

## IC-5 narrow correction pass (2026-09-16, same day) — 6 additional migrations

Same live-verification discipline applied to every one of these 6
migrations (fetch `pg_get_functiondef` after apply and diff against the
locally mirrored file; `pg_proc` overload check; `has_function_
privilege` grant re-check).

### 12. `20260916201207_ic5c_write_repair_order_line_movement_link_internal.sql`

New internal canonical writer, `write_repair_order_line_movement_link_
internal(p_repair_order_line_id, p_inventory_movement_line_id, p_
applied_quantity, p_relation_type) RETURNS jsonb`, first version (4
args). `SECURITY DEFINER`, hardened `search_path`, `REVOKE ALL ... FROM
PUBLIC, anon, authenticated, service_role`. Owns every generic
invariant applicable to all relation types: RepairOrderLine/movement-
line existence (with `FOR UPDATE OF iml` lock), org/branch
compatibility, posted status, variant compatibility where applicable,
positive quantity, the per-movement-line applied-quantity cap
(re-derived under lock, not trusted from the caller), duplicate/unique
handling via the pre-existing `(repair_order_line_id, inventory_
movement_line_id, relation_type)` unique index. Does NOT touch the
projection tables at all. **Superseded by item 16** (arity change, self-
caught live).

### 13. `20260916201228_ic5c_attach_uses_internal_writer.sql`

Refactors `attach_repair_order_line_movement` to delegate the actual
`INSERT` to the internal writer. Public contract unchanged: `relation_
type NOT IN ('receipt', 'issue')` is still rejected `22023` first,
before any other logic. Category/reference-type checks (relation-
specific, not generic) stay in attach, run BEFORE the internal writer
is called. The GUC-guarded auto-rebuild from the original IC-5 pass is
unchanged.

### 14. `20260916201300_ic5c_putaway_uses_internal_writer.sql`

Refactors `putaway_repair_order_stock`'s own relocation-link write to
call the internal writer instead of a direct `INSERT`. The internal
writer's own `23505` (duplicate) is caught and swallowed at this call
site — preserving putaway's own prior `ON CONFLICT DO NOTHING` silent-
retry-tolerance exactly. Ordinal movement-line correlation, UNKNOWN-
source hard rejection, quantity checks, direct projection writes, and
transaction semantics are all otherwise byte-for-byte unchanged.

### 15. `20260916201328_ic5c_trigger_bucket_fix_and_internal_writer.sql`

First version of the trigger fix (Finding A + part of Finding B
together). Replaces the reversal branch's own bucket derivation:
buckets are now read directly from `SELECT source_location_id,
destination_location_id FROM inventory_movement_lines WHERE id = NEW.
movement_line_id` (the reversal movement LINE itself), never from `NEW.
direction`/`NEW.location_id`, and each is rebuilt exactly once (`v_dest
IS DISTINCT FROM v_source` guard). Also replaces the reversal-mirroring
direct `INSERT` with a call to the internal writer (4-arg form at this
point). **Superseded by item 17** (the internal writer's own default
`p_require_posted=true` broke this call site, self-caught live — see
item 16's own comment).

### 16. `20260916201516_ic5c_internal_writer_add_require_posted_param.sql`

Self-caught, live-caught (via re-running the exact Finding-A
reproduction after item 15 went live): the internal writer's own
generic `status = 'posted'` check is legitimately load-bearing for
attach/putaway (both call it only against already-committed movement
lines) but is structurally inapplicable to the reversal trigger's own
mirror call — that call fires from the ledger-row `INSERT` INSIDE
`inventory_finalize_posting_internal`'s own effect-application loop,
BEFORE that function flips the header's own status to `'posted'` (a
timing artifact, not a business-meaningful draft state — the effect is
already durably applied within the same transaction, and atomicity
guarantees the header reaches `'posted'` or the whole transaction,
including the mirrored link, rolls back together). The masked symptom
observed live: `inventory_reverse_movement`'s own generic `WHEN OTHERS`
catch-all rethrew the underlying `55000` as an opaque `P0001`
("Movement reversal failed unexpectedly"), requiring the internal
writer's own function body to be read directly to diagnose. **Fix**:
`DROP FUNCTION ...(uuid, uuid, numeric, text)` (explicit, per this
project's own established arity-change discipline) followed by `CREATE
FUNCTION ...(uuid, uuid, numeric, text, p_require_posted boolean
DEFAULT true)`. The check becomes `IF p_require_posted AND v_ml.status
<> 'posted' THEN ...` — every existing caller (attach, putaway) keeps
the check via the default; only the trigger's own future call (item 17)
passes `false`. `REVOKE ALL` re-applied to the new 5-arg signature.
Live-verified exactly one overload (`(uuid,uuid,numeric,text,boolean)`)
exists after this migration — the old 4-arg form is genuinely gone,
not merely shadowed.

### 17. `20260916201541_ic5c_trigger_reversal_mirror_skip_posted_check.sql`

Updates the trigger's own reversal-mirror call to pass the new 5th
argument: `write_repair_order_line_movement_link_internal(..., false)`.
No other logic changes from item 15. **This is the live, authoritative,
final version of `repair_order_location_attribution_sync`.**

## Live parity confirmation, correction pass

Same discipline as the original pass: `pg_get_functiondef` re-fetched
live after the final migration for `write_repair_order_line_movement_
link_internal`, `attach_repair_order_line_movement`, `putaway_repair_
order_stock`, and `repair_order_location_attribution_sync`, each
confirmed byte-identical to its own locally mirrored file. `pg_proc`
confirmed exactly one overload per function (the internal writer's own
4-arg form is genuinely dropped, not merely superseded). `has_function_
privilege` confirmed `anon`/`authenticated`/`service_role` all still
lack `EXECUTE` on the internal writer after the arity change.
