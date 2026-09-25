# Location QR Fixture Plan (Proposal Only — Nothing Created)

Scope: `warehouse.location` QR only, matching Zone 1 Phase 6's own explicit scope (no container QR — that's Phase 10D, not started, out of bounds here).

## QR-A1 — same-branch scan

- **Location:** `WAW-01` (Strefa Przyjęć, Warszawa) — see `warehouse-fixture-plan.md`.
- **Token/assignment requirement:** a `qr_codes` row (generated via the existing "generate QR" flow already present on the Locations management UI — see `creation-method-matrix.md`) assigned to `WAW-01` via the existing Quick-Assign flow (`/dashboard/qr/assign/[token]`, confirmed live by reading `apps/web/src/app/[locale]/dashboard/qr/assign/[token]/page.tsx`).
- **Printable label requirement:** must be physically printed and tested on the presentation printer/phone ahead of time, per `presentation-demo-setup.md`'s own explicit requirement ("must be physically printed and tested on the presentation printer ahead of time, not generated live").
- **Expected URL:** `/qr/<token>` (or the localized `/pl/qr/<token>`), resolving via `resolvePublicQrToken`.
- **Expected result for Presenter/Admin (USER 1), active in Warszawa:** exact target opens directly — no confirm dialog (Zone 1 Phase 6's Case A).
- **Expected result for Warehouse Worker (USER 2), active in Warszawa:** same — same-branch, opens directly.

## QR-B1 — accessible cross-branch scan (USER 1/USER 2) AND inaccessible cross-branch scan (USER 3)

- **Location:** `KRK-01` (Strefa Przyjęć, Kraków).
- **Token/assignment requirement:** same mechanism as QR-A1 — generated + assigned via the existing app UI, this time for `KRK-01`.
- **Printable label requirement:** same — printed and tested ahead of time. **This single physical label is reused for both the accessible and inaccessible test** — the difference is entirely which account is logged in when it's scanned, not a different QR code. This matches the task's own instruction ("The same Branch-B QR must also be usable with the restricted account for: inaccessible cross-branch scenario").
- **Expected URL:** `/qr/<token>` (same mechanism as QR-A1).
- **Expected result for Presenter/Admin (USER 1) or Warehouse Worker (USER 2), active in Warszawa:** the confirm-then-switch dialog appears (Zone 1 Phase 6 Case B — both accounts have access to Kraków). Confirming switches to Kraków and opens `KRK-01` exactly; cancelling leaves the user in Warszawa with nothing opened.
- **Expected result for Advisor/Restricted (USER 3), active in Warszawa:** per Zone 1 Phase 6's corrected contract (Correction A), NO switch-branch dialog appears at all — the resolver's own `isBranchAccessible()` check fails server-side before any hint is emitted, and the scan instead lands on the QR page's existing "not found"-shaped denial card. This is the exact scenario the Phase 6 correction's own dedicated tests (`public-token-resolver.test.ts`'s "Correction A" tests) already prove at the unit level — Phase 8's job is to confirm the same behavior holds true end-to-end, on the real device, with a real account.

## Creation method

- QR code generation: Category A (existing UI on the Locations management screen — "QR code generation" is listed as an existing Locations feature in `apps/web/CLAUDE.md`'s own module description).
- QR assignment to a location: Category A (existing `/dashboard/qr/assign/[token]` Quick-Assign UI, confirmed live by reading its page component).
- Label printing: HUMAN ACTION REQUIRED (a physical printer, physical paper, physically testing scan-ability at the actual presentation location — none of this is something this agent can do).

No direct SQL needed for QR generation or assignment.
