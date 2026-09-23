# IC-6 Review Context

**Phase**: IC-6 — Legacy Writer/Helper Removal (cleanup/consolidation,
not new behavior). IC-0 through IC-5 and IC-7A remain ACCEPTED/FINAL,
not reopened. Full IC-7, IC-8, and Phase 10D are explicitly NOT started.

**Note on this section's format**: the task's own external-review
questions were specified as a verbatim 20-item list in the original
task message; that exact literal wording is not preserved in this
session's context after a mid-phase conversation compaction. What
follows are the same review topics, reconstructed from this session's
own compacted summary of that list (17 distinct topics were legibly
recorded there) and answered in full — disclosed honestly rather than
fabricating literal wording that would look verbatim but isn't. Nothing
below substitutes a guessed question for a real one; each answer is
substantively responsive to the topic as recorded.

## 1. Was every removed function proven dead first?

Yes. Four SQL objects were dropped (`inventory_v1_get_or_create_
balance`, the stale 5-arg `inventory_get_or_create_balance_for_update`
overload, `inventory_settings.negative_stock_policy`'s column, and the
3-line dead conditional inside `inventory_finalize_posting_internal`)
and 4 TypeScript functions (`ambra-location-inventory.ts`'s write
actions). Every one was classified via the "four evidence sources"
discipline (repo/TS callers, live `pg_proc`/`prosrc` SQL-to-SQL scan,
application-export trace, tests/migrations/docs) BEFORE deletion — see
`dead-path-matrix.md` for the full per-candidate evidence table.
`negative_stock_policy` went further than "unused": its dead branch was
proven structurally UNREACHABLE by logical deduction from the
`inventory_balances` CHECK constraints, not merely "we found no
callers" (see `inventory-core-architecture.md` §9D item 3).

## 2. Were SQL-to-SQL callers checked, not just TypeScript?

