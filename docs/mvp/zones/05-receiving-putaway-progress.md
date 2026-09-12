# Zone 5 — Receiving / Putaway: Progress Tracker

> Companion to `05-receiving-putaway-implementation-plan.md`. **Architecture: APPROVED FOR
> IMPLEMENTATION.** Nothing below is implemented yet — this tracker still starts from zero
> checked boxes; approval means the design is no longer open for re-litigation, not that work
> has begun. This revision folds in the sixth (final) correction pass: the UNKNOWN marker no
> longer self-heals from arithmetic coincidence (it clears only via on-hand reaching zero, or a
> future full-bucket reconciliation/scan operation — never implicitly); an ambiguous
> transfer-shaped movement marks **both** the source and destination `(location, variant)`
> uncertain, not just the source; a single RepairOrder-aware write never clears a bucket-wide
> marker on its own; and the bypass-flag documentation is corrected to classify a hypothetical
> misuse as a correctness risk, never a security one.

## Verification pass — completed (this session, final semantic correction pass)

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

## Verification pass — completed (prior session, timing/honesty correction pass)

- [x] Confirmed `inventory_finalize_posting`'s traced ordering (balance UPDATE before ledger
      INSERT) means an `AFTER INSERT` trigger always sees the **post**-effect
      `inventory_balances.on_hand_quantity` — the original ambiguity-test formula
      (`SUM(projection) = inventory_balances.on_hand`) was timing-wrong and would have rejected
      genuinely unambiguous moves. Corrected to reconstruct pre-effect on-hand from the ledger
      row's own `balance_after`/`quantity`/`direction` instead of re-querying the balance table.
- [x] Confirmed `inventory_stock_ledger_entries.balance_field` and
      `inventory_movement_type_effects.balance_field` both model `on_hand | reserved | allocated
    | blocked | consignment` — the trigger's first guard rejects every value except `on_hand`,
      so a future reservation/allocation-type effect can never mutate physical location
      attribution.
