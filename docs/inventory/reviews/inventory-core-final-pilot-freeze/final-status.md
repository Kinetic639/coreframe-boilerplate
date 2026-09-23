# Inventory Core — Final Pilot Freeze: Status

## Final verdict

**INVENTORY CORE FINAL FOR PILOT / ARCHITECTURE FROZEN**
**CLEAN-ROOM REPRODUCIBILITY DEFERRED AS ACCEPTED TECHNICAL DEBT**

| Property                                         | Status                               |
| ------------------------------------------------ | ------------------------------------ |
| Architecture final                               | ✅                                   |
| Live correctness verified                        | ✅                                   |
| Security verified                                | ✅                                   |
| Regression verified                              | ✅                                   |
| Application integration may continue             | ✅                                   |
| Suitable for pilot/pitch work                    | ✅                                   |
| Clean-room reproducibility                       | ⚠ DEFERRED (accepted technical debt) |
| Some scale/performance measurements              | ⚠ DEFERRED                           |
| Commitment/container lifecycle audit enhancement | ⚠ DEFERRED                           |

**This status does NOT mean**: "fully production-reproducible" or
"disaster-recovery ready." Those claims remain false and are not made
anywhere in this bundle. See `accepted-technical-debt.md`.

## What this pass is

An administrative + narrow-cleanup closing pass over IC-8's own final
verdict — NOT a new Inventory phase (no IC-9), NOT a redesign, NOT
Phase 10D, NOT pitch implementation. It:

1. Formally closes Inventory Core for pilot/pitch use.
2. Records the product-owner decision that clean-room reproducibility
   is accepted technical debt, not a pilot/pitch blocker.
3. Preserves the honest distinction that the repository is NOT
   currently clean-room reproducible.
4. Commits the IC-8 security fix and migration reconstruction into
   documentation (already committed at `4ea0cb04`, prior turn).
5. Removes one confirmed dead, dangerous legacy file.
6. Produces this handoff into the AMBRA Pitch Readiness Audit.

## Starting state

- **Branch**: `zone3-zone5-integration-audit`
- **Starting HEAD**: `4ea0cb04` — "Inventory Core IC-8: final production
  readiness gate" (A8 `093cf190` confirmed as an ancestor; IC-8 was
  already fully committed at the start of this pass — zero uncommitted
  IC-8 artifacts were found; all 7 zone5 reconstructions, the ledger
  security fix, and the full IC-8 review bundle were already part of
  `4ea0cb04`).
- **Working tree**: clean at start.
- **Phase 10D**: confirmed NOT started (repo-wide search found only
  planning-doc mentions of a future "Phase 10D," no implementation
  files, no directory, no code).
- **Pitch implementation**: confirmed NOT started (repo-wide search for
  "pitch" found only planning/script documents under `docs/mvp/`, no
  application code).

## The historical IC-8 verdict is UNCHANGED

`docs/inventory/reviews/ic-8-final-production-readiness-review/final-
readiness-assessment.md` still reads **"INVENTORY CORE NOT FINAL —
BLOCKED BY: reproducibility"** and was not edited, retracted, or
softened by this pass. This pass records a **separate, new, later**
product-owner disposition on top of that unchanged finding — see
architecture decision #23 in `inventory-core-architecture.md` and
`accepted-technical-debt.md` — not a revision of IC-8's own historical
finding.

## What changed in this pass

1. **Architecture decision #23** added to `docs/inventory/inventory-
core-architecture.md`'s own "Closed Decisions" list — the reproducibility-
   waiver-for-pilot decision, in the same numbered format as every other
   closed decision in that document.
2. **Progress tracker header** (`docs/inventory/inventory-core-progress.md`)
   updated: Current phase, Pitch/pilot readiness, and Last updated
   fields now reflect A1-A8 → IC-8 → this closing pass, with links to
   each phase's own review bundle (previously last updated 2026-09-17,
   silently missing the entire A1-A8/IC-8 record).
3. **1 narrow live security regression re-run** (3 assertions, 3/3
   pass) confirming the IC-8 ledger-fix policy state is unchanged and
   functioning — see below.
4. **1 file deleted**: `apps/public-web/src/app/actions/warehouse/
ambra-location-inventory.ts` — confirmed dead (zero callers by any
   axis checked) before deletion. See `changed-files.md`.
5. **This bundle** (`docs/inventory/reviews/inventory-core-final-pilot-
freeze/`).

No Inventory Core runtime behavior changed. No RPC, migration, RLS
policy, or trigger was added, removed, or modified in this pass.

## Security fix re-confirmation (narrow, live)

Re-ran against `supabase-target`, `BEGIN...ROLLBACK`:

```
ok 1 - REGRESSION1: canonical posting still works (on_hand=10 after receipt)
ok 2 - REGRESSION2: raw ledger-entries INSERT still denied (42501) post-fix, actual=42501
ok 3 - REGRESSION3: reversal still works end-to-end (on_hand back to 0)
```

Policy state re-confirmed via `pg_policy`: `inventory_stock_ledger_
insert_deny` (`WITH CHECK (false)`) is the sole INSERT policy on
`inventory_stock_ledger_entries` — no stale `inventory_stock_ledger_
insert` policy remains, no stale grant state found.

## Zone5 reconstructed migrations — retained, accurately scoped

The 7 reconstructed historical zone5 migrations (already committed in
`4ea0cb04`) are retained as-is. They are:

- Useful repository-history restoration for the previously-known,
  narrower 7-file gap.
- Cross-validated against accepted live state (function bodies,
  grants, trigger bindings — see `migration-reproducibility.md`).
- **Insufficient to close the larger pre-2026-09-10 migration gap**
  (149 live-applied versions with no local file, 106 without even a
  name match). No further historical reconstruction was attempted in
  this pass — that gap remains exactly as IC-8 left it, now formally
  accepted as deferred technical debt rather than re-investigated.

## Regression evidence for this pass's own changes

See `test-evidence.md` for the full, narrow regression run (public-web
type-check/lint/build/targeted-vitest/diff-check) proving the dead-file
deletion introduced zero regressions.

## Final architecture freeze rule

**From this point forward, Inventory Core architecture must NOT be
modified merely to prepare the presentation.**

Pitch work MAY: add UI, add service callers, expose existing RPCs,
improve loading/error/empty states, prepare demo data, add browser/UAT
coverage, fix concrete bugs.

Pitch work MUST NOT: bypass canonical Inventory RPCs, raw-write
protected Inventory tables, introduce a second stock source of truth,
duplicate movement logic in TypeScript, or reopen A1-A8 architecture
without a concrete, proven blocker.

This rule is also recorded as part of architecture decision #23's own
context in `inventory-core-architecture.md`.

## Safe to proceed to AMBRA PITCH READINESS AUDIT

**Yes.** Inventory Core is FINAL FOR PILOT / ARCHITECTURE FROZEN. See
`pitch-handoff.md` for the exact product-facing gaps the pitch audit
needs to account for.

**This pass STOPS here.** Phase 10D is NOT started. Pitch
implementation is NOT started automatically.
