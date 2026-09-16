# IC-7A — Test Evidence

All results below are from this session's own live runs against
`supabase-target`, via Supabase MCP `execute_sql` (pgTAP) or a real
`psql` binary. Nothing here is inferred or fabricated.

## pgTAP regression (249/249, 0 failures)

| File                                                        | Result    | Notes                                                                                                                                                                          |
| ----------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 097 (movement-line attach, Phase 10)                        | 29/29     | Unaffected by IC-7A. Run via `psql`.                                                                                                                                           |
| 098 (reservation, Phase 10A)                                | 17/17     | Unaffected — dedicated RPC untouched. Re-verified via Supabase MCP after the known, disclosed connection-pooler GUC artifact hit the `psql` attempt (not a regression).        |
| 099 (allocation, Phase 10B)                                 | 20/20     | Unaffected. Run via `psql`.                                                                                                                                                    |
| 100 (container orchestration, Phase 10C)                    | 44/44     | Unaffected — containers never touch the hardened functions. Re-verified via Supabase MCP for the same known connection-pooler reason as 098.                                   |
| 101 (IC-1 movement-engine blind spot)                       | 17/17     | Unaffected. Run via `psql`.                                                                                                                                                    |
| 102 (IC-1 reserved-only + final contract)                   | 14/14     | Unaffected. Run via `psql`.                                                                                                                                                    |
| 103 (IC-2 movement reversal + security-boundary Scenario E) | **35/35** | Scenario E **repositioned** (not rewritten) after this pass's own new check surfaced a stale ordering assumption — see below. Re-run clean after the fix.                      |
| 104 (IC-3 receiving consolidation)                          | 44/44     | Unaffected — IC-3's own primitive/wrappers already had their own actor/permission checks; this pass's hardening of the layer beneath them is transparent to their own callers. |
| **105 (IC-7A security boundary, new)**                      | **29/29** | See below.                                                                                                                                                                     |

**Total: 249/249, 0 failures.**

### The 103 regression this pass's own fix surfaced (live-caught, fixed same session)

Before the reordering fix, running 103 in full failed:

```
psql:.../103_ic2_movement_reversal_test.sql:326: ERROR:  Not authorized
to create inventory movements for this branch
CONTEXT:  PL/pgSQL function inventory_create_draft(...) line 20 at RAISE
```

Diagnosis: Scenario E (added in the prior IC-2 security-correction pass)
ran AFTER Scenario C's own final negative test, which permanently strips
the shared `e2e_user` actor's inventory permission for the rest of that
file's shared transaction. Scenario E's own `inventory_create_draft` call
previously succeeded regardless (no permission check existed yet); now
that it correctly does, the already-stripped actor was rejected.

**Fix**: the ENTIRE Scenario E block was repositioned to run immediately
after Scenario D — mirroring Scenario D's own already-documented "must
run before Scenario C's strip" rationale. Not one assertion, fixture
value, or line of Scenario E's own logic was changed; a diff of the old
vs. new Scenario E text (ignoring position) is identical. Re-run: 35/35.

### 105 — full assertion list (all passing)

**Scenario K — anon negatives, A-H (8 assertions)**: direct calls to
`inventory_create_draft`, `inventory_finalize_posting`, `inventory_
create_and_finalize`, `inventory_receive_stock`, `receive_repair_order_
stock`, `inventory_receive_purchase_order`, `inventory_reverse_movement`,
and `inventory_finalize_posting_internal` as `anon` all rejected `42501`
(EXECUTE itself denied, before any argument is meaningfully evaluated).

**Scenario Q — exploit replay (2 assertions)**: the EXACT pre-fix P0
payload (unauthenticated `anon`, arbitrary org/branch, 777 units) via
`inventory_create_and_finalize` rejected `42501`; zero movement headers
exist for the target org/branch afterward.

**Scenario L — authenticated, zero inventory permission (4 assertions)**:
a real, valid, authenticated actor with literally zero `user_effective_
permissions` rows is rejected `42501` by `inventory_create_draft`,
`inventory_finalize_posting` (against a REAL existing draft, not a
not-found case), and `inventory_create_and_finalize`; the real draft
used for the finalize attempt remains `status='draft'` afterward
(verified as the RLS-bypassing connecting role, since the no-permission
actor itself also lacks `warehouse.inventory.read`).

**Scenario O — actor impersonation (3 assertions)**: a session
authenticated as a permission-less user, supplying a DIFFERENT,
privileged user's real UUID as `p_actor_user_id`, is rejected `28000` by
all three hardened functions — no impersonation via a borrowed UUID.

**Scenario P — NULL actor (2 assertions)**: `p_actor_user_id=NULL`,
even from a genuinely authenticated session, is rejected `28000` by
`inventory_create_draft` and `inventory_finalize_posting` — omitting the
actor is not a bypass.

**Scenario R — system-type guard (1 assertion)**: manually creating a
`900` (system reversal) draft is rejected `42501`.

**Scenario M — every real, legitimate flow still works (9 assertions)**:
generic 101 receipt via `inventory_create_and_finalize` (M1); IC-3
canonical `inventory_receive_stock`, itself calling through the newly-
hardened engine (M2); the real two-step `create_draft` + `finalize_
posting` pattern (`quickReceiptAction`'s own shape) (M3); 401 adjustment
increase (M4); 402 adjustment decrease where stock permits (M5); 801
relocation (M6); `inventory_reverse_movement`, nested through the newly-
hardened `inventory_finalize_posting_internal` (M7); RepairOrder receipt
via `receive_repair_order_stock` (M8); PO receipt via `inventory_
receive_purchase_order` (M9). All 9 succeed for a properly-permissioned
actor.

## Vitest (288/288, 0 failures)

Same targeted Inventory/Zone3/CRM/PO subset as IC-3's own regression,
plus `inventory-count-sessions.service.test.ts` (added this pass
specifically because the caller-graph audit centered on `inventory_
approve_count_session`) — 288/288, 0 failures. No TypeScript changed.

## `pnpm type-check`

0 errors.

## `pnpm lint`

0 errors. 319 pre-existing warnings, all in unrelated `apps/web/temp/`
scaffold prototypes.

## `git diff --check`

Clean — zero trailing-whitespace issues across all 9 files this pass
touched (4 new migrations, 1 new pgTAP file, 1 repositioned pgTAP
scenario, 3 modified docs).

## Production build

Not run — no application TypeScript/runtime surface changed (pure
PL/pgSQL + pgTAP + documentation).
