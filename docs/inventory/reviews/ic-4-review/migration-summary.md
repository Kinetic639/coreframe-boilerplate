# IC-4 — Migration Summary

**Updated by the IC-4 correction pass (2026-09-16)** — see item 13 below
and `test-evidence.md`'s own correction-pass section. Bundle refreshed
in place (existing `ic-4-review/` updated, not superseded), matching
this project's own established convention (IC-1's own "external review
— correction pass" refreshed the existing `ic-1-review/` bundle rather
than creating a new one).

12 (now 13) forward migrations, applied via Supabase MCP `apply_migration`,
live-verified after every apply, then mirrored locally under their exact
live-reported version/timestamp. No already-applied migration was edited
in place — every fix (including the two self-caught defects) is a new
forward migration. This is more than the plan's own original 3-5 estimate
— disclosed honestly: the original estimate predated the live audit that
found `inventory_accept_branch_transfer`/`inventory_decline_branch_
transfer` completely broken and hand-writing balances (not merely
missing a reservation handshake), which required a materially larger
rebuild (a new movement type, a new discrepancy table, 2 new RPCs) than
the original plan anticipated.

## 1. `20260916065129_ic4_branch_transfer_status_lifecycle`

Drops the old 3-value status CHECK (`in_transit`/`accepted`/`declined`),
replaces it with the 6-value lifecycle (`prepared`/`in_transit`/
`accepted`/`partially_accepted`/`declined`/`cancelled`); default status
now `prepared`. Adds `cancelled_by`/`cancelled_at`/`cancel_reason`
columns (decline already had `declined_by`/`declined_at`/`decline_
reason`; cancel needed its own, since it is a distinct, source-side
decision).

## 2. `20260916065136_ic4_branch_transfer_lines_sent_accepted_quantity`

Adds `sent_quantity`/`accepted_quantity` to `inventory_branch_transfer_
lines`, both nullable until SEND/ACCEPT respectively, with `accepted_
quantity <= sent_quantity` enforced by CHECK.

## 3. `20260916065147_ic4_branch_transfer_discrepancies_table`

New `inventory_branch_transfer_discrepancies` table (one row per
under-received line): `sent_quantity`/`accepted_quantity`/`missing_
quantity` (CHECK `missing = sent - accepted`, CHECK `missing > 0`),
linked to the transfer, the specific transfer line, and the destination
movement that posted the accepted portion. RLS: scoped SELECT (source or
destination branch `warehouse.inventory.read`), RESTRICTIVE deny on
INSERT/UPDATE/DELETE for `authenticated` — only the accept RPC (`SECURITY
DEFINER`, owned by `postgres`, bypasses RLS) ever writes it.

Also adds `inventory_branch_transfers_id_org_unique` (composite UNIQUE
on `id, organization_id`), needed for the discrepancies table's own
composite FK to `inventory_branch_transfers(id, organization_id)`.

## 4. `20260916065209_ic4_fix_redundant_id_org_unique_constraint`

**Self-caught defect, fixed before any test ran**: migration 3's own new
UNIQUE constraint duplicated a pre-existing index (`inventory_branch_
transfers_id_org_uidx`, already present from an earlier, IC-4-unrelated
migration) — live-caught by inspecting `pg_indexes` immediately after
applying migration 3. Dropped the redundant duplicate; the composite FK
still resolves against the pre-existing index.

## 5. `20260916065249_ic4_seed_movement_type_312_transfer_in`

