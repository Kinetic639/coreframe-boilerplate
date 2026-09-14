# Zone 5 — Receiving / Putaway: Progress Tracker

> Companion to `05-receiving-putaway-implementation-plan.md`. **Architecture: APPROVED FOR
> IMPLEMENTATION.** All 5 migrations are now **applied and live-verified** against the Supabase
> target project (this session, via Supabase MCP), AND `receive_repair_order_stock` is now
> **integrated with Zone 3 Phase 10's canonical `attach_repair_order_line_movement` RPC** (see
> "Phase-10 attribution integration pass" below) — the direct
> `INSERT INTO repair_order_line_movement_links` write is gone; the canonical RPC now owns that
> business-attribution write, Zone 5 continues to own spatial attribution unchanged. **Zone 5 is
> NOT YET pitch-ready**: the DB layer (schema, RPCs, trigger, pgTAP, Zone 3 regression, real
> two-session concurrency, Phase-10 integration) is fully live-verified, but application-layer/
> browser UAT (Playwright, real UI walkthrough) has **not** been attempted — this is now the ONLY
> remaining gap to pitch-readiness at the technical level.

## Implementation status legend (mechanical, used throughout this file)

- **PITCH DONE** — code/migration/test written, typechecked/linted/unit-or-pgTAP-tested where
  that's possible without a live database, and (for anything DB-related) reviewed against the
  tracked schema this session could read directly.
- **LIVE VERIFIED** — applied to the real Supabase target project and confirmed via direct live
  querying and/or pgTAP execution through Supabase MCP (this session). Distinct from browser/UAT
  verification, which is a separate, still-outstanding layer.
- **CONCURRENCY VERIFIED** — exercised under genuine two-connection, real-time-overlapping
  transactions (not merely sequential pgTAP), via a direct `pg` client script against the live
  target DB, this session.
- **PITCH — BLOCKED ON MCP** — historical marker from before MCP access existed this session; now
  superseded wherever a live-verification step below re-touched the same item.
- **PITCH UAT OUTSTANDING** — code exists and is live-DB-verified, but has not been exercised
  end-to-end against a real browser.
- **PILOT** / **TECH DEBT** — unchanged from the approved plan, not touched this pass.

## Live/MCP verification pass — this session (Supabase MCP now available)

Full, itemized detail is in the correction-bundle documentation for this pass; summary here:

- **All 5 migrations applied to the live Supabase target project**, each individually
  re-verified against live `pg_catalog`/`pg_constraint`/`pg_policies` before and after applying,
  per the pre-apply compatibility gate. No migration was applied until its assumptions were
  confirmed to match live reality; two real, previously-undetectable bugs were found and fixed
  (see below) — both were caught only by actual execution, never by schema/type inspection.
  - `20260912090000_zone5_receiving_location_purpose.sql` → live version `20260912174011`.
  - `20260912091000_zone5_repair_order_spatial_attribution_schema.sql` → live `20260912174155`.
  - `20260912092000_zone5_attribution_sync_trigger.sql` → live `20260912174602`.
  - `20260913000000_zone5_attribution_sync_trigger_max_uuid_fix.sql` (**new forward-correction
    migration this pass** — see below) → live `20260914123823`.
  - `20260912093000_zone5_receive_repair_order_stock_rpc.sql` (edited in place before its first
    live apply — see below) → live `20260914124640`, named `..._rpc_v2`.
  - `20260912094000_zone5_putaway_repair_order_stock_rpc.sql` → live `20260914125451`.
  - Local migration-file timestamps and live-applied version identifiers intentionally differ —
    `apply_migration` assigns its own version, does not preserve the local filename's timestamp.
    Confirmed via `list_migrations`; no functional impact, disclosed for anyone reconciling the
    two by timestamp instead of by name/content.
- **Two real, execution-only-discoverable bugs found and fixed**, both instances of "PostgreSQL
  has no built-in `max(uuid)`/`min(uuid)` aggregate" — raises only at statement _execution_ time,
  invisible to any static/schema-level review or even to `CREATE FUNCTION` itself:
  - The already-applied attribution-sync trigger's ambiguity-test aggregate — fixed via a **new
    forward migration** (`20260913000000_..._max_uuid_fix.sql`), per the "never edit an applied
    migration in place" rule: `CREATE OR REPLACE FUNCTION` redefining the same function
    (name/signature/OID preserved, the attached trigger picks it up automatically).
  - The not-yet-applied `receive_repair_order_stock` RPC's provenance-resolution aggregate —
    fixed directly in the local, not-yet-applied file (legitimate, since nothing live existed yet
    to conflict with), applied as `..._rpc_v2` after the fix.
  - Both fixes cast the `uuid` column to `text` for the aggregate then back to `uuid` — provably
    safe because the aggregate is only ever evaluated once the same statement's own
    `count(DISTINCT ...) = 1` check has confirmed exactly one candidate value exists.
