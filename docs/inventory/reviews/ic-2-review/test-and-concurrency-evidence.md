# IC-2 — Test & Concurrency Evidence

All results below are from this session's own live runs against
`supabase-target`, via Supabase MCP `execute_sql` (pgTAP) or a real `psql`
binary against two independent OS-level connections (concurrency). Nothing
here is inferred or fabricated.

**UPDATED 2026-09-15 for the SECURITY-BOUNDARY CORRECTION PASS** — full
regression re-run this pass (176/176 total), `103_...` extended to 35/35
with a new Scenario E. Everything below reflects the CURRENT, final state;
the original submission's own 169/169 figures are superseded by these.

## pgTAP regression (176/176, 0 failures)

| File                                      | Result    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 097 (movement-line attach, Phase 10)      | 29/29     | Unaffected by IC-2. Re-run this pass via `psql`.                                                                                                                                                                                                                                                                                                                                                                        |
| 098 (reservation, Phase 10A)              | 17/17     | Unaffected — dedicated RPC untouched. Re-run this pass via `psql`.                                                                                                                                                                                                                                                                                                                                                      |
| 099 (allocation, Phase 10B)               | 20/20     | Unaffected — dedicated RPC untouched. Re-run this pass via Supabase MCP `execute_sql` after two `psql`-path attempts both hit the already-known, previously-disclosed connection-pooler artifact (a stale `ambra.inventory_movement_engine` GUC value on a fresh `psql` connection causing a raw fixture-setup INSERT to fail) — not a real regression; the MCP path is unaffected by that artifact and passed cleanly. |
| 100 (container orchestration, Phase 10C)  | 44/44     | Unaffected — containers never touch `inventory_balances`. Re-run this pass via `psql`.                                                                                                                                                                                                                                                                                                                                  |
| 101 (IC-1 movement-engine blind spot)     | 17/17     | Unaffected by IC-2 (re-verified this pass via `psql`).                                                                                                                                                                                                                                                                                                                                                                  |
| 102 (IC-1 reserved-only + final contract) | 14/14     | Unaffected by IC-2 (re-verified this pass via `psql`).                                                                                                                                                                                                                                                                                                                                                                  |
| **103 (IC-2 movement reversal)**          | **35/35** | 28/28 original (Scenarios A-D) + 7 new (Scenario E, T29-T35, security-boundary pass). See below.                                                                                                                                                                                                                                                                                                                        |

### 103 — full assertion list (all passing)

**Scenario A — Receipt (101) reversal:**

- T1: receipt of 10 posts successfully.
- T2: reversal itself posts successfully.
- T3: reversal document number genuinely distinct from the original.
- T4: reversal document number carries the `KOR/` prefix.
- T5: balance exactly restored to pre-receipt value (0).
- T6: original header transitions to `status='reversed'`.
- T7: `original.reversal_movement_id` points to the new reversal.
- T8: `reversal.original_movement_id` points back to the original — bidirectional linkage agrees.
- T9: the reversal movement itself is posted, not reversed.
- T10: audit log persists the exact reason text.
- T11: reversal produces exactly one compensating ledger entry.

**Scenario B — 801 (two-leg) reversal:**

- T12: source (loc_a) restored to exactly 10 (pre-move).
- T13: destination (loc_b) restored to exactly 0 (pre-move).

**Scenario D — IC-1 commitment invariant applies to reversals** (run before
Scenario C deliberately — see the file's own header comment: Scenario C's
final negative test strips permissions for the rest of the transaction):

- T23: reversing a receipt that would strand reserved stock is rejected by the SAME `P0003` invariant.
- T24: balance unchanged after the blocked attempt.
- T25: reservation unchanged after the blocked attempt.
- T26: original remains `posted` (not reversed) after the blocked attempt.
- T27: `original.reversal_movement_id` remains NULL after the blocked attempt.
- T28: no orphan reversal header created (header count unchanged).

**Scenario C — negative paths:**

- T14: draft movement rejected (`P0007`).
- T15: first reversal of a fresh posted movement succeeds.
- T16: reversing an already-reversed original is rejected (`P0007` — see the disclosure below on why not `P0006`).
- T17: reversing a reversal movement itself is rejected (`P0005`).
- T18: NULL reason is rejected (`22023`).
- T19: whitespace-only reason is rejected (`22023`).
- T20: wrong actor (`p_actor_user_id != auth.uid()`) is rejected (`28000`).
- T21: nonexistent movement id is rejected (`P0002`).
- T22: actor lacking `warehouse.inventory.operate` is rejected with the SAME `P0002` as not-found — no existence leak.

