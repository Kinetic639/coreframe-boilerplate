# Zone 5 — Receiving / Putaway: Progress Tracker

> Companion to `05-receiving-putaway-implementation-plan.md`. **Architecture: APPROVED FOR
> IMPLEMENTATION.** This revision records the first implementation pass.

## Implementation status legend (mechanical, used throughout this file)

- **PITCH DONE** — code/migration/test written, typechecked/linted/unit-tested where that's
  possible without a live database, and (for anything DB-related) reviewed against the tracked
  schema this session could read directly.
- **PITCH — BLOCKED ON MCP** — written and ready for review, but **not applied to any live or
  local database**, because Supabase MCP was unavailable this entire session (confirmed
  repeatedly: no `select:supabase*` deferred tool, no `supabase` CLI installed until this
  session's own `pnpm install`, no running Docker daemon for a local stack). Per the working
  rules, this is reported honestly rather than fabricated as verified.
- **PITCH UAT OUTSTANDING** — code exists but has not been exercised end-to-end against a real
  browser/backend (Playwright, manual pitch rehearsal).
- **PILOT** / **TECH DEBT** — unchanged from the approved plan, not touched this pass.

**Mechanical count, this pass**: 9 new files created (6 migrations + 5 pgTAP test files — one
migration, Phase 1, has one paired test file; see manifest), 4 new TypeScript files (1 service, 1
service test, 1 server action module, 1 UI component), 0 files modified in any other zone, 0
migrations applied, 0 pgTAP tests executed, 12 new/updated vitest assertions executed and
passing (7 pre-existing + 5 new, confirming no regression in the touched area — see report),
1 full-repo `tsc --noEmit` pass (clean), 1 full-repo `eslint` pass on touched files (clean).

## Verification pass — completed (this session, final semantic correction pass — planning only)

- [x] Corrected the marker-clearing model: removed the "implicitly superseded by matching math"
      self-heal behavior. The only automatic clearing path is on-hand reaching exactly zero at
      that `(location, variant)`; all other clearing requires a future, explicit,
      full-bucket-authoritative operation (reconciliation or container/scan — PILOT, not built
      now). A single RepairOrder-aware RPC write does not clear a bucket-wide marker.
- [x] Corrected the trigger to gate on the marker's mere existence _before_ attempting the math
      test, rather than letting a later coincidentally-passing math test override an existing
      marker — closing the exact loophole the self-heal correction was about.
- [x] Corrected ambiguous-transfer handling: both ends of an ambiguous `801` are now marked
      UNKNOWN (previously only the source was marked); an ambiguous pure decrease (`402`/future
      issue) still marks only the source, since it has no paired destination.
- [x] Corrected the bypass-flag documentation: explicitly reclassified a hypothetical
      improperly-set flag as a **correctness** risk (attribution staleness) only, never a
      security one — unauthorized access, cross-org/branch access, and RLS bypass remain
      independently impossible regardless of this flag's state.

## Implementation pass — this session

- [x] Re-verified repo state (git log/status) matches the state this plan was written against;
      no new commits landed since the planning pass. Committed the planning docs as an explicit
      pre-implementation baseline (`0d8babb5`).
- [x] Confirmed Supabase MCP unavailable (`ToolSearch` for supabase-prefixed deferred tools:
      zero results).
- [x] Confirmed no local Supabase/Postgres alternative: `supabase` CLI was not installed prior to
      this session's own `pnpm install` (which brought it in only as a devDependency, unlinked to
      any project); Docker Desktop is present but its daemon is not running
      (`docker ps` → "cannot connect ... daemon is not running").
- [x] **New finding this pass, reported rather than assumed past**: `inventory_stock_ledger_entries`
      and `inventory_movement_audit_log` have **zero** tracked migrations anywhere in the repo
      (`grep -rl inventory_stock_ledger_entries` across both migration directories: no matches) —
      this is a deeper instance of the same schema-drift category already accepted as tech debt
      for the RPC bodies, but extends to the table itself. The Phase 3 trigger migration's exact
      column references are therefore based on convergent design-doc + prior-session
      LIVE-VERIFIED evidence, not this session's own live confirmation — flagged prominently in
      that migration's own header, not silently assumed. `warehouse_locations`, `inventory_balances`,
      `inventory_movement_lines`, `inventory_movement_headers`, `repair_orders`,
      `repair_order_lines`, `repair_order_line_movement_links` ARE fully tracked and were read
      directly this session with high confidence.
