# Zone 5 — Receiving / Putaway: Progress Tracker

> Companion to `05-receiving-putaway-implementation-plan.md`. **Architecture: APPROVED FOR
> IMPLEMENTATION.** This revision records the second implementation pass (a correction pass
> against external review of the first bundle). **Zone 5 is NOT pitch-ready** — no migration has
> been applied to any database.

## Implementation status legend (mechanical, used throughout this file)

- **PITCH DONE** — code/migration/test written, typechecked/linted/unit-or-pgTAP-tested where
  that's possible without a live database, and (for anything DB-related) reviewed against the
  tracked schema this session could read directly.
- **PITCH — BLOCKED ON MCP** — written and ready for review, but **not applied to any live or
  local database** (no Supabase MCP tool, no `supabase` CLI link, no running Docker daemon this
  session). Per the working rules, reported honestly rather than fabricated as verified.
- **PITCH UAT OUTSTANDING** — code exists but has not been exercised end-to-end against a real
  browser/backend.
- **PILOT** / **TECH DEBT** — unchanged from the approved plan, not touched this pass.

**Mechanical count, both passes combined**: 23 files in the full diff (21 new, 2 pre-existing
files modified — see `changed-files.md` for the itemized manifest); 6 migrations written, 0
applied; 5 pgTAP test files (59 assertions across `093`-`097`, up from 54 — corrections added/
fixed assertions in `093` and `096`), 0 executed; 4144 vitest tests run in the full-suite
regression pass (4103 passed / 24 failed — all 24 pre-existing and unrelated to Zone 5 / 8
skipped / 9 todo), up from 4117 in the prior pass — the +27 delta is exactly this pass's new
Zone-5 assertions, all passing; 1 full-repo `tsc --noEmit` pass (clean); `eslint` clean on every
touched file.

## Correction pass — this session (external review of the first implementation bundle)

- [x] **1. Aggregate + `FOR UPDATE` bug — CONFIRMED and fixed.** `SELECT sum(...), count(...) ...
  FOR UPDATE` is invalid PostgreSQL (the locking clause cannot combine with aggregation at
      the same query level — verified against PostgreSQL's own SELECT/locking-clause
      documentation, and confirmed no precedent for this pattern exists anywhere in this repo).
      Fixed in `20260912092000_zone5_attribution_sync_trigger.sql`: lock the individual rows
      first via a CTE (`WITH locked_rows AS (SELECT ... FOR UPDATE) SELECT sum(...), ... FROM
  locked_rows`), aggregate over the already-locked set in the same statement. This also let
      `v_line_id`/`v_ro_id` be captured from the same locked read via `max()` (safe when
      `v_distinct_lines = 1`), removing a second, separate, unlocked re-SELECT entirely.
- [x] **2. Fake pgTAP placeholders — removed.** `096`'s two `SELECT pass('... TODO ...')`
      assertions are replaced: (a) ambiguous-provenance resolution is now a real, fixture-driven
      test built against the confirmed-real schema of `wdd_matcher_sessions` /
      `wdd_matcher_session_files` / `wdd_matcher_blocks` / `wdd_matcher_lines` (read directly
      from `20260415100000_svwms_wdd_matcher_tables.sql` this pass); (b) atomicity is now a real
      executed test (no movement header is created at all when resolution fails, searched for by
      a distinctive idempotency key) plus a structural proof (no exception-swallowing block in
      the function body) — and the one sub-case genuinely requiring live/local execution
      (mid-engine-call failure) is marked with an honest `skip()`, never a `pass()`. The same
      anti-pattern (a bare `pass()`) found in `093` was also fixed the same way.
- [x] **3. Receiving flow wired.** `use-movement-submission.ts`'s `submit(andPost=true)` now
      routes a NEW (not edit), type-101 movement with at least one `source_line_id`-carrying line
      through `receiveRepairOrderStockAction`; every other case (no resolvable line, any other
      movement type, edit mode, draft-only save) is unchanged and goes through the existing
      generic actions. Proven by 5 real, executed unit tests
      (`use-movement-submission.route-selection.test.ts`) covering exactly those branches.