**Honest disclosure on T16**: since `status` transitions to `'reversed'`
atomically with `reversal_movement_id` in `inventory_reverse_movement`'s
own only code path that sets either, the "already reversed" rejection is
observed live as `P0007` (the status check, which runs first) rather than
the dedicated `P0006` check. `P0006` remains a genuine, correct defensive
second line of defense (e.g. against any future code path that might set
`reversal_movement_id` without also changing `status`), but is not the
path actually exercised through this RPC today — documented honestly
rather than claimed as the primary mechanism.

**Scenario E — Security-boundary regression (NEW, this pass, T29-T35):**

Proves the P0 explicit-effects fix (see `migration-summary.md` items 8-9)
without weakening any existing scenario.

- T29: ordinary 2-arg `inventory_finalize_posting` (catalog effects) still
  succeeds — the public surface's legitimate behavior is unchanged.
- T30: balance is exactly the drafted quantity (10) — not exploitable via
  the public 2-arg surface, which now has no explicit-effects parameter at
  all.
- T31: an `authenticated` caller's attempt to call the OLD 3-arg
  public-named signature fails with `42883` (function does not exist) —
  the vulnerable overload is genuinely gone, not merely stripped of
  grants.
- T32: a direct call to `inventory_finalize_posting_internal`, using the
  EXACT two-different-real-effect-id payload proven exploitable pre-fix
  (borrowed from movement types `101` and `401`), fails with `42501`
  (permission denied) — the specific live-proven attack path is closed.
- T33: balance remains exactly 10 after both attack attempts — zero
  footprint, no doubling occurred.
- T34/T35: `has_function_privilege` confirms both `anon` (T34) and
  `authenticated` (T35) hold zero `EXECUTE` on `inventory_finalize_
posting_internal`.

All 7 assertions passed together in the test file's own real execution
(`BEGIN...ROLLBACK`, `not_ok_count=0, total_assertions=35` for the whole
file), not merely via separate ad-hoc verification probes.

## Legitimate-movement / regression proof