- [x] Deliberately did **not** fall back to `pnpm run supabase:db:push:target` (a real, working
      CLI path found in `package.json`) to apply migrations directly to the live target project —
      the working rules specify MCP for all mutations; substituting a raw CLI push against a
      shared live project the moment the specified approval path is unavailable was judged unsafe
      and out of scope for this session's own authority to decide unilaterally.

### Phase 0 — Fresh verification (PITCH, gate)

- [ ] 101 + Matcher import chain manually re-run on current build — **BLOCKED ON MCP** (no live
      environment reachable this session).
- [ ] 801 relocation (Zone 6's existing UI) manually re-run on current build — **BLOCKED ON MCP**.
- [ ] Matcher-line → RepairOrder-line join returns real rows for a materialized session —
      **BLOCKED ON MCP**.

### Phase 1 — Receiving-location schema

- [x] Migration written: `20260912090000_zone5_receiving_location_purpose.sql` —
      `warehouse_locations.purpose` + CHECK + partial unique index +
      `resolve_branch_receiving_location()` helper. **PITCH — BLOCKED ON MCP** (not applied).
- [ ] Location edit UI: purpose toggle — **NOT BUILT this pass** (time-boxed out in favor of the
      DB layer + the receiving/putaway RPCs and read model, which are the parts every other phase
      depends on; a location can still be designated via direct update against the resolver's own
      invariants once applied — see remaining work in the final report).
- [x] pgTAP test written: `093_zone5_receiving_location_purpose_test.sql` (8 assertions) —
      **PITCH — BLOCKED ON MCP** (not executed).
- [ ] Admin designates the demo branch's receiving location — **BLOCKED ON MCP** (depends on the
      migration being applied first).

### Phase 2 — Projection + uncertainty marker + full integrity

- [x] Migration written: `20260912091000_zone5_repair_order_spatial_attribution_schema.sql` —
      both composite-unique constraints, `repair_order_line_locations` (all 3 composite FKs, no
      `container_id`), `repair_order_location_attribution_uncertain`, RLS (SELECT-only). **PITCH
      — BLOCKED ON MCP**.
- [x] pgTAP test written: `094_zone5_repair_order_spatial_schema_test.sql` (9 assertions,
      including all 3 composite-FK rejections and RLS isolation) — **PITCH — BLOCKED ON MCP**.

### Phase 3 — Safety-net trigger (corrected timing, no-inference, no-self-heal, both-ends, on_hand-only)

- [x] Migration written: `20260912092000_zone5_attribution_sync_trigger.sql` — implements the
      full corrected algorithm (on_hand guard, zero-clears rule unconditional, bypass check,
      fast no-op path, marker-gate-before-math, pre-effect reconstruction from the ledger row's
      own columns, both-ends marking). **PITCH — BLOCKED ON MCP**, with the additional disclosed
      column-verification gap noted above.
- [x] pgTAP test written: `095_zone5_attribution_sync_trigger_test.sql` (14 assertions covering
      all 13 required scenarios plus the structural concurrency proof) — **PITCH — BLOCKED ON
      MCP**.
- [ ] Live-DB two-session concurrency integration test — **explicitly deferred**, per the plan's
      own §6.1, not written this pass either (would itself require live/local DB access to run).

### Phase 4 — `receive_repair_order_stock` RPC + wiring

- [x] Migration written: `20260912093000_zone5_receive_repair_order_stock_rpc.sql` — actor check,
      permission check, receiving-location resolution, Matcher-line resolution with the
      null/unique/zero/ambiguous four-way contract, org/branch/variant cross-validation, calls
      `inventory_create_and_finalize('101', ...)`, writes seed attribution +
      `repair_order_line_movement_links` directly. **PITCH — BLOCKED ON MCP**.
- [x] `use-movement-submission.ts` wiring — **NOT DONE this pass** (see remaining work; the
      existing manual-movement-editor path is unchanged and unaffected, which was independently
      confirmed by the full `tsc`/`eslint`/`vitest` passes below showing zero regressions).