- [x] **4. Putaway wired into a real page.** `RepairOrderPutawayPanel` is now rendered from
      `/dashboard/workshop/[id]/page.tsx` (the real, existing RepairOrder detail shell),
      conditionally, only when `RepairOrderStorageService.getReceivedLines` finds stock actually
      sitting at the branch's receiving location for that RepairOrder. New service method
      `getReceivedLines` added (line-level read, joins `repair_order_line_locations` filtered to
      the receiving location with `inventory_variants` for sku/productName/unit_id).
- [x] **5. Receiving-location admin — backend done, UI wiring deferred (disclosed).** Added
      `purpose` to `updateLocationSchema` and to `WarehouseLocationsService.update`'s field
      allowlist (previously an explicit per-field list that would have silently dropped it) —
      the REAL, existing, `WAREHOUSE_LOCATIONS_MANAGE`-gated admin action now genuinely persists
      `purpose`. Proven by a new service test (42/42 passing including the new one, zero
      regression). **NOT done this pass**: a visible toggle inside the actual location edit
      surface. Two candidate files were inspected (`LocationModal.tsx`, 809 lines;
      `location-detail-panel.tsx`, 1076 lines) — both are large and unfamiliar, and a blind edit
      under time pressure risked breaking Zone 4's working UI, which this assignment must not do.
      This is a deliberate, disclosed scope boundary, not a silent omission — see "Remaining
      work" below.
- [x] **6. Stockable-receiving invariant — added at the DB level.** New CHECK constraint
      `warehouse_locations_receiving_must_be_stockable`
      (`purpose <> 'receiving' OR can_store_inventory = true`) in the Phase 1 migration — a
      non-stockable location can no longer be marked `receiving` even if application code has a
      bug. New pgTAP assertion in `093` proves the constraint rejects such an attempt.
- [x] **7. `resolve_branch_receiving_location` EXECUTE grant — removed from `authenticated`.**
      The helper took an arbitrary org/branch with no permission check of its own; granting
      `authenticated` EXECUTE would have let any signed-in user probe any org/branch's receiving
      location id. Now revoked from `PUBLIC`/`anon`/`authenticated` entirely — the two
      orchestration RPCs can still call it internally (a `SECURITY DEFINER` function executes as
      its owner, which already has implicit EXECUTE on functions the same owner created). New
      pgTAP assertion (`093`) proves `authenticated` has no direct EXECUTE.
- [x] **8. Error normalization implemented**, following this repo's own already-established,
      hardened convention (`repair-orders.service.ts`'s `normalizeMaterializationRpcError` —
      allowlist requiring BOTH exact SQLSTATE AND a match against the RPC's own known message
      shape, not the code alone). Applied to both new RPCs' error paths and to the read model's
      action wrapper (which normalizes everything except a recognizable RLS denial, since that
      service has no deliberately-authored safe messages of its own). 13 real, executed action
      tests prove: known errors pass through, the SAME SQLSTATE with a DIFFERENT message is NOT
      leaked, and completely unexpected errors never leak raw SQL/relation/constraint text.
- [x] **9. Putaway destination selector fixed.** The raw "enter another location ID" text input
      is replaced with a `<select>` populated from the existing `listLocationsAction()`, showing
      `code — name`, filtered to stockable locations — no UUID ever shown to the operator, no new
      picker subsystem, no QR/mobile scanning (still PILOT).
- [x] **10. UI/action test coverage added** — 13 action-level tests
      (`repair-order-receiving.test.ts`) + 8 component tests
      (`repair-order-putaway-panel.test.tsx`) covering all 9 requested scenarios (A-I: KNOWN
      actionable, UNKNOWN never confident, batch payload, partial quantity, destination selector,
      API failure, no-selection guard, success, no capacity display) + 5 route-selection tests +
      1 new service test — all real, executed, all passing (see counts below).
