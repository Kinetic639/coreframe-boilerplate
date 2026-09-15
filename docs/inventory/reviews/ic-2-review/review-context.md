# IC-2 Review Context — Movement Reversal

**Scope**: IC-2 only (`inventory_reverse_movement` + the minimal supporting
extension to `inventory_finalize_posting` + the new `900`/`KOR` movement/
document type). IC-3 is NOT started. Phase 10D is NOT started. IC-0/IC-1
are not reopened — their own accepted core is untouched by this phase (see
`changed-files.md`'s "No changes to" list).

**UPDATE 2026-09-15 — SECURITY-BOUNDARY CORRECTION PASS**: the original
IC-2 submission below was externally reviewed; the physical reversal
architecture was ACCEPTED, but a P0 was flagged — `p_explicit_effects` (§2
below) was added to the EXTERNALLY-CALLABLE canonical `inventory_finalize_
posting`, not restricted to the reversal mechanism, and that function
carried live `anon` EXECUTE. Live investigation CONFIRMED this: an ordinary
`authenticated` caller could double `on_hand` on their own draft via a
crafted 3-arg call. Fixed by internalizing the capability (see "New: §9
below" and `migration-summary.md` items 8-9). This bundle is UPDATED
in-place against the SAME baseline SHA — not a new IC-3 bundle. Everything
below this notice is the ORIGINAL submission's own context, preserved as
written; see the new §9 for what changed this pass.

**Baseline**: `27d900071813c82cc7d6a20d97dadd42def21e8f` (commit `ic1`),
branch `zone3-zone5-integration-audit`. IC-1's own work — staged but not
committed for part of this session — was committed externally by the user
partway through IC-2's implementation, giving IC-2 a clean, isolated
baseline (confirmed via `git diff --stat`: exactly 11 files, all IC-2's
own, zero IC-1 content mixed in).

**What changed, in one paragraph**: `inventory_reverse_movement` is a new
canonical RPC that reverses a posted movement by creating a brand-new
movement (never editing or deleting the original) whose own effects are
the exact inverse of the original's, posted through the SAME `inventory_
finalize_posting` engine IC-1 hardened — so the IC-1 commitment invariant
applies to reversals automatically, with zero special-casing. Because the
existing movement-type/effect catalog is TYPE-level (fixed per movement
type, not expressible per-instance), and no existing type can serve as a
correct inverse for every other type, `inventory_finalize_posting` gained
one new optional parameter (`p_explicit_effects`, default NULL, zero
behavior change for every pre-existing caller) and a new minimal, generic,
system-only movement type (`900`/`KOR`) was added. Two product decisions
were closed before implementation: no undo-an-undo, and no RepairOrder
business-quantity netting for reversals.

## Please verify these 8 things

1. **Is reversal always a new movement, never an edit?** Read `inventory_
reverse_movement`'s own body (migration 3/5/6, or the live `pg_get_
functiondef`) — confirm it only ever `INSERT`s a new header/lines and
   the ONE narrow `UPDATE` to the original is limited to `status`,
   `reversal_movement_id`, `reversed_by`, `reversed_at` (no quantity,
   type, source/destination, or document-identity field is ever touched
   on the original).

2. **Can posted original history ever be edited outside this narrow
   linkage?** Confirm `inventory_prevent_header_modification`/`_line_
modification` are untouched (not weakened, not bypassed) — the
   narrow UPDATE works only because the trigger ALREADY permitted it
   when `ambra.inventory_movement_engine = 'on'`, which the RPC sets the
   same way every other canonical writer does.

3. **Can the same original be reversed twice, or a reversal itself be
   reversed?** See T16/T17 in `test-and-concurrency-evidence.md` and
   the genuine two-session concurrency proof — confirm exactly one
   reversal ever exists per original, and that reversing a reversal
   movement (`original_movement_id IS NOT NULL`) is unconditionally
   rejected (`P0005`).

4. **Does receipt reversal restore the exact pre-receipt balance, and
   does 801 reversal restore BOTH legs exactly?** See Scenario A (T5)
   and Scenario B (T12-T13).

5. **Does reversal use `inventory_finalize_posting` rather than direct
   balance mutation, and can it strand reserved/allocated stock?** See
   the `p_explicit_effects` design (migration-summary.md §2) and
   Scenario D (T23-T28) — confirm the SAME `P0003` invariant check
   applies, atomically, with zero special-casing for reversals.

6. **Is concurrency genuinely proven with two real sessions, and is the
   lock-order/staleness disclosure honest?** Read the concurrency
   section of `test-and-concurrency-evidence.md` closely — confirm the
   ~5-second block is real (not coincidental), that Session B's
   rejection happened only after re-reading the NOW-committed status
   under its own lock, and that the concurrency-test residual (2
   immutable movement headers + 1 branch + 1 location + 1 balance + 2
   audit rows) is an honest, correctly-reasoned disclosure (the
   immutability trigger genuinely blocked deletion — verify it was not
   bypassed) rather than something swept under the rug.

7. **Were the live-caught defects handled correctly?** Four genuine bugs
   were found and fixed forward during this phase (overload ambiguity,
   reserved SQLSTATE P0004, Zone 5 attribution corruption, anon grant
   re-exposure) — see `migration-summary.md` items 4-7. Confirm each
   fix is proportionate, forward-only (no already-applied migration was
   edited), and doesn't quietly expand IC-2's own scope (in particular,
   confirm Zone 5 itself was genuinely never touched — only the
   reversal RPC's own use of an EXISTING GUC).

8. **Were the two product decisions genuinely honored, not just
   declared?** Confirm no code path calls `attach_repair_order_line_
movement` or writes any `repair_order_line_movement_links` row from
   `inventory_reverse_movement` (decision B), and confirm the "already
   reversed"/"reversal-of-reversal" checks are unconditionally enforced
   with no bypass (decision A) — cross-check against T16/T17 and the
   concurrency proof's own "exactly one reversal" result.

## Known, disclosed limitations (not defects)

- `repair_order_line_locations` becomes STALE (not actively wrong, but
  not automatically corrected either) after reversing a RepairOrder-
  attributed receipt — an explicit, already-planned IC-5 concern
  (architecture doc decision #7), not resolved by IC-2.
- The two IC-0-identified raw-write RLS gaps (reservation/allocation
  tables; movement-header status-blind INSERT) remain open — unaffected
  by, and unrelated to, IC-2's own scope; still IC-7's job.
- The default-privilege behavior that re-exposes `anon` EXECUTE on
  every `CREATE OR REPLACE FUNCTION` (not just this function —
  `inventory_finalize_posting` has carried this since before IC-1) is a
  broader, systemic finding recorded for IC-7's own audit, not fixed at
  the schema/default-privilege level here — only this phase's own new
  function was hardened.
- **New, discovered this pass**: the posted-header immutability trigger
  (`inventory_prevent_header_modification`) only checks that its own
  session GUC (`ambra.inventory_movement_engine`) is `'on'` — never which
  columns changed. Since that GUC is an ordinary session parameter any
  role can set, and the `inventory_movement_headers` UPDATE RLS policy has
  no column-level `WITH CHECK`, live-proven that any `authenticated` actor
  already holding `warehouse.inventory.operate`/`.adjust`/`.reverse` can
  set the GUC themselves and raw-`UPDATE` any column of any posted header.
  Pre-existing (predates IC-2), not fixed this pass — assigned to IC-7.
  See architecture doc §7/§9 for the full finding.

## §9 — What the security-boundary correction pass actually changed (please verify)

9. **Is the P0 genuinely closed, not just relocated?** Confirm
   `inventory_finalize_posting_internal` has zero EXECUTE for
   `anon`/`authenticated`/`service_role` (`has_function_privilege`), that
   the vulnerable public-named 3-arg overload no longer exists in
   `pg_proc` at all (not merely stripped of grants), and that the public
   2-arg `inventory_finalize_posting` has NO explicit-effects capability
   whatsoever (not even gated) — it is a pure pass-through to the internal
   function with a hardcoded `NULL` third argument.
10. **Is the internal/public split genuinely enforced by Postgres
    privilege semantics, not a convention?** Confirm `inventory_reverse_
movement` reaches the internal function only because both are
    `SECURITY DEFINER` owned by `postgres` (same-owner call), and that a
    direct call attempt by an ordinary authenticated session fails with
    `42501` (Scenario E, T32 in `103_...`) — not merely because "nothing
    else happens to call it."
11. **Do the defense-in-depth checks add real protection, or are they
    redundant with the privilege revoke?** Confirm the `movement_type_
code = '900'` check reads the value from the row the function itself
    locked (`v_header.movement_type_code`), never from any caller-supplied
    parameter — so even a hypothetical future internal caller with a bug
    could not target an arbitrary movement type via explicit effects.
12. **Was the same arity-overload pitfall (already hit once in the
    original submission, defect #1) caught before being reported as
    fixed, or did it ship?** See `migration-summary.md` item 9 — confirm
    the live `pg_proc`/`has_function_privilege` re-check that caught the
    still-live vulnerable overload happened BEFORE this bundle was
    finalized, and that the exact old 3-arg signature is genuinely absent
    now (`42883` on a probe call, not merely "not intended to be called").
13. **Is the new "original header immutability" wording honest, not just
    softened?** The prior wording ("the original is never edited") is
    corrected in §7/§9 of the architecture doc to distinguish what
    `inventory_reverse_movement`'s own code does (narrowly true — only 4
    lifecycle columns) from what the database actually enforces against
    an adversarial ordinary caller (proven NOT true — the trigger can be
    bypassed by anyone who knows the GUC name). Confirm the correction
    does not overclaim safety anywhere else in the docs, and that the new
    finding is assigned an owner (IC-7) rather than left dangling.
