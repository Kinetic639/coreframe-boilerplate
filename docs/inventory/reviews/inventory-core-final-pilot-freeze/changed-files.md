# Inventory Core — Final Pilot Freeze: Changed Files

## Modified (2)

- `docs/inventory/inventory-core-architecture.md` — added closed
  decision #23 (the reproducibility-waiver-for-pilot product-owner
  decision) to the existing numbered "Closed Decisions" list. No other
  content in this file was touched; decisions #1-22 are byte-for-byte
  unchanged.
- `docs/inventory/inventory-core-progress.md` — updated the "Current
  phase," "Pitch/pilot readiness," and "Last updated" summary fields to
  reflect A1-A8 → IC-8 → this closing pass (previously last updated
  2026-09-17, silently missing that entire record). No change to any
  existing phase's own detailed status text (IC-0 through IC-7 entries
  untouched).

## Deleted (1)

- `apps/public-web/src/app/actions/warehouse/ambra-location-inventory.ts`
  — confirmed dead legacy direct-write action file. Re-verified this
  pass, live, on every axis before deletion:
  - Zero references to any of its 4 exported action names
    (`createLocationContainerAction`, `addItemsToContainerAction`,
    `removeItemFromContainerAction`, `relocateContainerAction`)
    anywhere else in the repository.
  - Zero dynamic/string-path imports of the file.
  - Zero test files reference it.
  - No `locations` route exists in `apps/public-web` at all (only a
    `map/` subfolder) — nothing could have wired it in.
  - `apps/web`'s own `locations/page.tsx` imports a **different**,
    read-only service file (`ambra-location-inventory.service.ts`,
    kept) — confirmed by exact import-line inspection, not just a
    filename-substring match, to rule out a false positive.
  - `apps/public-web`'s own `ambra-location-inventory.service.ts`
    (the read-only service, distinct from the deleted actions file)
    is untouched and remains in place.

  Per this task's own Section 6 instruction: this is dead-code removal
  only. Nothing was migrated, no raw writes were restored, no
  replacement UI was built.

## New (this bundle, 6 files)

- `docs/inventory/reviews/inventory-core-final-pilot-freeze/final-status.md`
- `docs/inventory/reviews/inventory-core-final-pilot-freeze/accepted-technical-debt.md`
- `docs/inventory/reviews/inventory-core-final-pilot-freeze/pitch-handoff.md`
- `docs/inventory/reviews/inventory-core-final-pilot-freeze/changed-files.md` (this file)
- `docs/inventory/reviews/inventory-core-final-pilot-freeze/test-evidence.md`
- `docs/inventory/reviews/inventory-core-final-pilot-freeze/diff.patch`

## Not changed

No migration file, RPC, RLS policy, trigger, or any other live
database object was added, removed, or modified in this pass. No
`apps/web` or `apps/public-web` file other than the one deletion above
was touched. The IC-8 review bundle itself
(`docs/inventory/reviews/ic-8-final-production-readiness-review/`) was
read, not edited — its own historical verdict is preserved unchanged.