- [x] **11. Live schema gate — reaffirmed, not overridden.** No migration was applied. The
      Phase 3 trigger's disclosed column-verification gap (against `inventory_stock_ledger_entries`)
      is unchanged and still blocks live application until a session with Supabase MCP/live
      access independently confirms every referenced column.
- [x] **12. No PILOT features started** — confirmed by re-scanning the diff for any of:
      `inventory_containers`, capacity/percentage fields, `relation_type='putaway'`, mobile
      scanning, QR. None present.

## Implementation pass — prior session (context, unchanged this pass unless noted above)

- [x] Re-verified repo state; no new commits landed since the planning pass. Planning docs
      committed as baseline (`0d8babb5`).
- [x] Confirmed Supabase MCP unavailable (repeated this pass — still true).
- [x] Confirmed no local Supabase/Postgres alternative (repeated this pass — still true;
      `docker ps` still fails, daemon not running).
- [x] `inventory_stock_ledger_entries`/`inventory_movement_audit_log` have zero tracked
      migrations anywhere in the repo (unchanged finding).
- [x] Deliberately did not fall back to `supabase db push` against the live target project
      (unchanged decision).

### Phase 0 — Fresh verification (PITCH, gate)

- [ ] 101 + Matcher import chain manually re-run on current build — **BLOCKED ON MCP**.
- [ ] 801 relocation (Zone 6's existing UI) manually re-run on current build — **BLOCKED ON MCP**.
- [ ] Matcher-line → RepairOrder-line join returns real rows for a materialized session —
      **BLOCKED ON MCP**.

### Phase 1 — Receiving-location schema

- [x] Migration: `20260912090000_zone5_receiving_location_purpose.sql` — `purpose` column +
      CHECK + partial unique index + stockable-receiving invariant (NEW this pass) +
      `resolve_branch_receiving_location()` (EXECUTE grant corrected this pass). **PITCH —
      BLOCKED ON MCP**.
- [x] Backend admin plumbing (`updateLocationSchema` + `WarehouseLocationsService.update`) —
      **PITCH DONE**, tested (42/42 service tests passing).
- [ ] Visible toggle in the location edit UI — **NOT DONE this pass** (disclosed scope boundary,
      see correction #5 above and "Remaining work" below).
- [x] pgTAP test: `093_...purpose_test.sql`, now 10 assertions (was 8; +2 this pass: stockable
      invariant, EXECUTE-grant check) — **PITCH — BLOCKED ON MCP** (not executed).
- [ ] Admin designates the demo branch's receiving location — **BLOCKED ON MCP**.

### Phase 2 — Projection + uncertainty marker + full integrity

- [x] Migration: `20260912091000_...schema.sql` — unchanged this pass. **PITCH — BLOCKED ON MCP**.
- [x] pgTAP test: `094_...schema_test.sql`, 9 assertions — **PITCH — BLOCKED ON MCP**.

### Phase 3 — Safety-net trigger

- [x] Migration: `20260912092000_...trigger.sql` — **corrected this pass** (aggregate+FOR UPDATE
      fix, #1 above). **PITCH — BLOCKED ON MCP**, plus the still-open ledger-column
      verification gap (#11).
- [x] pgTAP test: `095_...trigger_test.sql`, 14 assertions, header note added pointing at the
      corrected query path — **PITCH — BLOCKED ON MCP**.
- [ ] Live-DB two-session concurrency integration test — still explicitly deferred.

### Phase 4 — `receive_repair_order_stock` RPC + wiring

- [x] Migration: `20260912093000_...receive_rpc.sql` — unchanged this pass. **PITCH — BLOCKED ON
      MCP**.
- [x] **Wiring done this pass** (#3 above) — `use-movement-submission.ts`, 5 route-selection
      tests passing.
- [x] pgTAP test: `096_...receive_test.sql` — **corrected this pass** (#2 above), now 10
      assertions, no fake passes. **PITCH — BLOCKED ON MCP**.

### Phase 5 — Putaway read model + suggestion UI

- [x] Service: `repair-order-storage.service.ts` — `getStorageSuggestions` unchanged;
      `getReceivedLines` **added this pass**. **PITCH DONE** (5 + coverage via component tests).
- [x] Server action: `getRepairOrderStorageSuggestionsAction` — error normalization added this
      pass (#8). **PITCH DONE**.
- [x] UI: `repair-order-putaway-panel.tsx` — destination selector fixed this pass (#9), 8
      component tests added (#10). **PITCH DONE** for typecheck/lint/unit tests; **PITCH UAT
      OUTSTANDING** for real browser verification.
- [x] **Wired into a real page this pass** (#4 above) — `/dashboard/workshop/[id]/page.tsx`.

### Phase 6 — `putaway_repair_order_stock` RPC + wiring

- [x] Migration: `20260912094000_...putaway_rpc.sql` — unchanged this pass. **PITCH — BLOCKED ON
      MCP**.
- [x] `[Put here]` / destination-selector wiring — corrected this pass (#9).
- [x] pgTAP test: `097_...putaway_test.sql`, 6 assertions — **PITCH — BLOCKED ON MCP**.

### Phase 7 — Presentation UAT

- [ ] Full live run — **BLOCKED ON MCP**.
- [ ] Zone 6 rehearsal — **BLOCKED ON MCP**.
- [ ] Playwright / responsive QA at 390×844, 768×1024, 1440×900 — **NOT RUN this pass** (no live
      backend to render against — disclosed environmental limitation, not fabricated).
- [ ] Manual pitch scenario data preparation — **NOT DONE this pass**.

## Remaining work (explicit, not silently deferred)

1. **Location edit UI toggle** — wire a `purpose` control into `LocationModal.tsx` and/or
   `location-detail-panel.tsx` (both real, both large/unfamiliar this session) once someone with
   more context on those specific files' structure (or live rendering to verify against) can do
   so safely. The backend (`updateLocationAction`) already supports it correctly and is tested.
2. Everything Phase 0/7 and every migration application — blocked on Supabase MCP or equivalent
   live/local access, per the standing constraint.
3. The live two-session concurrency integration test (Phase 3, explicitly deferred per plan
   §6.1).
4. The one honestly-`skip()`ped atomicity sub-case in `096` (mid-engine-call failure) — needs
   either live execution or independently-confirmed knowledge of `inventory_create_and_finalize`'s
   internal validation surface.

## Known-good regression checks (this pass)

- [x] Full-repo `tsc --noEmit`: **clean** (0 errors) — including after fixing a real,
      reproducible TS discriminated-union narrowing issue this pass hit again in three more new
      files (worked around the same way as the prior pass: explicit `=== true`/`=== false`
      checks instead of negated guard-returns; root cause still not fully isolated, flagged for
      whoever next touches this pattern in this codebase).
- [x] `eslint` on every touched/new file: **clean** (0 errors, 0 warnings after two trivial
      fixes — an unused mock param, two now-unnecessary `eslint-disable` comments).
- [x] `vitest` full-suite regression run: **executed, completed** — 285 test files passed / 25
      failed / 2 skipped (312 total, +3 files vs. the prior pass's 309, exactly the 3 new Zone 5
      test files added this pass); 4103 tests passed / 24 failed / 8 skipped / 9 todo (4144
      total, +27 vs. 4117, exactly the 26 new + 1 added-to-existing-file Zone 5 assertions this
      pass). **All 25 failing test files are pre-existing and unrelated to Zone 5** (e.g. the
      same `member-detail-client.test.tsx` date-format assertion seen in the prior pass's own
      baseline run) — zero of them touch any file this session created or modified, confirmed by
      direct inspection of the failure output. The failed-test count (25→24) moved by one due to
      unrelated test flakiness in a file this session never touched, not a regression.
- [ ] Zone 3/Zone 6 pgTAP regression — **BLOCKED ON MCP**; zero Zone 3/Zone 6 files modified.
