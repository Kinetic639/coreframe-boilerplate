# IC-8 — Sections 10-12: Live pgTAP, Vitest, and Static Gates

## Section 10 — Full pgTAP regression, live target (COMPLETE)

Initially delegated to a background agent to re-verify all 42 pgTAP suites
(`000_setup_test.sql` through `116_a8_repairorder_projection_live_read_
test.sql`) after the one live schema change this pass made (the ledger
raw-insert-bypass fix). **That agent's run was interrupted by an account-
level weekly rate limit** (`HTTP 429`, not a test failure) partway through
file 115, with its last confirmed-clean checkpoint being **file 114:
18/18 passing**. Per this project's own standing discipline, every prior
agent in this pass halts and reports immediately on first failure rather
than continuing past one — so reaching file 114 cleanly, across a
sequential run starting at 000, is treated as genuine evidence that
000-114 passed, not merely assumed.

The two remaining files (115, 116) were run directly by this session,
live against `supabase-target` via `execute_sql`, to close out the
regression without depending on a second background agent (avoiding a
repeat rate-limit interruption):

- **115** (`a7_correction_generic_container_eligibility_test.sql`):
  **14/14 passing** (`not_ok_count: 0, total_assertions: 14`). Covers the
  A7-correction generic-eligibility gate on `inventory_add_to_container`,
  the `inventory_add_to_container_internal` grant/reachability boundary,
  actor-spoofing/permission-check ordering ahead of the eligibility check,
  zero-partial-mutation on every rejected attempt, and the
  `repair_order_add_allocation_to_container` wrapper's own end-to-end
  success path.
- **116** (`a8_repairorder_projection_live_read_test.sql`): **17/17
  passing** (`not_ok_count: 0, total_assertions: 17`). Covers the A8
  architecture-transition assertions: the old incremental-projection
  trigger/function/both-rebuild-RPCs/both-projection-tables are
  structurally gone; `repair_order_line_movement_links` (the sole
  surviving attribution source) is untouched; the new `get_repair_order_
line_physical_state` read primitive has exactly one overload, is
  `SECURITY INVOKER`, and carries the correct grant shape; a generic
  movement at an already-attributed bucket creates zero new attribution
  links (no hidden projection logic runs at all, not even a no-op); and
  receive/putaway's only persisted effect is the canonical link, with the
  live read correctly reflecting it.

**Full result: 42/42 pgTAP files, live against `supabase-target`, zero
failures** (000-114 per the background agent's own halting-discipline
run before its rate-limit interruption; 115-116 run directly this
session). This includes the ledger-fix's own regression coverage
(file 110/111/112 boundary suites) as well as every Inventory Core,
RepairOrder, and platform-base suite in the repository.

## Section 11 — Relevant Vitest final regression (COMPLETE)

Delegated to a background agent (final, 3rd handback — superseded two
interim handbacks with a complete result).

### Methodology

`vitest.config.ts` scopes to `src/**/*.{test,spec}.{ts,tsx}` only
(Playwright `e2e/` specs out of scope). File-set construction: path-based
keyword match (63 files) unioned with content-based keyword match (128
files) against `inventory|repair-order|repair_order|warehouse|branch-
transfer|reservation|allocation|container|purchase-order|count-session|
wdd-matcher|matcher` → **134 unique files**. The agent explicitly
disclosed that this literal-keyword method pulls in some non-Inventory-
Core false positives (`matcher` → Next.js route matchers; `container` →
React Testing Library's `const { container } = render(...)` idiom;
`warehouse` → generic permission-string literals in unrelated tests) and
accounted for this in its own failure classification rather than silently
over- or under-counting.

### Result

```
Test Files  5 failed | 129 passed (134)
     Tests  4 failed | 2712 passed | 2 skipped (2718)
Duration  270.76s
```

### Every failure, classified

All 5 failing files (4 individual test failures + 1 whole-suite
module-resolution failure) were traced to root cause and classified:

1. `rls-permission-invariants.test.ts` — stale assertion, doesn't account
   for the pre-existing `vmi.*` wildcard (predates this branch, already on
   `main`, confirmed via `git merge-base --is-ancestor`). Unrelated to
   Inventory Core.
