# PRE-IC8 P0 — Balance/Settings GUC Authorization Bypass Closure — Context

**Scope**: exactly one P0 correctness/security defect, closed. IC-0
through IC-7 accepted and final, not reopened. The architecture
compression review accepted as audit-only, not reopened. No
simplification items (A1-A8) started. No trigger removed. No
reservation/allocation/transfer/reversal semantics changed.

## Starting state

- Branch: `zone3-zone5-integration-audit`.
- HEAD at start: `fb225295` ("ic6a") — **still not committed**, same
  standing discrepancy as every prior phase this session; flagged
  again, not silently assumed away, per this project's own standing
  discipline.
- IC-7 + its closing pass: confirmed still uncommitted, working tree
  otherwise unchanged from the end of the architecture compression
  review.
- Architecture compression review: confirmed made zero runtime changes
  (its own bundle directory was the only diff from that phase).
- IC-8: confirmed not started. Phase 10D: confirmed not started.
  Simplification items A1-A8: confirmed not started.

## The defect

The architecture compression review's own `rpc-helper-trigger-review.md`
found, and the user confirmed as a P0 requiring closure before IC-8:
`inventory_guard_balance_write()`/`inventory_guard_settings_write()`
trusted the caller-settable session GUC `ambra.inventory_movement_
engine = 'on'` as sufficient authorization for direct writes to
`inventory_balances`/`inventory_settings`, with no validation of what
actually changed. An ordinary `warehouse.inventory.operate`-holding
authenticated user could set the GUC themselves and then raw-write
either table directly — bypassing the canonical engine, ledger, audit
log, and every IC-1 invariant. This directly contradicted the frozen
accepted fact "raw writes are closed."

## What this pass did

1. Verified starting state (above).
2. Read the required source docs in full (`rpc-helper-trigger-review.md`,
   `simplification-plan.md`, `review-context.md` from the architecture
   compression review) and live-inspected the exact bodies of both
   guard triggers plus every function that writes `inventory_balances`/
   `inventory_settings` — did not rely on the prior audit's own summary
   alone.
3. Reproduced both exploits live, freshly, this pass — not relying on
   the prior phase's own trigger-source-only finding. Used a disposable
   `BEGIN...ROLLBACK` transaction with the pre-fix trigger bodies
   temporarily restored (Postgres DDL is transactional; nothing
   persisted, no applied migration was ever edited).
4. Investigated a genuine complication before implementing: found a
   real, live, non-RPC direct writer of `inventory_balances` in a
   sibling app (`apps/public-web`) pointing at the same database — a
   fork of functions IC-6 had already confirmed dead and removed from
   `apps/web`'s own copy. **Asked the user directly** how to treat it
   (close fully, breaking that feature, vs. carve out an exception) —
   **user confirmed: close fully.**
5. Designed and applied a 2-layer fix: structural (table-grant REVOKE,
   the real security boundary) + substance validation (delta-shape
   checks in both triggers, defense-in-depth). See `security-
evidence.md` for the full design and the first 3 self-caught,
   forward-corrected bugs found during hand-authored live testing.
6. Found and fixed 6 pre-existing test files whose own fixture
   conventions were structurally incompatible with the new guard logic
   (see `changed-files.md`) — required by this exact change, not
   broader scope creep, matching this project's own established
   precedent for test-file corrections.
7. Wrote a new, dedicated pgTAP file (`112_...`, 20/20 in isolation)
   covering every adversarial and legitimate scenario the task
   required.
8. Ran the full 097-112 regression, which itself surfaced 2 more
   self-caught regressions the hand-authored probes had missed: a
   balance-guard rejection of genuine no-op UPDATEs (4 fixture files
   affected), and a `SECURITY INVOKER` settings warm-up broken for 2
   legitimate RPCs. Fixed both forward (migrations 7-8) — see
   `security-evidence.md`/`migration-summary.md` for full detail.
9. Re-ran the full 097-112 regression after migrations 7-8. 15 of 16
   files passed clean; `111_...` still failed 3 of 24 assertions
   (I1/I2/J1) — migration 8's own fix was itself incomplete (an
   over-broad `REVOKE ALL ... FROM authenticated` on the new internal
   helper broke the exact SECURITY INVOKER callers it was meant to
   fix). Fixed forward (migration 9) and live-verified end-to-end, not
   just via grant inspection — see `security-evidence.md` self-caught-
   bug #6.
10. Re-ran the full 097-112 regression a third time after migration 9
    — see `test-evidence.md` for the final result, plus relevant
    Vitest, type-check, lint, build, and `git diff --check`.

## Bundle contents

- `review-context.md` (this file)
- `changed-files.md` — full file-by-file change list
- `migration-summary.md` — per-migration detail, including the 2
  self-caught forward corrections
- `security-evidence.md` — the exploit, live reproduction, final
  design, both self-caught bugs, the apps/public-web decision
- `test-evidence.md` — full regression results
- `diff.patch` — the complete diff against baseline

No `concurrency-evidence.md` — this pass changed grants and trigger
substance-validation logic only; no row-lock acquisition point, lock
order, or lock scope was touched (see `test-evidence.md` for the full
reasoning).