Extends `inventory_seed_movement_types_internal` (the same idempotent
per-org seed function IC-2 extended for `900`/`KOR`) with a new `312`
("Inter-Branch Transfer In") movement type: `requires_source_location=
false`, `requires_destination_location=true`, `is_system=true`,
`allows_manual_entry=false`, document type `MM` (same as `311` and
`801`), effect: destination `on_hand` increase. Backfills all 4 existing
organizations via a `DO` loop (mirrors IC-2's own backfill pattern).
Flips `311`'s own `allows_manual_entry` to `false` (it existed pre-IC-4
with the _correct_ physical semantics — source-required, destination-
not-required, `on_hand` decrease — live-verified `0` posted headers ever
existed for it before this pass, satisfying the "redefine only if zero
live rows" condition) both in the seed function for future orgs and via
a direct `UPDATE` for the 4 existing orgs.

**Live-verified**: `311`/`312` both `allows_manual_entry=false`,
document type `MM`; `311` effect = source `on_hand` decrease; `312`
effect = destination `on_hand` increase; `312` seeded for all 4 orgs;
`0` stale `311` rows left `allows_manual_entry=true`.

## 6. `20260916065315_ic4_rebuild_inventory_create_branch_transfer`

Same 6-arg signature (no overload risk). Status inserted as `'prepared'`
(was `'in_transit'`); `sent_by`/`sent_at` no longer set here (moved to
SEND). Adds the IC-7A-grade actor-identity check (`28000`) as the first
statement in the body — this RPC previously accepted `p_actor_user_id`
completely unchecked, live-confirmed via `pg_get_functiondef` before this
pass, a real, previously-undisclosed gap. Converted from `SECURITY
INVOKER` to `SECURITY DEFINER` (required once the RESTRICTIVE RLS in
migration 7 closes raw `authenticated` writes on the tables this RPC
inserts into). `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO
authenticated, service_role`.

**Live-verified**: exactly one overload; `anon=false`, `authenticated=
true`; `prosecdef=true`.

## 7. `20260916065326_ic4_branch_transfer_tables_restrictive_rls`

Drops the old permissive `ALL` policies on `inventory_branch_transfers`/
`inventory_branch_transfer_lines` (the raw-write gap architecture doc §9
flagged, live-confirmed still open at the start of this phase). Adds
explicit RESTRICTIVE `USING(false)`/`WITH CHECK(false)` policies for
INSERT/UPDATE/DELETE — redundant with the "zero PERMISSIVE policies =
deny" default Postgres RLS behavior once the old ALL policy is gone, but
makes the closure explicit and future-proof (a later broad PERMISSIVE
policy added by mistake would still be blocked). Scoped SELECT policies
unchanged.

## 8. `20260916065347_ic4_inventory_send_branch_transfer`

New RPC. `SECURITY DEFINER`, hardened `search_path`. Locks the transfer
row (`FOR UPDATE`); actor-identity + source-branch permission checks;
requires `status='prepared'` (else `P0007`); consumes the reservation
(decrements `inventory_balances.reserved_quantity`, increments `reservation_
lines.fulfilled_quantity`) **before** posting the physical decrease, so
the IC-1 commitment invariant evaluates against the already-reduced
reserved value; builds the source `311` movement header+lines directly
(same pattern `inventory_reverse_movement` uses for `900`, since `311`
is `allows_manual_entry=false` and `inventory_create_draft`'s own guard
would otherwise reject it unconditionally); calls `inventory_finalize_
posting_internal(header_id, actor, NULL)` — `NULL` explicit effects uses
`311`'s own type-catalog effect (source `on_hand` decrease); IC-2's
frozen "explicit effects only for type 900" contract is untouched. Sets
`source_movement_id`/`sent_by`/`sent_at`/`status='in_transit'`
atomically with the posting, in the same transaction — a failed post
cannot leave an "unreserved but not shipped" state. `REVOKE ALL FROM
PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role`.

**Live-verified**: exactly one overload; `anon=false`, `authenticated=
true`.

## 9. `20260916065426_ic4_rebuild_inventory_accept_branch_transfer`

Adds a 4th parameter (`p_line_acceptances jsonb DEFAULT NULL`) — full
rebuild, not merely a fix. Requires `status='in_transit'`; idempotent
short-circuit if already `accepted`/`partially_accepted` (returns the
existing result with `already_processed: true`). Per line: accepted
quantity defaults to the full `sent_quantity` (ordinary full-accept), or
an explicit value from `p_line_acceptances` keyed by `transfer_line_id`
(never SKU/variant); validates `0 <= accepted <= sent`. Builds the
destination `312` movement directly (same reasoning as SEND — `312` is
also `allows_manual_entry=false`), one line per transfer line with
`accepted_quantity > 0` (a fully-missing line contributes zero movement
lines, not a zero-quantity line). Any shortfall (`sent - accepted > 0`)
persists one `inventory_branch_transfer_discrepancies` row. Final status
is `accepted` only if every line's accepted quantity equals its sent
quantity, else `partially_accepted`. `REVOKE ALL FROM PUBLIC, anon;
GRANT EXECUTE TO authenticated, service_role`.

## 10. `20260916065435_ic4_drop_stale_accept_branch_transfer_overload`

**Self-caught defect, fixed before any test ran**: migration 9's own
4th parameter created a NEW, additional 4-arg overload rather than
replacing the original 3-arg signature (the exact, previously-documented
project-wide pitfall) — live-caught via `pg_proc` immediately after
applying migration 9. The stale 3-arg overload was the OLD, broken,
still-`anon`-exploitable version (hand-written balance writes,
references the nonexistent `inventory_allocate_movement_number`).
Dropped, not left dormant.

**Live-verified**: exactly one `inventory_accept_branch_transfer`
overload survives (`uuid,uuid,uuid,jsonb`).

## 11. `20260916065452_ic4_rebuild_inventory_decline_branch_transfer`

Same 3-arg signature. Full rebuild: requires `status='prepared'` (else
`P0007`, with an explicit message pointing to partial-accept for the
post-shipment case) — removes the OLD, broken `ELSIF source_movement_id
IS NOT NULL` branch entirely, which used to hand-write a "return"
movement and reference the nonexistent `inventory_allocate_movement_
number`. No automatic return movement of any kind, matching the
explicit product instruction. Destination-branch permission check
(decline is the destination's own decision). `REVOKE ALL FROM PUBLIC,
anon; GRANT EXECUTE TO authenticated, service_role`.

## 12. `20260916065504_ic4_inventory_cancel_branch_transfer`

New RPC (source-side, distinct from decline). Adds the `cancelled_by`
FK (redundant re-add of the same constraint migration 1 already created
under its own default name — a minor, harmless redundancy in this
migration, disclosed rather than silently left unremarked). Requires
`status='prepared'`; source-branch permission check (cancel is the
source's own decision, mirroring decline's destination-side symmetry).
`REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated,
service_role`.

## Post-apply live verification performed (every migration)

- `pg_get_functiondef` re-fetch after every function change.
- `SELECT oid::regprocedure FROM pg_proc WHERE proname = ...` after every
  migration touching a function — confirmed exactly one overload for
  each of the 5 branch-transfer RPCs after the two arity-change
  migrations (6 and 9), catching the one real stale-overload case
  (migration 9 → 10) before any pgTAP ran.
- `has_function_privilege('anon'/'authenticated', ..., 'EXECUTE')`
  grant-matrix queries after every migration, not summarized from
  migration text — all 5 RPCs confirmed `anon=false`, `authenticated=
true` after their own final migration.
- `pg_policies` re-fetch confirming the RESTRICTIVE policies exist with
  the expected `USING(false)`/`WITH CHECK(false)` definitions.
- A live smoke test (full create→send→accept, matching the exact
  worked-example numbers) run BEFORE writing the pgTAP file.
- Genuine two-PostgreSQL-connection concurrency proofs (see
  `concurrency-evidence.md`).
- The full 097-106 pgTAP regression suite (see `test-evidence.md`).

## 13. `20260916170438_ic4c_fix_orphan_draft_and_strict_partial_accept`

(IC-4 correction pass, 2026-09-16)

**Confirmed, live-reproduced BLOCKER**: `inventory_accept_branch_
transfer` unconditionally created a draft `312` movement header BEFORE
evaluating any line's own accepted quantity. When every line's accepted
quantity resolved to `0` (a 100%-missing receipt — the transfer's own
goods were confirmed physically shipped via `311`, but destination
received none of it), the function correctly set the RETURNED
`destination_movement_id` and the transfer row's own column to `NULL`,
but the already-`INSERT`ed draft header row itself was never removed —
a permanent orphan `312` draft, with the discrepancy row's own
`destination_movement_id` pointing at it. Live-reproduced exactly, pre-
fix: `orphan_312_header_count=1`, header `status='draft'`, discrepancy
`destination_movement_id` = that same orphan id.

**Fix**: restructured so the destination movement header is created
**only if** the transfer-wide total accepted quantity is `> 0`,
decided via a single set-based query (`jsonb_object_agg` over a `LEFT
JOIN LATERAL` against the resolved per-line acceptances) BEFORE any
mutation, rather than inside the per-line loop after the header
already exists. A 100%-missing accept now creates zero
`inventory_movement_headers` rows, zero `inventory_movement_lines`
rows; `destination_movement_id` is `NULL` everywhere it is written
(the transfer row and every discrepancy row for that transfer).

**Also fixed (fail-closed explicit-payload contract)**: `p_line_
acceptances`, when non-NULL, is now validated in full — array shape,
zero duplicate `transfer_line_id`, zero unknown/foreign `transfer_
line_id`, exactly one entry per real transfer line, every `accepted_
quantity` numeric and within `[0, sent_quantity]` — **before** the
destination-location `UPDATE`, before any header/line/discrepancy
mutation. Any violation raises `22023` with zero mutation of any kind.
An incomplete or mistyped payload can no longer silently default an
omitted line to full acceptance (the prior behavior); an unknown or
foreign-transfer `transfer_line_id` can no longer be silently ignored.

**Live-verified before writing any pgTAP assertion**: the exact
original 100%-missing repro re-run post-fix — `total_312_header_count=
0`, `discrepancy_dest_movement_id=NULL`, `dst_on_hand` unchanged,
idempotent retry confirmed (`already_processed:true`, still zero
headers). Four negative-payload probes (missing line, unknown id,
duplicate id, foreign-transfer id) all rejected `22023` with zero
mutation (transfer status, `accepted_quantity`, discrepancy count, and
header count all unchanged after each). A mixed-outcome accept (one
line full, one line short) re-verified: the real posted header exists,
`status='posted'`, and the discrepancy's own `destination_movement_id`
correctly references that real posted header, not a draft.

Same 4-arg signature as the function it replaces — no arity change, no
overload risk. `REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO
authenticated, service_role` re-issued as the final step (unchanged
grant set, re-verified).

**Live-verified immediately after apply**: exactly one
`inventory_accept_branch_transfer` overload
(`uuid,uuid,uuid,jsonb`); `anon=false`, `authenticated=true`,
`service_role=true`; `prosecdef=true`.
