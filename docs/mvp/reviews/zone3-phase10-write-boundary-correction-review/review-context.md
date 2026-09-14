# Zone 3 Phase 10 Write-Boundary Correction — Review Context

Baseline: the exact completed base-scope Phase 10 state immediately before this correction (2026-09-14), reconstructed in an isolated scratchpad (see §S). Diff: `zone3-phase10-write-boundary-correction.diff` (292 lines, 57831 bytes). Manifest: `changed-files.md`. Migration: `migration-summary.md`.

This is a **narrow correction pass**, not a redesign. External review accepted Phase 10's core RPC architecture as-is and named exactly two gaps. Both are closed here; nothing else was touched.

## A. What external review found

1. **A real production write-boundary/security gap.** The Phase 2 permissive `repair_order_line_movement_links_insert` RLS policy (gated on `warehouse.inventory.operate`/`.adjust`) performed none of Phase 10's own semantic validation (no cross-org/branch check, no posted-status check, no category consistency, no RepairOrder-reference check, no variant check, no quantity cap, no row locking, no canonical duplicate handling). An authorized client could bypass `attach_repair_order_line_movement(...)` entirely via a raw INSERT.
2. **A missing cardinality proof.** The architecture intentionally permits one `inventory_movement_line` to be split across many `RepairOrderLine`s (protected by the RPC's own locked global `SUM` cap), but base Phase 10's own pgTAP suite never exercised this exact scenario live.

## B. Verify-first: FORCE-RLS / function-owner mechanics, checked before changing anything

Per explicit instruction not to assume `SECURITY DEFINER` alone solves the write-boundary question, the actual live mechanics were inspected first (all via `execute_sql` against `supabase-target`):

- `repair_order_line_movement_links` — owner `postgres`; `relrowsecurity = true`; `relforcerowsecurity = true`.
- `postgres` role — `rolbypassrls = true` (not a Postgres superuser).
- `authenticated` / `anon` roles — `rolbypassrls = false`.
- `attach_repair_order_line_movement` — `prosecdef = true` (`SECURITY DEFINER`), owner `postgres`.

**Conclusion, reasoned from these facts**: a `SECURITY DEFINER` function executes with the privileges of its _owner_ — here `postgres`. Because `postgres` has `rolbypassrls = true`, the RPC's own internal `INSERT` bypasses RLS **unconditionally**, irrespective of whatever INSERT policy exists on the table. This is a role-ownership fact, not anything `FORCE ROW LEVEL SECURITY` grants — FORCE RLS only removes the table owner's _default_ RLS exemption; it cannot override the separate, stronger `rolbypassrls` role attribute a role may independently hold. In other words: the RPC's write path was **never actually gated by** the Phase 2 policy at all, before or after this correction.

**This was then proven empirically**, not left as inference: a transaction-scoped dry run (`BEGIN; ...; ROLLBACK;`, live against `supabase-target`, real fixtures, real `authenticated` role, real `warehouse.inventory.operate` grant) temporarily swapped the permissive policy for the exact deny-all policy this correction was about to apply for real, then attempted (1) a direct client `INSERT` — result `42501`, RLS violation — and (2) a call to `attach_repair_order_line_movement(...)` with the same data — result: success, a real row returned. Both captured to a temp log table and read back before the whole dry run was rolled back. This is the direct evidence the fix is safe, not an assumption.

## C. The fix — policy closure, not a trigger

New forward migration `20260914052934_repair_order_line_movement_links_close_direct_insert.sql` drops `repair_order_line_movement_links_insert` and replaces it with `repair_order_line_movement_links_insert_deny` (`FOR INSERT WITH CHECK (false)`) — matching this table's own existing `_delete_deny` naming/shape convention. Final write boundary: direct client `INSERT` (authenticated or anon) is now denied unconditionally; `attach_repair_order_line_movement(...)` is the sole production write path. SELECT policy, DELETE-deny policy, and the (nonexistent) UPDATE policy are untouched.

**No table trigger was added.** Per explicit direction to prefer "one canonical implementation of the attribution rules" over "RPC validation + duplicated trigger validation" — and because §B's live dry run already proved policy closure alone is sufficient (the RPC never needed the policy to be permissive in the first place) — a trigger duplicating the RPC's own invariants a second time was unnecessary and was not built.

## D. Old Phase 8/9 pgTAP fixtures — not preserved as a reason to keep the gap

The base-scope Phase 10 pass had originally kept the permissive policy in part because Phase 8's and Phase 9's own pgTAP fixtures (`095_...`, `096_...`) insert synthetic `repair_order_line_movement_links` rows directly. Per this correction's explicit instruction, that was **not** treated as a reason to preserve a production bypass. Both files were re-run **completely unmodified** after the policy closure:

- `095_repair_order_lines_phase8_test.sql` — 11/11 passing, unaffected.
- `096_repair_order_provenance_phase9_test.sql` — 15/15 passing, unaffected (this file never touches `repair_order_line_movement_links` at all).

**Why no fixture change was needed**: both files' own fixture INSERTs happen while still connected as the unrestricted connecting role — _before_ their own `SET LOCAL ROLE authenticated` switch. That connecting role bypasses RLS via the exact same role-ownership mechanism (§B) the RPC itself relies on, not via the now-closed policy. The fixture technique these files already used (insert as the privileged connecting role, then switch role only for the RLS-enforced assertions) turned out to already be the "honest privileged setup path" this correction's own instructions asked for as an option — it did not need to change.

## E. Missing cardinality proof — added

`097_repair_order_line_movement_attach_phase10_test.sql` gained six new scenarios, all via the real RPC:

- **T20-T22 (split success)**: one real movement line (`ml_split`, quantity=10) attributed to two _different_, same-SKU RepairOrderLines (`097-SPLIT-SKU`) — A receives 6, B receives 4, both succeed via the real RPC; the movement line's own total attributed (read back) is exactly 10. Proves attribution is RepairOrderLine-identity based, never SKU-identity based — the central Phase 10 invariant, now proven for the specific case where two lines genuinely share a SKU and the same physical movement line.
- **T23-T25 (over-cap inverse)**: a second real movement line (`ml_overcap`, quantity=10) — A receives 6 (succeeds), B attempts 5 more (6+5=11 > 10, rejected `22023`). Read-back confirms the total stays at exactly 6 — A's own row untouched, B's row never created, no partial write.
- **T26-T27 (the write-boundary's own central acceptance proof)**: the same actor, same `warehouse.inventory.operate` grant that used to satisfy the old permissive policy — a direct INSERT is now denied (`42501`), the RPC call for identical data still succeeds.

**29/29 passing live** (was 21/21), transaction-scoped, zero residual data. T22/T25 (the two read-back assertions) initially failed on the first live run of this pass — not a data bug: this test's own actor holds `warehouse.inventory.operate` (needed for the writes) but not `workshop.repair_orders.read` (needed to read the rows back under the table's own SELECT RLS policy), so a same-role read immediately after the write legitimately sees 0 rows. Both were moved to run after `RESET ROLE`, alongside the pre-existing T16-T19 worked-example reads, which already used that same placement for the same reason — caught and fixed before reporting, not left silently broken or reported as passing when it wasn't.

## F. Zone 5 reality update

LIVE VERIFIED via `mcp__supabase-target__list_migrations`: three Zone 5 migrations (`zone5_receiving_location_purpose`, `zone5_repair_order_spatial_attribution_schema`, `zone5_attribution_sync_trigger`) are already applied to this same `supabase-target` project — a parallel implementation now exists, where base Phase 10's own review context (correctly, for that date) had found none. Inspected only to confirm existence/shape (explicitly not integrated, per instruction):

- The sync trigger (`repair_order_location_attribution_sync`, `SECURITY DEFINER`, owner `postgres`) writes to `repair_order_line_locations` and `repair_order_location_attribution_uncertain` — **not** `repair_order_line_movement_links`. It does not conflict with this correction's own write-boundary closure in any way; the two tables are entirely separate.
- LIVE VERIFIED `receive_repair_order_stock()` itself does **not** exist on `supabase-target` (zero matching rows in `pg_proc`) — it exists only on the separate `pitch/zone5-receiving` git branch, not merged/applied to this database. No live conflict exists today.

A later integration pass — routing Zone 5's own receipt-side attribution through this phase's canonical `attach_repair_order_line_movement` RPC, once that branch's `receive_repair_order_stock()` lands here — remains required and is explicitly **not started** in this pass. Both the implementation plan's and the progress tracker's earlier "Zone 5 does not exist" claims (accurate as of the 2026-09-12 Phase 10 baseline) are corrected to record current reality without rewriting the historical record — the 2026-09-12 text is preserved as-is, with a dated correction appended immediately after it.

## G. Everything else — confirmed frozen

Per explicit instruction, none of the following changed in this pass: RPC validation semantics, RPC signature, the `relation_type` model, issue-side classification (still `DEPENDS ON PHASE 10F`), reversal behavior (still rejected outright), the four derived-quantity formulas / read model (still Phase 8's own, reused unchanged), event emission (`workshop.repair_orders.movement_attributed`, Mode A, unchanged), error normalization (`normalizeMovementLinkRpcError`, unchanged, zero TypeScript files touched this pass), the inventory movement engine, and Phase 10A-10F (nothing under any of those areas was created or modified).

## H. Testing summary

- **DB/pgTAP**: `097_...` — 29/29 passing live (was 21/21). `095_...` — 11/11, re-run unmodified. `096_...` — 15/15, re-run unmodified.
- **Vitest**: full Zone 3 + CRM sibling + Inventory-movement suite — **233/233 passing** (was 216 before this pass; the increase is the 17 Inventory-movement tests now included in this run's scope, not new tests — zero new TypeScript files were added or modified this pass, so zero new Vitest tests exist to add).
- **Typecheck**: `pnpm type-check` clean.
- **Lint**: not re-run standalone this pass (no TypeScript file changed; the prior Phase 10 lint pass already confirmed 0 errors on every file this correction leaves untouched).
- **Residual data**: zero — every pgTAP run is wrapped `BEGIN; ...; ROLLBACK;`.

## S. Baseline reconstruction method and isolation

Phase 10 itself was never committed (`git log` still shows `HEAD` at `0475bcd8`, "phase 9 complete"; the entire Phase 10 implementation remains uncommitted working-tree state). This correction's own edits are layered on top of that same uncommitted state, in the same working tree — so `git diff` against `HEAD` would show the _combined_ base-Phase-10-plus-correction diff, not this correction alone.

To isolate just this correction's own diff without mutating the real implementation tree: for each of the 3 files this pass modifies, a copy was made into this session's scratchpad directory (`/tmp/.../scratchpad/phase10-baseline/`, outside the repository), then each copy had this pass's own edits reversed on it — exactly, using the same `old_string`/`new_string` pairs the real edits used, applied in reverse, so the reconstruction is byte-for-byte precise rather than approximate. The new migration file (this pass's only added file) needs no reconstruction — it is diffed directly against an empty file. `git diff --no-index` was then used to produce a proper unified diff (with correct `diff --git`/`index`/`---`/`+++` headers) between each scratchpad "before" copy and the real "after" file, then the paths in each diff's headers were corrected from the scratchpad location to the real repository path.

**Isolation guarantee**: at no point did reconstruction read, write, stage, or commit anything in the real repository working tree beyond the files this correction pass already intentionally changed — `git status --short` immediately before and after bundle creation shows the identical set of implementation paths (unchanged by the bundling process itself), confirmed in the Final Report.