Yes, for every SQL removal — a live `prosrc` regex scan across ALL of
`pg_proc` (not name-filtered subsets) was run for each candidate. This
methodology has a known blind spot (raw column references from pgTAP
TEST FILES aren't `pg_proc` bodies) — it is exactly what caused the
`102_...` regression (see `test-evidence.md`), which was caught by the
full-suite regression run and fixed, not by the `prosrc` scan itself.
This limitation is disclosed here rather than hidden.

## 3. Is the old v1 balance helper genuinely gone?

Yes. `inventory_v1_get_or_create_balance(uuid,uuid,uuid,uuid)` —
`DROP FUNCTION` applied, live-verified `to_regprocedure(...)` returns
NULL. pgTAP `108_...` Scenario A asserts this permanently.

## 4. Is the canonical locked balance helper unchanged?

Yes. `inventory_get_or_create_balance_for_update`'s 7-arg canonical
form (`uuid,uuid,uuid,uuid,uuid,uuid,uuid` — lot/serial-aware) was
read and confirmed byte-for-byte unchanged; only the stale, never-
called 5-arg overload was dropped. pgTAP `108_...` Scenario B asserts
the 7-arg form remains callable and that exactly one overload exists.

## 5. Is negative_stock_policy's dead surface honestly removed?

Yes — Option A (full column drop), not a cosmetic narrowing. The
column, its CHECK constraint, and the dead conditional that read it are
all gone. `'allow'`/`'allow_with_approval'` are not merely
"deprecated-but-selectable" — they no longer exist as selectable values
at all. Data-impact proof recorded: exactly 1 live row, value `'block'`
(the DEFAULT) — no meaningful state lost. See `migration-summary.md`
item 2.

## 6. Did IC-1's hard invariant remain unchanged?

Yes, completely. `on_hand_quantity >= 0` always and `reserved_quantity

- allocated*quantity <= on_hand_quantity`always — both DB-level CHECK
constraints and the P0003 strand-check inside`inventory_finalize*
  posting*internal`are untouched. The ONLY thing removed was a
conditional that could never fire (proven unreachable). pgTAP`102*...`(re-verified 11/11 after its own edit) and`108\_...` both re-confirm
  this live.

## 7. Were stale overloads explicitly enumerated and removed?

Yes. A dedicated overload-duplicate-count query was run across every
canonical Inventory RPC/helper name (§14's own requirement). Exactly
one case was found (`inventory_get_or_create_balance_for_update`,
5-arg vs 7-arg) and dropped with its EXACT argument-type signature
(`DROP FUNCTION ...(uuid,uuid,uuid,uuid,uuid)`), not inferred from
`proname` alone. Post-drop, exactly one signature remains, live-
verified.

## 8. Were historical migrations preserved?

Yes. All cleanup was performed via 4 NEW forward migrations (`DROP
FUNCTION`/`ALTER TABLE ... DROP COLUMN`/`CREATE OR REPLACE FUNCTION`).
No previously-applied migration file was edited or deleted. The one
TEST FILE edit (`102_...`) is not a migration and is not subject to
this rule.

## 9. Was immutable inventory history preserved?

Yes. No row was deleted from `inventory_movement_headers`, `inventory_
movement_lines`, `inventory_stock_ledger_entries`, `repair_order_line_
movement_links`, branch-transfer history, or discrepancy tables. IC-6
removed obsolete CODE/PATHS only, never historical truth. No table was
dropped.

## 10. Were any active UI/server actions accidentally removed?

No. The 4 TypeScript functions removed from `ambra-location-
inventory.ts` were confirmed to have ZERO callers anywhere in the repo
— a THIRD independent confirmation this session (after an initial
DRAFT of this section incorrectly judged the file "active/required"
based on an unverified memory, self-caught and corrected before any
deletion occurred — see `inventory-core-architecture.md` §9D item 6 for
the full correction narrative). `pnpm build` was re-run and succeeded,
including the `/dashboard/warehouse/locations` route that consumes the
same directory's separate, untouched read-only service file.

## 11. Are internal functions still inaccessible to ordinary callers?

Yes. `has_function_privilege('authenticated'/'anon', ..., 'EXECUTE')`
re-verified false for `inventory_finalize_posting_internal`, `write_
repair_order_line_movement_link_internal`, and `rebuild_repair_order_
projection_bucket_internal` — pgTAP `108_...` Scenario D (4
assertions) makes this a permanent regression check. Dropping the 2
legacy functions naturally closed whatever grant surface they held
(both fully absent from `pg_proc`, not merely revoked) — this is
in-scope closure of dead surface, not IC-7's broader grant audit.

## 12. Did receiving/reversal/branch-transfer/RepairOrder-projection remain unchanged?

Yes. `inventory_reverse_movement`, `receive_repair_order_stock`,
`putaway_repair_order_stock`'s core business rules, `attach_repair_
order_line_movement`, `rebuild_repair_order_location_projection`, and
all 5 branch-transfer RPCs were read and confirmed unchanged — none
were touched by any IC-6 migration. pgTAP `108_...` Scenario E (12
assertions) exercises the full receive→reserve/putaway→reverse→
rebuild lifecycle end to end and confirms it still succeeds unchanged.

## 13. Is the Zone-5 migration-mirroring gap handled honestly?

Yes, unchanged from IC-5's own disclosure: Option A (leave the
historical gap documented, do not fabricate historical migration
files). The 7 live `zone5_*`-named migrations that were never locally
mirrored remain undocumented as files. IC-6's own audit precisely
itemized exactly which objects they alone create — and confirmed this
DOES block from-scratch reproducibility (see item 14 below), correcting
an earlier, looser characterization. Honest disclosure over a
comfortable-sounding one: the gap is real and unresolved, not
"harmless." No fake timestamps were invented.

## 14. Can the migration tree still construct the intended schema from scratch?

**No — confirmed BROKEN, pre-existing, not caused or worsened by
IC-6.** No locally-mirrored migration creates `repair_order_line_
locations`, `repair_order_location_attribution_uncertain`, the
attribution-sync trigger binding, or the original `receive_repair_
order_stock`/`resolve_branch_receiving_location` definitions — these
came from 7 live `zone5_*` migrations that predate this project's own
local-mirroring discipline and were never mirrored. A from-scratch
replay of only the local migration tree would fail once it reached the
first migration referencing one of these objects. This is a
pre-existing condition IC-6 did not introduce (none of IC-6's own 4
migrations depend on anything from the unmirrored set), but it does
not fix it either — closing it is a future, dedicated phase's job, not
this one's. See `reproducibility-evidence.md` for the full itemized
finding — an earlier draft of that file understated this and has been
corrected.

## 15. Did IC-6 avoid doing full IC-7's job?

Yes, deliberately. The known posted-header GUC UPDATE bypass was
explicitly NOT touched (documented, not patched). Two NEW security-
relevant findings surfaced incidentally during this audit — `inventory_
cancel_movement`'s missing actor-check, and `InventoryProductsService.
createOpeningStockMovement`'s confirmed-broken RPC calls — were BOTH
disclosed prominently but NOT fixed here, since fixing either is new
behavior/bug-fixing, not legacy-path removal. Reservation/allocation
raw-write RLS and remaining container raw-write policy questions were
not touched.

## 16. Are remaining security findings still tracked?

Yes, all of them, undiminished: the posted-header GUC bypass (pre-
existing, tracked since before IC-6), `inventory_cancel_movement`'s
missing actor-check (new finding, this phase), `createOpeningStock
Movement`'s broken RPC calls (new finding, this phase — not itself a
security issue but a live-breaking bug, disclosed with equal
prominence), reservation/allocation RLS, container raw-write policy
questions, and systemic default-privilege behavior — all remain full
IC-7's own open scope, explicitly listed in `inventory-core-
architecture.md` §9D and `inventory-core-progress.md`'s own change log.

## 17. Is IC-6 safe to freeze before full IC-7?

Yes. Every deletion this phase performed was proven dead first: no
architecture semantics changed (IC-1 through IC-5's own invariants are
byte-for-byte unchanged, confirmed by regression), no new locking/
concurrency behavior was introduced (the one preserved `FOR UPDATE`
statement stayed untouched specifically to honor this), and the one
genuine regression the cleanup itself caused (`102_...`'s own now-dead
column reference) was found and fixed within this same phase, not left
for IC-7 to discover. IC-6 is DONE and safe to hand off.