101 and 801 (the two movement types IC-2's own reversal logic directly
exercises) both still post and reverse correctly via the full pgTAP suite
above. 097-100 and 101-102 (IC-1's own suite) are completely unaffected —
`inventory_finalize_posting`'s new `p_explicit_effects` parameter defaults
to NULL for every pre-existing caller, byte-identical to before.

## Genuine two-independent-connection concurrency proof

**NOT re-run for the security-boundary correction pass — reasoned, not
skipped.** `inventory_reverse_movement`'s own row-locking of the original
header (`SELECT ... FOR UPDATE`, the first action after actor/reason
validation) is byte-identical before and after this pass's fix — the only
change is which downstream function its own `inventory_finalize_posting_
internal` call target reaches (`inventory_finalize_posting_internal`
directly, instead of via the public 2-arg wrapper), not any lock
acquisition, lock order, or lock scope. The proof below, from the original
IC-2 submission, remains valid evidence and was not repeated this pass.

Real `psql` binary, two **separate OS processes/connections** against
`SUPABASE_TARGET_DB_URL` — not one transaction pretending to be concurrent.

**Fixture** (committed, durable): a posted 101 receipt (`PZ/2026/000021`)
against a dedicated branch/location.

**Session A** (launched first): `BEGIN`; `SET LOCAL ROLE authenticated`;
called `inventory_reverse_movement` — succeeded in **691.641ms**
(`KOR/2026/000001`), still holding the original's own row lock; then
`pg_sleep(5)`; then `COMMIT`.

**Session B** (launched ~1.5s after A): `BEGIN`; attempted to reverse the
SAME movement id.

**Timings** (real, from psql's own `\timing on` output and `clock_timestamp()`
markers; bash `date +%s.%N` around each launch):

```
launch_a (bash)                       = 1789488752.85s
launch_b (bash, ~1.52s after launch_a) = 1789488754.37s

Session A (psql \timing):
  a_start                = 2026-09-15 16:12:33.842761+00
  reverse call succeeds  = Time: 691.641 ms   (posts KOR/2026/000001)
  a_after_call_before_sleep = 2026-09-15 16:12:34.560407+00
  pg_sleep(5)             = Time: 5034.856 ms
  a_after_sleep_before_commit = 2026-09-15 16:12:39.620418+00
  COMMIT                  = 2026-09-15 16:12:39.68577+00

Session B (psql \timing):
  b_start                 = 2026-09-15 16:12:34.637137+00
  reverse call            = Time: 5015.336 ms  (BLOCKED, then P0007)
  b_after_call             = 2026-09-15 16:12:39.67666+00
  COMMIT                   = 2026-09-15 16:12:39.725867+00
```

Session B's own `inventory_reverse_movement` call took **5015.336ms** —
genuine lock contention on the original row (`FOR UPDATE`), not
coincidental overlap — and resumed within ~16ms of Session A's actual
COMMIT. Once unblocked, Session B correctly re-read the original under its
own lock, saw `status='reversed'` (set by A's already-committed change),
and was **REJECTED**: `P0007`.

**No deadlock occurred.**

**Final state** (queried after both sessions completed): exactly ONE
reversal header exists for the original (`count(*) WHERE original_
movement_id = <original.id>` = 1); exactly one `'reversed'` audit-log row.
No double-compensation, no orphan reversal from Session B's rejected
attempt.

**Lock-order inspection** (not rewritten, per explicit scope): `inventory_
reverse_movement` locks exactly one row (the original movement header, via
`FOR UPDATE`) before doing any other work; the reversal's own balance-row
locking happens entirely inside `inventory_finalize_posting`'s own
existing, already-proven-safe (IC-1) per-line/per-effect locking. No new
cross-row lock-ordering question arises for a single-original reversal —
this test constructs exactly one contended row (the original header) per
session, matching IC-1's own established methodology and confirming no
change to the architecture's §8 lock-order convention was needed.

## Residual data from the concurrency test (disclosed, not silently cleaned up)

Same immutability protection IC-1's own concurrency test encountered
applies here — `inventory_movement_headers`/`_lines` cannot be deleted
once posted (`inventory_prevent_header_modification`/`_line_modification`,
verified NOT bypassed). Residual:

| Item                         | Count | Detail                                                                            |
| ---------------------------- | ----- | --------------------------------------------------------------------------------- |
| Branch                       | 1     | `ic2-concurrency-branch`                                                          |
| Location                     | 1     | dedicated to this fixture                                                         |
| Movement headers (immutable) | 2     | `PZ/2026/000021` (now `status='reversed'`), `KOR/2026/000001` (`status='posted'`) |
| Balance rows                 | 1     | accurately `on_hand=0`, matching the real posted history                          |
| Audit log rows               | 2     | one `'posted'`, one `'reversed'`                                                  |

All other synthetic scaffolding (every pgTAP scenario's own branches,
RepairOrders, reservations, etc.) ran inside `BEGIN...ROLLBACK` and left
zero residual data — confirmed by direct query after each.

## Vitest

**Original submission**: `repair-orders.service.test.ts`, the broader
inventory sibling suite, wdd-matcher suite, svwms-wdd-matcher boundary
test, `inventory-actions` suite, and the CRM sibling suite — 378/378, 0
failures. IC-2 required zero TypeScript changes (pure PL/pgSQL), so no new
test file was needed on this side.

**Security-boundary correction pass (2026-09-15)**: re-ran the relevant
Inventory/Zone3/CRM subset per this pass's own instructions —
`repair-orders.service.test.ts` (159/159) plus `inventory-actions.test.ts`,
`wdd-matcher-approval-actions.test.ts`, `crm-contacts.service.test.ts`,
`crm-module-migration.test.ts`, `crm-parties.service.test.ts`,
`wdd-matcher-movement-import-candidates.test.ts`,
`wdd-matcher.service.test.ts`, `inventory-cross-branch-transfers.test.ts`,
`inventory-backend-hardening-migration.test.ts` (63/63) — **222/222, 0
failures**. This pass required zero TypeScript changes (the fix is pure
PL/pgSQL), so the full 378-file baseline was not re-run in full; the
targeted subset above is the relevant one for this specific change.

## `pnpm type-check`

0 errors (original submission and security-boundary correction pass,
both re-verified).

## `pnpm lint`

0 errors. 319 pre-existing warnings, all in unrelated `apps/web/temp/`
scaffold prototypes — none touch any file this phase changed (re-verified
this pass, same count).

## `git diff --check`

Clean — zero trailing-whitespace issues in every file this phase changed
or added, including the 2 new migrations and extended `103_...` test file
from the security-boundary correction pass (one real trailing-whitespace
issue was introduced while writing this pass's own progress-doc change-log
entry, caught by this same check, and fixed before packaging).
