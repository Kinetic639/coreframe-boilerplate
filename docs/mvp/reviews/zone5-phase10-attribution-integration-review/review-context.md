# Zone 5 Phase-10 Attribution Integration — Review Context

## Scope

This bundle resolves exactly ONE thing: `receive_repair_order_stock`'s direct write to
`repair_order_line_movement_links` overlapped with Zone 3 Phase 10's newly-established canonical
writer, `attach_repair_order_line_movement`. Nothing else about Zone 5 changed. The Zone 5 DB
architecture, migrations, pgTAP suite, and concurrency behavior established in the prior pass
(baseline `e604d6e4`) remain ACCEPTED and FROZEN, as directed — this pass did not redesign
anything, did not touch UNKNOWN semantics, the attribution trigger, or putaway semantics, and did
not start any PILOT work.

## Background: why this overlap existed

Zone 3 Phase 10 (branch `mvp-readiness`, commit `52fc0913`) landed live on the same shared
Supabase target project this Zone 5 work targets, establishing
`public.attach_repair_order_line_movement(...)` as the one canonical, fully-validated production
writer for `repair_order_line_movement_links`, and closing the previous permissive direct-INSERT
RLS policy with a deny-all one. Zone 5's own `receive_repair_order_stock` — applied to the same
live database in an earlier pass this same session, before this integration — had always written
to that table directly. Because `receive_repair_order_stock` is itself `SECURITY DEFINER` owned by
`postgres` (which has `rolbypassrls`), its direct INSERT kept succeeding silently even after
Phase 10's policy closure — RLS was never actually protecting that write path in the first place;
the real fix is architectural (one canonical writer), not a permissions fix.

## Verification approach

Per the instruction to work from live reality, not old bundle text: both `attach_repair_order_line_
movement` and `receive_repair_order_stock` were inspected fresh via `pg_get_functiondef`/`pg_proc`
before writing any code. The overlap was confirmed by reading `receive_repair_order_stock`'s live
body directly (its own `INSERT INTO repair_order_line_movement_links` statement, visible in the
live function definition). Compatibility was confirmed empirically: a real, committed `101`
movement's actual header (created during this same session's earlier work) was queried directly to
confirm `status='posted'`, `category='receipt'`, `reference_type`/`reference_id` both NULL — every
precondition the canonical RPC's own invariants require was already true, so no invariant conflict
exists and no STOP was required.

Nested `SECURITY DEFINER` `auth.uid()` propagation — the one genuine risk this kind of change can
introduce — was proven live, not assumed: a throwaway `pg_temp` wrapper function, structurally
mirroring `receive_repair_order_stock` calling `attach_repair_order_line_movement` internally, was
created and exercised inside a transaction that rolled back at the end. The real actor succeeded
through the nested call; a spoofed actor was rejected. This confirms `auth.uid()`'s own
implementation (reading the session-level `request.jwt.claims` GUC, unaffected by role-switching)
behaves exactly as expected under nesting.

## The one genuine behavioral finding

Live execution surfaced something no static review could have predicted: a retry of an ATTRIBUTED
receive using the SAME `idempotency_key` is no longer a silent no-op. `inventory_create_and_
finalize` itself returns the SAME already-posted movement and movement lines on retry (empirically
confirmed via a dedicated probe — one header only for the key, identical `movement_id` on both
calls). The second `receive_repair_order_stock` call's nested `attach_repair_order_line_movement`
call therefore re-attempts attributing the exact same `(repair_order_line_id,
inventory_movement_line_id)` pair, and that RPC's own applied-quantity cap correctly rejects it
(`22023`) before the flow ever reaches its `ON CONFLICT`/`23505` duplicate-key path. This is
**not a regression introduced by this integration** — the pre-integration direct `INSERT` (with no
`ON CONFLICT` clause at all) would have hit `repair_order_line_movement_links_unique` on the
identical retry, just as a raw, less-friendly `23505`. The new behavior is, if anything, a mild
improvement (a specific, safe domain message instead of a raw constraint-violation), though the
message text itself ("applied_quantity exceeds...") is a little indirect for what is really an
"already fully processed" situation — noted here as a minor, non-blocking UX nitpick, not fixed
this pass (out of scope: message wording, not a defect).

This finding is proven atomic and safe by four new pgTAP assertions (096's 8a-8d): the retry fails
with the exact expected code/message, and — critically — after the failed retry, exactly one
`repair_order_line_movement_links` row and exactly one movement header still exist for that key.
No double-write, no partial corruption, no duplicate movement.

## Residual-data interaction with the prior pass

While building `096`'s live fixture, a `duplicate key value violates unique constraint
"warehouse_locations_one_receiving_per_branch"` error surfaced — traced to the PRIOR
(concurrency-testing) pass's own permanently-undeletable `CONC-RECV-...` location, which was still
marked `purpose='receiving'` for the real E2E org/branch (append-only-ledger residue, already
disclosed in the prior pass's own report). This pass corrected that leftover row's `purpose` back
to `'standard'`, unblocking `096`. This is a legitimate follow-up correction of already-disclosed
residue, not new residue — no new permanently-undeletable rows were created by this pass (every
`096`-tagged fixture and both live probe scripts used `ROLLBACK`, confirmed by live query
afterward: zero residual rows).

## What was deliberately NOT done

- No branch merge. Zone 3 Phase 10's files were read via `git show` from `origin/mvp-readiness`
  (commit `52fc0913`) for reference and to re-run its own pgTAP file's SQL directly against the
  live database; the branches themselves were never merged.
- No other Zone-5-adjacent live activity (container RPCs observed via `list_migrations`, landing
  from elsewhere on the same shared project) was touched or integrated.
- No change to putaway, the attribution trigger, UNKNOWN semantics, or spatial attribution — all
  confirmed live to be byte-for-byte unchanged, not merely asserted.
- Application-layer/browser verification was not attempted — this remains the one substantial gap
  before Zone 5 is pitch-ready, and is now, following this pass, the ONLY remaining gap at the
  technical level.

## Known follow-up item (not blocking, flagged for whoever merges `mvp-readiness`)

Zone 3 Phase 10's own pgTAP file and Zone 5's own pgTAP file are both named `097_*_test.sql` on
their respective branches — a literal filename collision that will need resolving (renumbering one
of them) whenever these branches are eventually merged. Not resolved this pass, since it requires
a merge decision outside this pass's scope.
