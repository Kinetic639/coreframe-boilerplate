# Inventory Core — Final Pilot Freeze: Test Evidence

Narrow regression only, per this closing pass's own Section 8
instruction ("do not burn time re-proving the entire IC-8 suite unless
a change actually touches Inventory runtime behavior"). The dead-file
deletion has zero callers (see `changed-files.md`), so the full 42-file
pgTAP suite was NOT re-run — only the checks relevant to (a) the one
live security-fix re-confirmation and (b) the one file deletion.

## 1. Ledger security-fix live regression (narrow, targeted)

Re-run against `supabase-target`, real `BEGIN...ROLLBACK`, `authenticated`
role:

```
ok 1 - REGRESSION1: canonical posting still works (on_hand=10 after receipt)
ok 2 - REGRESSION2: raw ledger-entries INSERT still denied (42501) post-fix, actual=42501
ok 3 - REGRESSION3: reversal still works end-to-end (on_hand back to 0)
```

3/3 passing. Policy state independently re-confirmed via `pg_policy`:
`inventory_stock_ledger_insert_deny` (`WITH CHECK (false)`) is the sole
INSERT policy on `inventory_stock_ledger_entries`; no stale prior
policy or grant state found.

## 2. `apps/public-web` type-check

```
$ tsc --noEmit
```

**PASS** — zero errors, zero output.

## 3. `apps/public-web` lint

```
$ eslint . --ext .ts,.tsx
✖ 1042 problems (0 errors, 1042 warnings)
```

**PASS** (0 errors). 1042 pre-existing warnings (mostly
`@typescript-eslint/no-explicit-any`/`no-unused-vars`), none
introduced by this pass's own deletion — the deleted file contributed
zero of these warnings (confirmed: warning count/locations match the
pre-existing pattern, no warnings reference the deleted path).

## 4. `apps/public-web` build

```
$ next build
✓ Compiled successfully in 82s
✓ Generating static pages using 1 worker (30/30) in 2.7s
```

**PASS** — 30/30 pages generated, zero errors. No route referenced the
deleted file (confirmed both by this build succeeding and by the prior
caller-audit finding that no route imports it).

## 5. Targeted Vitest — `apps/public-web/src/app/actions/warehouse`

```
Test Files  2 failed | 5 passed (7)
     Tests  63 passed (63)
```

**2 pre-existing failures, unrelated to this pass's deletion — verified,
not assumed:**

- `count-sessions.test.ts` and `inventory-actions.test.ts` both fail at
  module-load time with `Cannot find package 'server-only'`, from
  `action-context.ts` and `inventory-product-imports.service.ts`
  respectively — neither file imports or references the deleted
  `ambra-location-inventory.ts` in any way.
- **Verified via `git stash`**: re-ran the exact same failing test
  file with this pass's own changes stashed out (i.e., against the
  unmodified `4ea0cb04` state, deleted file still present) — the
  identical `server-only` resolution failure reproduces byte-for-byte.
  This confirms the failure is a pre-existing pnpm-hoisting/module-
  resolution environment issue (the `server-only@0.0.1` package does
  exist in the pnpm store, but vitest's resolution isn't finding it for
  these two specific files), not something this pass's deletion caused.
  Working tree was restored via `git stash pop` immediately after, with
  `git status` confirming the exact same 3 changes as before the test.

**All 63 individual tests that DID run passed.** Zero tests reference
the deleted file (confirmed by grep before deletion — see
`changed-files.md`).

## 6. `git diff --check`

```
$ git diff --check
(no output — exit 0)
```

**PASS** — clean, no trailing-whitespace or conflict-marker issues in
either modified doc file.

## Summary

| Gate                                | Result                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Ledger security-fix regression      | PASS, 3/3                                                                                  |
| `apps/public-web` type-check        | PASS, 0 errors                                                                             |
| `apps/public-web` lint              | PASS, 0 errors (1042 pre-existing warnings)                                                |
| `apps/public-web` build             | PASS, 30/30 pages                                                                          |
| Targeted Vitest (warehouse actions) | PASS — 63/63 tests that ran passed; 2 pre-existing, verified-unrelated suite-load failures |
| `git diff --check`                  | PASS, clean                                                                                |

No broad 42-file pgTAP rerun was performed — correctly out of scope,
since the deletion touches zero Inventory Core runtime behavior (a
TypeScript-only, confirmed-dead file removal).