- [x] Confirmed this repo's own established, explicit convention for the concurrency-test
      limitation (`supabase/tests/091_repair_orders_materialization_rpc_test.sql`: "true
      two-connection concurrent-call testing cannot be expressed in a single pgTAP script") —
      reused verbatim rather than inventing a different convention or overclaiming pgTAP proves
      genuine concurrency.
- [x] Verified the `SET LOCAL` bypass flag's security posture: it is settable only from inside
      the two orchestration RPCs' own PL/pgSQL bodies (never a function parameter), and
      PostgREST's request surface gives an ordinary authenticated Data API caller no way to
      submit a raw `SET`/`SET LOCAL` statement at all — the flag is duplicate-work suppression
      only, never relied upon as an authorization boundary; real authorization stays with RLS +
      the RPCs' own `has_branch_permission` checks + the target table's lack of any
      client-writable policy.
- [x] Re-confirmed Supabase MCP unavailable this session; all of the above is repo-verified
      (migration files, existing test files, engine trace documentation), not live-verified.

## Phase 0 — Fresh verification (PITCH, gate)

- [ ] 101 + Matcher import chain manually re-run on current build.
- [ ] 801 relocation (Zone 6's existing UI) manually re-run on current build.
- [ ] Matcher-line → RepairOrder-line join returns real rows for a materialized session.

## Phase 1 — Receiving-location schema

- [ ] Migration: `warehouse_locations.purpose` + `CHECK` + partial unique index.
- [ ] Location edit UI: purpose toggle.
- [ ] DB test: at most one `purpose='receiving'` location per branch.
- [ ] Admin designates the demo branch's receiving location.

## Phase 2 — Projection + uncertainty marker + full integrity

- [ ] Migration: `repair_orders_id_org_branch_unique` composite-unique constraint.
- [ ] Migration: `repair_order_lines_id_repair_order_id_unique` composite-unique constraint.
- [ ] Migration: `repair_order_line_locations` table — no `container_id`; all three composite
      FKs (location, repair_order, repair_order_line-pair).
- [ ] Migration: `repair_order_location_attribution_uncertain` table (§1.6 of the plan) — no
      client-writable RLS policy, same posture as the projection table itself.
- [ ] RLS: SELECT-only client policy on the projection table; no client INSERT/UPDATE/DELETE
      policy on either new table.
- [ ] pgTAP: RLS isolation (org A cannot read org B's rows) on both new tables.
- [ ] pgTAP: three composite-FK rejection tests — wrong-branch location; wrong-org/branch
      RepairOrder; `repair_order_line_id` that does not belong to the claimed `repair_order_id`.
- [ ] pgTAP: UPSERT/decrement arithmetic never produces a negative `quantity`.

## Phase 3 — Safety-net trigger (corrected timing, no-inference, no-self-heal, both-ends, on_hand-only)

- [ ] Migration: `repair_order_location_attribution_sync()` implementing, in order: the
      `balance_field <> 'on_hand'` guard; the zero-clears-marker rule (unconditional, runs even
      under the bypass flag); the `ambra.repair_order_attribution_authoritative` bypass check;
      the fast no-op path (no attribution rows _and_ no existing marker); the direction check;
      the movement-line destination lookup; the **marker-gate** (if a marker already exists for
      the bucket, re-affirm/extend it and return — never re-attempt the math); pre-effect
      reconstruction from `NEW.balance_after`/`NEW.quantity`/`NEW.direction` (only reached when
      no marker exists); the unambiguous test with `FOR UPDATE` row locking; on ambiguity, mark
      **both** source and destination (if transfer-shaped) UNKNOWN.
- [ ] Migration: trigger attached `AFTER INSERT ON inventory_stock_ledger_entries FOR EACH ROW`.
- [ ] pgTAP: `balance_field <> 'on_hand'` (synthetic `'reserved'` row) → no-op, both tables
      untouched.
- [ ] pgTAP: single unambiguous attribution source, transfer-shaped → propagates correctly
      (source decrements, destination credited with the same `repair_order_line_id`).
- [ ] pgTAP: single unambiguous attribution source, pure-decrease-shaped (simulated issue/402) →
      propagates correctly (decrements, credits nowhere).
- [ ] pgTAP: **timing-correctness proof** — a decrease ledger row whose `balance_after` is
      already post-effect (e.g. 5→3 for a decrease of 2) is still correctly recognized as
      unambiguous against the _reconstructed_ pre-effect value (5), not the raw post-effect
      value (3).
- [ ] pgTAP: **ambiguous transfer marks BOTH ends** — two attribution sources at `(A, X)`, a
      plain `801` `A → B` → projection unchanged at both `A` and `B`, uncertainty markers
      inserted for **both** `(A, X)` and `(B, X)`, including when `B` had zero prior rows.
- [ ] pgTAP: **ambiguous pure decrease marks only the source** — same commingled setup, a `402`
      (no destination) → only `(A, X)` marked, no second bucket created.
- [ ] pgTAP: one attribution source + coexisting unattributed stock → projection unchanged,
      source (and destination, if transfer-shaped) marked.
- [ ] pgTAP: no attribution and no existing marker at the location/variant → no-op, fast path.
- [ ] pgTAP: `SET LOCAL ambra.repair_order_attribution_authoritative='on'` suppresses the
      trigger's propagation logic even in the otherwise-unambiguous case, while the zero-clears
      rule still runs regardless (proves the two are independent).
- [ ] pgTAP: **no-self-heal proof (the load-bearing test for this whole correction)** — mark
      `(A, X)` UNKNOWN via an ambiguous movement, then post a second, independently
      unambiguous-looking movement at `(A, X)` → assert the trigger does **not** propagate it and
      does **not** clear the marker; it only re-affirms the marker.
- [ ] pgTAP: **zero clears the marker** — with `(A, X)` marked UNKNOWN, a movement bringing
      on-hand there to exactly zero clears it; this is the _only_ automatic clearing path tested.
- [ ] pgTAP: **a single RepairOrder-aware write does not clear a bucket-wide marker** — with
      `(A, X)` marked UNKNOWN (RO1+RO2+ordinary commingled), a `putaway_repair_order_stock` call
      moving only RO1's known line out of `A` leaves the `(A, X)` marker in place.
- [ ] pgTAP (structural, per §6.1 of the plan): the `FOR UPDATE` statement is present in the
      trigger body; sequential replay (call pattern within one script) produces correct,
      non-duplicated results.
- [ ] **Explicitly deferred, not written this phase**: a live-DB, two-separate-session
      integration test proving genuine concurrent-decrease safety — tracked as a required test,
      not claimed as already proven by pgTAP alone.

## Phase 4 — `receive_repair_order_stock` RPC + wiring

- [ ] Migration: function — actor check, `has_branch_permission` check, receiving-location
      resolution (re-checked every call), Matcher-line resolution per the three-outcome contract
      (null → unattributed; unique → attributed; zero or multiple → hard error), org/branch/
      variant cross-validation, `SET LOCAL` authoritative flag, calls
      `inventory_create_and_finalize('101', ...)`, writes the seed `repair_order_line_locations`
      row (`FOR UPDATE`-locked) + `repair_order_line_movement_links` (`relation_type='receipt'`)
      directly.
- [ ] `use-movement-submission.ts`: resolve `source_line_id` per imported line; route through the
      new RPC when applicable.
- [ ] Non-RepairOrder 101 receiving still works unmodified (regression check).
- [ ] pgTAP: `source_line_id = NULL` → unattributed receipt succeeds.
- [ ] pgTAP: `source_line_id` resolves to exactly one → attributed receipt succeeds.
- [ ] pgTAP: `source_line_id` resolves to zero rows → hard error, whole call rejected.
- [ ] pgTAP: `source_line_id` resolves to more than one candidate → hard error (proven reachable
      given `workshop_source_document_lines.wdd_matcher_line_id` has no UNIQUE constraint).
- [ ] pgTAP: atomicity — forced mid-function failure rolls back the movement too.
- [ ] Service test: Matcher-line → repair_order_line_id resolution against fixture data.

## Phase 5 — Putaway read model + suggestion UI (now includes attribution status)

- [ ] Service: `repair-order-storage.service.ts`, query joins against
      `repair_order_location_attribution_uncertain` and excludes/separates UNKNOWN rows.
- [ ] Server action wrapping the service, returning `attributionStatus: 'known' | 'unknown'` per
      suggestion.
- [ ] UI: suggestion list (`[View contents]` / `[Put here]`, multi-select for batch putaway),
      empty state, manual-location fallback, UNKNOWN suggestions never mixed into confident
      `[Put here]`-eligible results. No capacity/percentage display.
- [ ] pgTAP/service test: an UNKNOWN-marked `(location,variant)` is omitted or clearly separated
      from the confident suggestion list.
- [ ] Entry-point placement confirmed against Zone 3's actual RepairOrder Workshop UI.

## Phase 6 — `putaway_repair_order_stock` RPC + wiring

- [ ] Migration: function — actor check, permission check, per-line org/branch/variant
      cross-validation, per-line quantity-available validation against the live projection,
      forces `source_location_id` to the receiving location, `SET LOCAL` authoritative flag,
      calls `inventory_create_and_finalize('801', p_lines)` with all lines in one document,
      then writes `repair_order_line_locations` directly itself, `FOR UPDATE`-locked.
- [ ] `[Put here]` supports selecting multiple suggested lines → one destination → one call.
- [ ] Manual-location fallback wired the same way.
- [ ] pgTAP: full worked example —
  - [ ] `receive_repair_order_stock` +5 → RECEIVING (explicit write)
  - [ ] `putaway_repair_order_stock` 5 RECEIVING → A (explicit write)
  - [ ] plain, unmodified `801` 2 A → B (safety-net trigger propagates — provably unambiguous,
        using the corrected pre-effect reconstruction, not a lucky pre-fix coincidence)
  - [ ] simulated issue 1 from A (direct ledger insert; safety-net trigger propagates, same test)
  - [ ] assert RECEIVING=0, A=2, B=2
- [ ] pgTAP: atomicity — forced failure rolls back the `801` too.
- [ ] pgTAP: batch — one call, three lines, one destination, exactly one movement document.
- [ ] pgTAP: partial-quantity putaway leaves the correct remainder at the receiving location.

## Phase 7 — Presentation UAT

- [ ] Full live run: Matcher → receipt → RECEIVING visible → putaway opened → suggestions
      correct → destination chosen (batch) → 801 posted → final location + history verified.
- [ ] At least one relocation performed via Zone 6's existing, unmodified UI, on deliberately
      unambiguous data — confirming the corrected trigger propagates correctly for that real,
      unmodified entry point.
- [ ] Presenter briefed: commingled/ambiguous stock is a known, disclosed limitation (marked
      UNKNOWN, never guessed) — not something to claim works universally if asked.
- [ ] Second RepairOrder / second delivery run for consolidation-first ordering with real data,
      choreographed to avoid commingled attribution at any touched location.

## Known-good regression checks (run before declaring any phase done)

- [ ] Plain (non-RepairOrder) 101 receiving is unaffected.
- [ ] Plain (non-RepairOrder) 801/402/etc. movements are unaffected in output and not measurably
      slower (on_hand guard + fast-path).
- [ ] A synthetic non-`on_hand` ledger effect (reserved/allocated/blocked/consignment) never
      touches `repair_order_line_locations` or the uncertainty table.
- [ ] Zone 6's own relocation flow is unaffected code-wise (only a new trigger added to a shared
      table's INSERT event; sign-off required specifically for this).
- [ ] Zone 3's RepairOrder Workshop UI and Matcher approval flow are unaffected; the two new
      composite-unique constraints on Zone 3's own tables are additive and change no existing
      behavior or RLS policy.
