# Zone 3 Phase 10B Allocation Integration — Changed Files Manifest

Baseline: `HEAD` `6e06330b` ("phase 10a" — Phase 9 + Phase 10 FINAL + Phase 10's write-boundary correction + Phase 10A FINAL + Phase 10A's UI/cache correction, all committed, `git status` clean). Phase 10B's own work (now including this domain-integrity correction pass) remains the _only_ uncommitted change in the working tree, confirmed via `git status --porcelain` immediately before regenerating this bundle.

**This is the SECOND version of this bundle**, regenerated in place against the SAME baseline after a narrow, external-review-driven domain-integrity correction pass (2026-09-14). Diff scope: **only** Phase 10B's own 8 files (unchanged count from the first version — no new files, only existing ones extended). No container, QR, 801/201/WZ, or Zone 5 file was touched, and no migration was created in either version of this phase.

## Correction summary

External review found a load-bearing gap: `allocateForLine`/`listAllocationsForLine`/`listReservationsForLine` verified reservation-HEADER ownership (org/branch/`reference_type`/`reference_id`) but never verified that a reservation LINE's own `variant_id` matches the RepairOrderLine's own authoritative `variant_id`. Confirmed genuine (not theoretical): the generic Warehouse reservation action accepts `reference_type`/`reference_id` as unrestricted client input, entirely independent of each reservation line's own variant — live-proven in the extended `099_...` pgTAP file's new `T-evidence` assertion. Fixed by adding an exact variant-identity check (never inferred by SKU) at the three read/write points; `reserveForLine` and `releaseReservationForLine` were confirmed unaffected and left untouched.

## Modified (8 — unchanged file set from the first version of this bundle)

### `apps/web/src/server/services/repair-orders.service.ts`

**Correction pass**: `allocateForLine` now requires `scope.variantId && reservationLine.variant_id === scope.variantId`, in addition to the pre-existing header-ownership check — on mismatch, returns the same generic `"Reservation line not found"` message, never calls `inventory_create_allocation`, never emits the event. `listAllocationsForLine` now selects `variant_id` on the embedded reservation lines and filters by `variant_id === scope.variantId` _before_ collecting reservation-line ids (so a wrong-variant line's own allocation lines are never even queried). `listReservationsForLine` now filters each reservation's own `inventory_reservation_lines` array to only lines whose `variant_id === scope.variantId`, and omits a reservation entirely if that leaves it with zero lines. `reserveForLine` and `releaseReservationForLine` are **byte-for-byte unchanged** (confirmed: `reserveForLine` already derives the correct variant server-side and was never affected; `releaseReservationForLine` was deliberately left as-is — a reservation attributed to this RepairOrderLine, even a wrong-variant one, may still legitimately need to be released/cancelled as cleanup, and doing so does not itself misattribute stock the way allocation would).

### `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`

6 new tests: 2 in `allocateForLine` (variant-mismatch rejection with no RPC call/no event; no-variant-on-RepairOrderLine rejection), 2 in `listAllocationsForLine` (excludes wrong-variant-only reservation state; keeps a matching-variant allocation visible when a wrong-variant reservation line also exists under the same reference), 2 in `listReservationsForLine` (wrong-variant-only reservation omitted entirely; a reservation with one matching + one wrong-variant line counts only the matching one). Three pre-existing fixture objects were extended with an explicit `variant_id` field they previously omitted (harmless under the old code, required for the new filter) — no existing assertion's expected outcome was changed.

### `apps/web/supabase/tests/099_repair_order_line_allocation_phase10b_test.sql`

**Extended**, not redesigned: `plan(19)` → `plan(20)`. One new assertion, `T-evidence`, appended after T17 (while the actor still holds full permission, before T18's permission-stripping) — demonstrates, via the real generic reservation RPC called exactly the way the generic Warehouse action would, that the schema/RLS genuinely permits a reservation header referencing a real RepairOrderLine while its own line carries a different variant. Explicitly classified in the file's own header and inline comments as "DB demonstrates why the app-layer guard is required," not as a proof of the guard itself (the guard is TypeScript, proven in Vitest). T1-T18 are byte-for-byte unchanged.

### `apps/web/src/server/audit/event-registry.ts`, `apps/web/src/lib/validations/repair-orders.ts`, `apps/web/src/app/actions/workshop/repair-orders.ts`

**Unchanged by this correction pass** — listed here because they remain part of the diff against the `6e06330b` baseline (first introduced in the pre-correction version of this bundle).

### `docs/mvp/zones/03-repair-orders-implementation-plan.md`, `docs/mvp/zones/03-repair-orders-progress.md`

`progress.md`: one new change-log entry appended documenting the finding, the fix, and the live evidence. No other phase's row or change-log entry touched. `implementation-plan.md`: unchanged by this correction pass (no stale claim was found there).

## Cross-validation

- File count: **8** (0 added + 8 modified), matching this manifest's own count and the diff's 8 `diff --git` headers exactly — the same 8 files as the first version of this bundle, all further modified.
- `zone3-phase10b-allocation.diff`: 1903 lines, 152742 bytes (was 1504/127820 pre-correction).
- Baseline: unchanged — `6e06330b`, no reconstruction needed.
- Packaging verification: `git status --porcelain` before staging and after `git restore --staged .` shows the identical set of paths, confirming bundle regeneration did not alter, leave staged, or commit any implementation file.