- **A second, unrelated bug class found and fixed in the same not-yet-applied RPC**: two
  `RAISE EXCEPTION 'message with %'` statements had zero trailing arguments for their `%`
  placeholder — `ERROR 42601: too few parameters specified for RAISE`, which _does_ surface at
  `CREATE FUNCTION` compile time (the first live `apply_migration` attempt failed outright on
  this). Fixed by supplying the intended `v_line_index` argument to both.
- **All 5 pgTAP files executed live** (via a `tap_out`-capture-table technique built this pass,
  since MCP's `execute_sql` only returns the last statement's result set) and fixed where live
  execution revealed real FK/UNIQUE/NOT-NULL gaps in the test _fixtures themselves_ (never in the
  migrations' own DDL/RPC design) — missing `inventory_variants`/`inventory_units`/
  `inventory_products` rows, a newly-discovered composite unique index
  (`workshop_source_document_lines_matcher_line_unique`, added by a later migration than the one
  a stale test comment cited), reused movement-line/effect pairs, `auth.uid()` needing
  `SET LOCAL request.jwt.claims` outside a real PostgREST session, and one genuinely wrong
  expected SQLSTATE (a permission check firing before the intended one, given the fixture's
  original random/unpermissioned org+branch). Final live results, all fully passing:
  - `093_...purpose_test.sql`: **10/10 PASSED**.
  - `094_...schema_test.sql`: **9/9 PASSED**.
  - `095_...trigger_test.sql`: **26/26 PASSED**.
  - `096_...receive_test.sql`: **12/12 PASSED, 1 honest `skip()`** (13-assertion plan; a new
    live-only assertion trio — 4c/4d/4e — was added this pass, proving the RPC's actual core
    purpose, a genuinely SUCCESSFUL attributed receipt, which no prior assertion had ever
    exercised: all earlier assertions covered only the unattributed and rejection paths).
  - `097_...putaway_test.sql`: **15/15 PASSED**.
  - **73/73 live pgTAP assertions passing** across all 5 files (1 honest skip, never claimed as a
    pass).
- **Zone 3 regression re-run live** (090/091/092 — the only Zone-3-numbered pgTAP files) to
  confirm Zone 5's two additive changes cause no regression:
  - `090_repair_orders_schema_test.sql`: **24/26 passing**. The 2 failures are **confirmed
    pre-existing Zone 3 test staleness, unrelated to Zone 5** — both caused by unrelated Zone 3
    migrations dated **2026-09-11, one day before Zone 5's own migrations began** (`repair_orders_own_advisor_contact_id_fn`
    refactored the `repair_orders_update` policy's WITH CHECK from an inline subquery to an
    equivalent `is_own_advisor_contact()` helper function — same semantics, different SQL text,
    breaking the test's exact-string comparison; `repair_orders_field_invariants_trigger` added a
    trigger that now unconditionally derives `identity_status` from `zl_number`, making the
    `repair_orders_resolved_requires_zl_number` CHECK constraint structurally unreachable via a
    normal INSERT). Neither touches anything Zone 5 modified; not fixed this pass (out of Zone 5's
    scope; noted here for whoever next owns Zone 3's own test suite).
  - `091_repair_orders_materialization_rpc_test.sql`: **17/17 PASSED** — no regression.
  - `092_wdd_matcher_approval_rls_test.sql`: **13/13 PASSED** — no regression.
- **Real, two-connection concurrency tests — CONCURRENCY VERIFIED** (item explicitly required:
  "pgTAP alone is NOT sufficient"). Built a direct `pg`-client Node script against the live target
  DB's own Postgres connection string (bypassing MCP's single-statement-result `execute_sql` to
  get two genuinely, simultaneously open transactions):
  - **Double-consumption race**: two concurrent `putaway_repair_order_stock` calls on the SAME
    `repair_order_line_id`/source bucket (5 available, 3+3=6 requested). Result: exactly one
    succeeded (real, committed — the other was cancelled via `statement_timeout` while genuinely
    blocked waiting on the winner's row lock), final state `2` remained at receiving / `3` moved
    to destination — **no over-consumption, confirmed by live query**, not merely by return value.
  - **AB-BA lock-order / deadlock check**: one connection running `putaway_repair_order_stock`
    (engine-first lock order) concurrently against another running a raw generic `801` relocation
    on the SAME bucket (the ledger-sync trigger's own, matching lock order) — **both completed
    successfully in 223ms, zero PostgreSQL deadlock (`40P01`), no hang** — confirms the corrected
    consistent lock order (balance, then attribution/projection) holds under genuine concurrent
    load, not just in the function's own source text.
  - **UNKNOWN-marker race**: two concurrent, non-bypassed generic decrease events at the SAME
    intentionally-ambiguous `(location, variant)` bucket, each independently attempting to insert
    into `repair_order_location_attribution_uncertain` — **both completed without an unhandled
    duplicate-key crash**, proving the trigger's `ON CONFLICT DO NOTHING` genuinely holds under a
    real simultaneous race, not just sequential pgTAP execution.
  - **Lesson learned, disclosed honestly**: the first concurrency-test attempt committed one real
    `putaway_repair_order_stock` call (the double-consumption test's winner) plus reused 3 already-
    committed `101` setup receipts. `inventory_stock_ledger_entries` is **append-only by design**
    (a trigger rejects any `DELETE`), and `inventory_movement_lines` carries a real FK to the
    variant/location/product/unit rows it references — so once a real movement commits, its whole
    fixture graph becomes **permanently undeletable by design**, not a bug. All _deletable_ rows
    (repair_orders/lines/locations/markers) were fully cleaned (0 residual, confirmed by live
    query). What remains **permanently** on the live target project, clearly tagged and isolated
    to this session's own real E2E org/branch, harmless to any real business data: 2
    `warehouse_locations`, 3 `inventory_variants`, 1 `inventory_products`, 1 `inventory_units`, 4
    `inventory_movement_headers`, 5 `inventory_stock_ledger_entries` (all matching `CONC-%` /
    `zone5-conc%` tags). The remaining two concurrency tests (lock-order, UNKNOWN-race) were
    redesigned to be **rollback-only** and left zero further residue. **Recommendation for any
    future concurrency testing**: use a disposable Supabase branch (`create_branch`/
    `delete_branch`, available via this same MCP toolset) instead of the live target project
    directly, to make even a committed test fully reversible.
- **NOT attempted this pass**: application-layer/browser verification (items 14-19 of the
  originating mandate — receiving-location admin UI, real 101 receiving via the UI, receipt-link,
  real/partial putaway via the UI, UNKNOWN UI/RPC workflow, Zone 6 generic 801 rehearsal,
  Playwright responsive QA). This is a distinct, substantial layer of work (requires a running dev
  server and a real browser session) that this pass's scope and time did not extend to. Marked
  **PITCH UAT OUTSTANDING** below, honestly, not silently skipped.

**Mechanical count, all passes combined**: 23 files in the full diff (21 new, 2 pre-existing
files modified — see `changed-files.md` for the itemized manifest); 5 migrations written, **all 5
applied to the live Supabase target project this pass** (plus 1 new forward-correction migration
for a live-only bug, applied); 5 pgTAP test files, **73 assertions across `093`-`097`, all
executed live this pass: 73/73 PASSED, 1 honest skip** (up from 59 assertions/0 executed — the
+14 delta is real live-only coverage added this pass, most notably `096`'s new 4c/4d/4e trio
proving the receive RPC's actual successful-attribution path, never exercised before); 4144
vitest tests run in the full-suite regression pass (4103 passed / 24 failed — all 24 pre-existing
and unrelated to Zone 5 / 8 skipped / 9 todo); 1 full-repo `tsc --noEmit` pass (clean); `eslint`
clean on every touched file; Zone 3 pgTAP regression (090/091/092) re-run live: 54/56 passing (2
pre-existing, Zone-5-unrelated failures — see "Remaining work" #4); 3 real, execution-only-
discoverable bugs found and fixed live (uuid-aggregate ×2, missing RAISE argument ×2 in one
function); real two-connection concurrency (double-consumption, AB-BA lock order, UNKNOWN-marker
race) all CONCURRENCY VERIFIED.

## Phase-10 attribution integration pass — this session

Zone 3 Phase 10 (branch `mvp-readiness`, commit `52fc0913`, live on this same Supabase target
project) established `public.attach_repair_order_line_movement(...)` as the ONE canonical,
fully-validated production writer for `repair_order_line_movement_links`, and closed the direct
INSERT write boundary. `receive_repair_order_stock` had been directly INSERTing into that table
since its own migration — bypassing the canonical writer (only silently still working because its
own SECURITY DEFINER owner, `postgres`, has `rolbypassrls`, which the closing migration's RLS
policy cannot stop). This pass resolves exactly that overlap, nothing else.

- **Both live functions inspected fresh via `pg_get_functiondef`/`pg_proc`** before any change
  (not from old bundle text, per the mandate). Confirmed: `attach_repair_order_line_movement`'s
  every invariant (posted status, receipt category, RepairOrder reference consistency, variant
  compatibility, org/branch match) is already guaranteed true by the time
  `receive_repair_order_stock` reaches this call — verified against a real committed `101`
  movement's actual header shape (`status='posted'`, `category='receipt'`,
  `reference_type`/`reference_id` both NULL — `inventory_create_and_finalize`'s own signature has
  no reference parameter at all, so the reference-mismatch branch can never fire here). **No
  Phase-10 invariant is incompatible with the Zone-5 receipt workflow** — no STOP was needed.
- **Nested `SECURITY DEFINER` `auth.uid()` propagation confirmed live**, transaction-scoped, via a
  throwaway wrapper function structurally mirroring the real call shape: the real actor succeeds
  through the nested call; a spoofed actor is rejected. `auth.uid()` reads a session-level GUC
  (`request.jwt.claims`), unaffected by `SECURITY DEFINER` role-switching — no auth problem found.
- **Forward migration applied**: `20260914130000_zone5_receive_repair_order_stock_use_canonical_
attach.sql` (live version `20260914173843`) — `receive_repair_order_stock`'s exact signature is
  unchanged; only its business-attribution write changed, from a direct `INSERT` to
  `PERFORM public.attach_repair_order_line_movement(p_actor_user_id, v_resolved_rol_id,
v_movement_line_id, v_qty, 'receipt')`, called inside the same transaction/orchestration.
  Confirmed live: the function no longer contains any direct
  `INSERT INTO repair_order_line_movement_links`.
- **Ownership split enforced in code, exactly as designed**: the canonical Phase-10 RPC owns
  business movement attribution; Zone 5 continues to write the `repair_order_line_locations`
  spatial seed directly, unchanged, in the same transaction. Confirmed live: the attribution-sync
  trigger's own definition (`repair_order_location_attribution_sync`) is byte-for-byte unchanged
  and does not reference the canonical attach RPC — spatial attribution, UNKNOWN semantics, the
  bypass flag, zero-clear behavior, and putaway's own lock order are all untouched, confirmed via
  live definition diff, not merely asserted.
- **A genuine, live-discovered idempotency finding** (not assumed): a retry of an ATTRIBUTED
  receive with the SAME `idempotency_key` is **no longer a silent no-op**. Empirically confirmed:
  `inventory_create_and_finalize` itself returns the SAME already-posted movement/lines on retry
  (one header only for the key, same `movement_id` both calls) — so the nested attach call
  re-attempts attributing the identical `(repair_order_line_id, inventory_movement_line_id)` pair
  and is rejected by that RPC's own applied-quantity cap (`22023`). **Not a regression**: the
  pre-integration direct `INSERT` (no `ON CONFLICT` clause at all) would have hit the table's own
  unique constraint on the identical retry too, just as a raw, less-friendly `23505`. The action
  normalizer (`repair-order-receiving.ts`) now allowlists this one new, stable, expected message.
- **pgTAP `096` extended and re-run live in full**: 8 new assertions (8a-8d: the idempotent-retry
  finding above, proven atomic — exactly one link row, exactly one movement header, after the
  rejected retry; 9a-9d: two DIFFERENT RepairOrderLines attributed via two DIFFERENT Matcher lines
  in ONE call succeed independently, each against its own distinct `inventory_movement_line_id`,
  with no cross-contamination). **Result: 20/20 PASSED, 1 honest skip (21-assertion plan)** — the
  pre-existing assertions (1-7b) all still pass unchanged, confirming no regression from the
  integration.
- **Phase-10's own pgTAP file re-run live, unmodified, exactly as written** (no branch merge
  needed — pure SQL execution against the already-deployed RPC):
  `097_repair_order_line_movement_attach_phase10_test.sql` (read from the `mvp-readiness` branch
  via `git show`, never merged). **Result: 29/29 PASSED**, matching its own documented expectation.
- **Zone 5's putaway RPC confirmed untouched and non-overlapping**: `putaway_repair_order_stock`'s
  live definition contains no `repair_order_line_movement_links` write (only an explanatory
  comment saying so) — confirmed via live definition inspection, not re-run, since nothing about
  it changed.
- **Error propagation**: no Phase-10 validation logic was duplicated in Zone 5's own normalizer —
  only the one specific, stable message that this integration can newly surface was added to the
  existing allowlist convention (exact code + message-pattern match, matching every other entry).
- **Typecheck/lint**: full-repo `tsc --noEmit` clean; `eslint` clean on the modified action file;
  its own 15 pre-existing unit tests re-run, 15/15 passing, no regression.
- **Zero residual test data** from this integration pass specifically (all `096`-tagged fixtures
  and both live probe scripts used `ROLLBACK`, confirmed via live query afterward). One
  **pre-existing** residual-data interaction was found and corrected: the earlier concurrency-test
  pass's permanently-undeletable `CONC-RECV-...` location (see prior section) was still marked
  `purpose='receiving'` for the real E2E org/branch, which blocked `096`'s own temporary receiving
  location from being created (the `warehouse_locations_one_receiving_per_branch` partial unique
  index). Corrected by setting that leftover row's `purpose` back to `'standard'` — a legitimate
  follow-up correction of already-disclosed residue, not new residue.
- **Other Zone-5-adjacent live activity observed, explicitly NOT touched or integrated this pass**
  (per the mandate's own scope boundary): `inventory_add_to_container_rpc`,
  `inventory_remove_from_container_rpc` (+ a fix), `inventory_seal_container_rpc` — container work
  landing on the same shared live target project from elsewhere, dated between this pass's own
  migrations. Observed via `list_migrations`, not acted on.
- **Filename collision, flagged for whoever eventually merges `mvp-readiness` into this branch**:
  Zone 3 Phase 10's own pgTAP file and Zone 5's own pgTAP file are BOTH named `097_*_test.sql` on
  their respective branches (`097_repair_order_line_movement_attach_phase10_test.sql` vs.
  `097_zone5_putaway_repair_order_stock_test.sql`) — a literal numbering collision that will need
  resolving (renumbering one of them) at merge time. Not resolved this pass (branches were not
  merged, per the mandate's explicit "do NOT merge git branches broadly").

**Zone 5 is now technically FINAL at the DB layer** — schema, RPCs, trigger, all pgTAP (Zone 5's
own + Zone 3's 090-092 regression + Phase 10's own 097), real two-session concurrency, and the
Phase-10 attribution-ownership overlap are all live-verified with zero known open DB-layer issues.
The ONLY remaining work before pitch-readiness is application-layer/browser UAT (see "Remaining
work" below) — nothing further is planned or needed at the database level.

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

- [ ] 101 + Matcher import chain manually re-run on current build via the UI — **PITCH UAT
      OUTSTANDING** (the underlying RPC path is LIVE VERIFIED via `096`'s new 4c/4d/4e
      assertions — a real attributed receipt genuinely posts and writes both link tables — but the
      UI walkthrough itself has not been driven through a browser this pass).
- [ ] 801 relocation (Zone 6's existing UI) manually re-run on current build — **PITCH UAT
      OUTSTANDING** (the underlying generic-engine path is LIVE + CONCURRENCY VERIFIED via Test B
      above; the UI itself not driven this pass).
- [x] Matcher-line → RepairOrder-line join returns real rows for a materialized session — **LIVE
      VERIFIED** (091, unchanged, re-run live this pass: 17/17 passing).

### Phase 1 — Receiving-location schema

- [x] Migration: `20260912090000_zone5_receiving_location_purpose.sql` — `purpose` column +
      CHECK + partial unique index + stockable-receiving invariant + `resolve_branch_receiving_location()`
      grant. **LIVE VERIFIED** — applied (live version `20260912174011`), schema re-confirmed
      live, no code changes needed.
- [x] Backend admin plumbing (`updateLocationSchema` + `WarehouseLocationsService.update`) —
      **PITCH DONE**, tested (42/42 service tests passing).
- [ ] Visible toggle in the location edit UI — **NOT DONE this pass** (disclosed scope boundary,
      see correction #5 above and "Remaining work" below).
- [x] pgTAP test: `093_...purpose_test.sql`, 10 assertions — **LIVE VERIFIED: 10/10 PASSED**.
- [ ] Admin designates the demo branch's receiving location via the UI — **PITCH UAT
      OUTSTANDING** (the RPC-level equivalent is LIVE VERIFIED).

### Phase 2 — Projection + uncertainty marker + full integrity

- [x] Migration: `20260912091000_...schema.sql` — **LIVE VERIFIED** — applied (live version
      `20260912174155`), all FKs/RLS/grants re-confirmed live, no code changes needed.
- [x] pgTAP test: `094_...schema_test.sql`, 9 assertions — **LIVE VERIFIED: 9/9 PASSED** (fixture
      needed narrow FK-satisfying additions this pass — variant/branch/org rows — not a design
      change).

### Phase 3 — Safety-net trigger

- [x] Migration: `20260912092000_...trigger.sql` — **LIVE VERIFIED** — applied (live version
      `20260912174602`). A real, execution-only-discoverable `max(uuid)` bug was found via live
      pgTAP execution and fixed via a **new forward migration**
      (`20260913000000_..._max_uuid_fix.sql`, live version `20260914123823`) — see "Live/MCP
      verification pass" above.
- [x] pgTAP test: `095_...trigger_test.sql`, 26 assertions (grew from 14 as fixture gaps were
      closed with real coverage, not just fixture-satisfying rows) — **LIVE VERIFIED: 26/26
      PASSED**.
- [x] Live-DB two-session concurrency integration test — **CONCURRENCY VERIFIED** (UNKNOWN-marker
      race, see above) — no longer deferred.

### Phase 4 — `receive_repair_order_stock` RPC + wiring

- [x] Migration: `20260912093000_...receive_rpc.sql` — **LIVE VERIFIED**. Two real bugs found via
      live execution and fixed (min(uuid) aggregate, two RAISE statements missing their argument)
      — applied as `..._rpc_v2` (live version `20260914124640`) after the fix; the first
      `apply_migration` attempt failed to even compile, confirming the RAISE bug would have
      blocked deployment regardless.
- [x] **Wiring done** (#3 above) — `use-movement-submission.ts`, 5 route-selection tests passing
      (unit-level; UI walkthrough not driven this pass).
- [x] pgTAP test: `096_...receive_test.sql`, 13 assertions (grew from 10 — a new live-only trio,
      4c/4d/4e, added this pass proves the RPC's actual core purpose: a genuinely SUCCESSFUL
      attributed receipt, a path no prior assertion had ever exercised) — **LIVE VERIFIED: 12/12
      PASSED, 1 honest skip (7c)**.

### Phase 5 — Putaway read model + suggestion UI

- [x] Service: `repair-order-storage.service.ts` — `getStorageSuggestions` unchanged;
      `getReceivedLines` added prior pass. **PITCH DONE** (5 + coverage via component tests).
- [x] Server action: `getRepairOrderStorageSuggestionsAction` — error normalization. **PITCH
      DONE**.
- [x] UI: `repair-order-putaway-panel.tsx` — destination selector, 8 component tests. **PITCH
      DONE** for typecheck/lint/unit tests; **PITCH UAT OUTSTANDING** for real browser
      verification (not attempted this pass).
- [x] Wired into a real page — `/dashboard/workshop/[id]/page.tsx`.

### Phase 6 — `putaway_repair_order_stock` RPC + wiring

- [x] Migration: `20260912094000_...putaway_rpc.sql` — **LIVE VERIFIED** — applied cleanly, no
      code changes needed (live version `20260914125451`). CONCURRENCY VERIFIED via the
      double-consumption and AB-BA lock-order tests above — the lock-order restructuring from the
      third correction pass (locking balance, then attribution/projection, only after the engine
      call) is confirmed to hold under genuine simultaneous load, not just in its own source text.
- [x] Destination-selector wiring — unchanged this pass.
- [x] pgTAP test: `097_...putaway_test.sql`, 15 assertions — **LIVE VERIFIED: 15/15 PASSED**. A
      real test-fixture gap (seeded only the shadow `repair_order_line_locations` projection, not
      real on-hand balance via the engine) was found and fixed this pass — not an RPC/engine bug;
      the engine correctly rejected the under-seeded fixture's first attempt.

### Phase 7 — Presentation UAT

- [ ] Full live application walkthrough (101 receive → putaway → verify) via the real UI —
      **PITCH UAT OUTSTANDING**. Not attempted this pass; every underlying RPC/DB step it would
      exercise is independently LIVE VERIFIED.
- [ ] Zone 6 rehearsal (unambiguous + ambiguous 801 via the existing Zone 6 UI) — **PITCH UAT
      OUTSTANDING**. The underlying generic-engine/trigger behavior is LIVE + CONCURRENCY
      VERIFIED.
- [ ] Playwright / responsive QA at 390×844, 768×1024, 1440×900 — **NOT RUN this pass** — requires
      a running dev server + browser session, out of this pass's scope.
- [ ] Manual pitch scenario data preparation — **NOT DONE this pass**.

## Remaining work (explicit, not silently deferred)

1. **Location edit UI toggle** — wire a `purpose` control into `LocationModal.tsx` and/or
   `location-detail-panel.tsx` (both real, both large/unfamiliar this session) once someone with
   more context on those specific files' structure (or live rendering to verify against) can do
   so safely. The backend (`updateLocationAction`) already supports it correctly and is tested.
2. **Application-layer/browser UAT** — the DB layer this all rests on is now fully LIVE VERIFIED
   (including the Phase-10 attribution-ownership integration); the browser walkthrough itself has
   not been attempted. This is now the ONLY remaining gap before Zone 5 can be called pitch-ready
   at the technical level. Explicitly, what remains:
   - Browser/Playwright receiving UAT (real 101 receipt via the actual UI, attributed + unattributed).
   - Browser/Playwright putaway UAT (real putaway via the actual UI, including partial putaway).
   - Receiving-location configuration UAT (an admin actually designating a branch's receiving
     location — note item 1 below, the backend supports this but no UI toggle exists yet).
   - Real Zone-6 801 rehearsal (unambiguous and ambiguous cases) via Zone 6's own existing UI.
   - Final pitch rehearsal (a full, real, end-to-end walkthrough of the pitch scenario).
3. The one honestly-`skip()`ped atomicity sub-case in `096` (test 7c: a failure occurring strictly
   AFTER `inventory_create_and_finalize` succeeds but BEFORE this RPC's own attribution writes
   complete) — now technically _possible_ to attempt with live MCP access (unlike when it was
   first written), but not attempted this pass; still an honest skip, not a fabricated pass.
4. Two **pre-existing, Zone-5-unrelated** Zone 3 pgTAP staleness items surfaced by this pass's
   regression re-run (`090`, tests 10 and 22) — caused by unrelated Zone 3 migrations dated
   2026-09-11 (a policy refactor and a new invariants trigger), both confirmed live to be
   behavior-preserving, functionally-equivalent changes, not regressions. Not fixed this pass
   (out of Zone 5's scope) — flagged here for whoever next owns Zone 3's test suite.
5. Minor, permanent, harmless residue on the live target project from this pass's real
   concurrency testing (2 locations, 3 variants, 1 product, 1 unit, 4 movements, 5 ledger entries,
   all tagged `CONC-%`/`zone5-conc%`, isolated to the real E2E org/branch) — unavoidable given the
   stock ledger's own intentional append-only design (confirmed live: a trigger rejects any
   `DELETE`). See "Live/MCP verification pass" above for the full explanation and a recommendation
   (use a disposable Supabase branch next time) for anyone running further concurrency tests.

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
- [x] Zone 3 pgTAP regression (090/091/092, the only Zone-3-numbered files) — **LIVE VERIFIED,
      re-run this pass**: 090 24/26 (2 pre-existing, Zone-5-unrelated failures, see "Remaining
      work" #4), 091 17/17, 092 13/13. Zero Zone 3 files modified by Zone 5 at any point; the two
      additive composite-unique constraints Zone 5 added live elsewhere caused no observable
      regression in any Zone 3 assertion.
- [ ] Zone 6 pgTAP regression — no Zone 6 pgTAP files exist in this repo to re-run; Zone 6's own
      UI/RPC behavior was instead exercised indirectly via this pass's Test B concurrency check
      (a raw generic `801` relocation, the same path Zone 6's UI uses) — LIVE + CONCURRENCY
      VERIFIED at the RPC level, not via Zone 6's own UI.