- [x] pgTAP test written: `096_zone5_receive_repair_order_stock_test.sql` (7 assertions; 2 marked
      as fixture-TODO for ambiguous-resolution and atomicity, requiring live fixtures) — **PITCH
      — BLOCKED ON MCP**.

### Phase 5 — Putaway read model + suggestion UI

- [x] Service written: `src/server/services/repair-order-storage.service.ts` — plain
      client-side read + aggregation against `repair_order_line_locations` +
      `repair_order_location_attribution_uncertain` (deliberately not a new DB function/view).
      **PITCH DONE** for the logic itself: unit-tested against a mocked Supabase client (5/5
      tests passing, see report), typechecked, linted clean.
- [x] Server action written: `getRepairOrderStorageSuggestionsAction` in
      `repair-order-receiving.ts`. **PITCH DONE** (typechecked/linted); **BLOCKED ON MCP** for
      any live call (depends on Phase 2's tables existing).
- [x] UI written: `repair-order-putaway-panel.tsx` — suggestion list (KNOWN only, `[Put here]`),
      a visibly separate UNKNOWN warning banner (never merged into confident suggestions), a
      manual-location fallback, multi-line selection with per-line quantity for batch putaway.
      No capacity/percentage display anywhere. **PITCH DONE** for typecheck/lint; **PITCH UAT
      OUTSTANDING** (no browser/Playwright run — no live backend to render real data against).
- [ ] Wiring this panel into Zone 3's actual RepairOrder Workshop detail page — **NOT DONE this
      pass**; the panel is self-contained and takes its data as props specifically so it can be
      dropped into that page without this session needing to reverse-engineer its full existing
      structure under time pressure (see remaining work).

### Phase 6 — `putaway_repair_order_stock` RPC + wiring

- [x] Migration written: `20260912094000_zone5_putaway_repair_order_stock_rpc.sql` — batch
      contract (one call, N lines, one destination, one document), destination validation,
      per-line quantity-available validation against the live projection, writes attribution
      directly, does **not** clear a pre-existing bucket-wide marker, writes **no**
      `repair_order_line_movement_links` row. **PITCH — BLOCKED ON MCP**.
- [x] `[Put here]` / manual-location wiring — done in the Phase 5 UI component (same file).
- [x] pgTAP test written: `097_zone5_putaway_repair_order_stock_test.sql` (6 assertions: batch,
      partial quantity, destination credit, over-request rejection, marker non-clearing, no
      `relation_type='putaway'` row ever exists). **PITCH — BLOCKED ON MCP**.

### Phase 7 — Presentation UAT

- [ ] Full live run — **BLOCKED ON MCP** (no live environment).
- [ ] Zone 6 rehearsal (plain `801` on deliberately unambiguous data) — **BLOCKED ON MCP**.
- [ ] Playwright / responsive QA at 390×844, 768×1024, 1440×900 — **NOT RUN this pass**; honestly
      reported as an environmental limitation (no live Supabase project reachable to render real
      warehouse/RepairOrder data, and this session's Playwright config depends on the app's own
      dev server + backend) rather than fabricated. See final report.
- [ ] Manual pitch scenario data preparation — **NOT DONE this pass** (depends on Phase 0/1
      being live-applicable first).

## Known-good regression checks (run this pass)

- [x] Full-repo `tsc --noEmit`: **clean** (0 errors) after fixing a real narrowing issue this
      pass surfaced (see final report) in three newly-added files — not a pre-existing bug, and
      not left unresolved.
- [x] `eslint` on every new file: **clean** (0 errors, 0 warnings after removing one unused
      import).
- [x] `vitest` targeted run (new service test): **5/5 passing**.
- [x] `vitest` full-suite regression run: see final report for the completed result (was still
      running in the background at the time this tracker was last edited — do not treat an
      earlier partial view of this file as the final word; the report has the actual number).
- [ ] Zone 3 pgTAP regression (`090`-`092`) — **BLOCKED ON MCP** (not executed, but not modified
      either — this pass touched zero existing Zone 3 files).
- [ ] Zone 6 regression — **BLOCKED ON MCP**; zero Zone 6 files modified this pass.