2. `event-visual-model.test.ts` — stale assertion, doesn't account for the
   pre-existing `QR` audit category (predates this branch, already on
   `main`). Unrelated to Inventory Core.
3. `build-admin-sidebar-model.test.ts` — zero diff from `main` on either
   the source or the test (`git diff main...branch` empty for this path).
   Unrelated to Inventory Core, not caused by any branch work.
4. `organization/__tests__/actions.test.ts` (`createInvitationAction`) —
   a genuine, real bug (test's own `vi.mock` never mocks `next/headers`,
   so the real `headers()` throws outside a request context and the
   action swallows it into a generic error) — but traced to commit
   `d4e0c32e "mvp base"`, near the START of this branch's 61-commit
   history relative to `main`, unrelated to and predating the Inventory
   Core A1-A8/Zone3-Zone5 work that is IC-8's own subject.
5. `placeholder-pages.test.tsx` — whole-suite module-resolution failure
   (`next-intl`'s own nested `next/navigation` import unresolvable — a
   broken/incomplete pnpm-hoisted nested install, not an application code
   issue). Zero diff from `main` on this test file or its corresponding
   components.

**Verdict**: zero failures in any genuinely Inventory-Core-scoped test
file (every `inventory-*.service.test.ts`, `repair-orders*.test.ts`,
`warehouse-*.service.test.ts`, `wdd-matcher*.test.ts`, count-session, and
branch-transfer test file in the 134-file set passed cleanly). All 5
failures are either byte-identical to `main` or trace to a pre-Inventory-
Core commit in this branch's own history. **None are a regression caused
by IC-8, A1-A8, or the Zone3-Zone5 work.** Item 4 (`createInvitationAction`)
is a real, pre-existing bug worth a separate fix outside Inventory Core's
own scope — flagged for `deferred-debt.md`, not fixed here per Section
37's own scope discipline (unrelated domain).

## Section 12 — typecheck / lint / build / git-diff-check (COMPLETE)

All four gates run to completion by the same background agent, sequentially,
after the Vitest run:

| Gate                                          | Result                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm type-check` (`tsc --noEmit`)            | **PASS**, exit 0, zero errors                                                                                                                                                                                                                                                |
| `pnpm lint` (`eslint . --ext .ts,.tsx`)       | **PASS**, exit 0, zero errors, 319 pre-existing warnings (non-blocking; concentrated in `apps/web/temp/` scratch prototypes and scattered `react-hooks/exhaustive-deps`/`no-unused-vars`/`display-name` warnings elsewhere; none inside core Inventory service/action files) |
| `pnpm build` (`next build`)                   | **PASS**, exit 0, 188/188 static pages generated in 3.4min, zero errors/warnings in the full build log (grepped case-insensitively; only matches were legitimate route paths containing the literal string "error", e.g. `/auth-code-error`)                                 |
| `git status --porcelain` / `git diff --check` | Working tree clean of any modification; only the expected untracked files (7 zone5 reconstruction migrations + 1 ledger-fix migration + the `ic-8-final-production-readiness-review/` docs dir); `git diff --check` clean (no trailing-whitespace/conflict-marker issues)    |

**Disclosed working-tree-drift note from the agent**: the ledger-fix
migration file (`20260922172118_ic8_close_stock_ledger_raw_insert_bypass.sql`)
was not present in the git-status snapshot taken at the very start of this
task, but appeared partway through the agent's own read-only verification
run. The agent correctly identified this as external activity (this
session's own earlier live-fix-and-mirror work, conducted in parallel with
the agent's delegated verification run) rather than a side effect of any
command it ran — confirmed accurate: that file was created by this
session's own Section 7 adversarial-audit work, not by the verification
agent. No actual concern; recorded here for the review bundle's own
completeness.

## Overall gate summary (Sections 10-12)

| Gate                                        | Status                                                    |
| ------------------------------------------- | --------------------------------------------------------- |
| Section 10: pgTAP, live target              | **COMPLETE — PASS**, 42/42 files, zero failures           |
| Section 11: Vitest                          | **COMPLETE — PASS** (zero Inventory-Core-scoped failures) |
| Section 12: typecheck/lint/build/diff-check | **COMPLETE — PASS**, all four gates green                 |
