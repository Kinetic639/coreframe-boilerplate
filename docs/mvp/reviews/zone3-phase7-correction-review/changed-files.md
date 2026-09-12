# Zone 3 Phase 7 Correction Pass — Changed File Manifest

Scope: **only** the changes introduced by the 2026-09-11 external-review correction pass
(Findings A-F), on top of the already-reviewed Phase 7 implementation. 14 files, all
captured verbatim in `zone3-phase7-corrections.diff`.

Baseline: a git commit reconstructed by applying the ORIGINAL Phase 7 review bundle's diff
(`docs/mvp/reviews/zone3-phase7-review/zone3-phase7.diff`) on top of `HEAD` (`00221132`,
"docs update" — the Phase 4-6 state) in an isolated temporary worktree. That reconstructed
commit is the exact "Phase 7, before this correction pass" state. See `review-context.md`'s
"Baseline reconstruction method" section for the full method and verification.

---

## Finding A — own-advisor lookup RLS bug

### `apps/web/supabase-target/supabase/migrations/20260911183702_repair_orders_own_advisor_contact_id_fn.sql` (NEW)

- **Category**: DB migration
- **Finding(s) addressed**: A
- **What changed**: new `SECURITY DEFINER` function `public.get_own_advisor_contact_id(p_organization_id uuid) RETURNS uuid`.
- **Why it changed**: the application's own `crm_contacts` lookup for "my own linked advisor contact" was itself subject to `crm_contacts`' RLS (requires `crm.contacts.read`), silently failing for a genuine advisor without that separate permission.
- **Security/business behavior affected**: a `manage_own` advisor without `crm.contacts.read` can now correctly resolve their own linked contact id, both for UI ownership determination and for self-assignment at manual creation.
- **Tests**: `094_repair_orders_correction_pass_rls_test.sql` T1/T2. See the dedicated migration section below and `migration-summary.md` for the exact SQL and live-verification detail.

### `apps/web/src/server/services/repair-orders.service.ts` (MODIFIED)

- **Category**: service
- **Findings addressed**: A, E
- **What changed**: `getOwnAdvisorContactId` rewritten to call the new `get_own_advisor_contact_id` RPC instead of a plain `crm_contacts` SELECT; dropped its now-unused `userId` parameter. Also (Finding E, same file) added the shared `normalizeRepairOrderCrudError` helper and applied it to `getOwnAdvisorContactId`, `listAdvisorCandidates`, `createRepairOrder`, `updateHeader`, `assignAdvisor`, `changeStatus` (replacing every ad hoc `error.message`/partial-`23505`-only branch).
- **Why it changed**: the prior plain SELECT was itself subject to `crm_contacts`' own RLS (`crm.contacts.read` required), silently returning nothing for a genuine self-linked advisor who lacked that separate permission — reintroducing, in the application layer, the exact bug already fixed at the RLS layer by `is_own_advisor_contact()`. (Finding E: raw DB errors were leaking to the browser.)
- **Security/business behavior affected**: a `manage_own` advisor without `crm.contacts.read` can now correctly resolve their own contact id (Finding A); every Phase 7 CRUD failure path now returns either a specific, curated, safe message or one generic fallback, with the raw error always logged server-side (Finding E).
- **Tests**: `repair-orders.service.test.ts` (`getOwnAdvisorContactId` describe block rewritten for the RPC contract; new `error normalization (Finding E)` describe block, 7 tests); `094_repair_orders_correction_pass_rls_test.sql` T1/T2.

### `apps/web/src/app/actions/workshop/repair-orders.ts` (MODIFIED)

- **Category**: action
- **Findings addressed**: A
- **What changed**: the one call site inside `createRepairOrderAction` that resolves a `manage_own`-only caller's own advisor contact dropped the now-removed `userId` argument.
- **Why it changed**: mechanical follow-through from the service signature change above.
- **Security/business behavior affected**: none beyond Finding A's fix itself — the pre-check logic (compare submitted `advisor_contact_id` against the caller's own resolved contact id) is unchanged, it now just resolves correctly.
- **Tests**: `apps/web/src/app/actions/workshop/__tests__/repair-orders.test.ts` (unchanged file, still passing — the mock is a generic `vi.fn()` not asserting exact argument count).

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/page.tsx` (MODIFIED)

- **Category**: UI/page/component
- **Findings addressed**: A
- **What changed**: the one call site (`getOwnAdvisorContactId(supabase, orgId, context.user.user.id)` → `getOwnAdvisorContactId(supabase, orgId)`) updated for the new signature.
- **Why it changed**: mechanical follow-through.
- **Security/business behavior affected**: the detail page now correctly determines `manage_own` ownership for a caller without `crm.contacts.read` (previously always computed `ownAdvisorContactId = null` for such a caller, incorrectly hiding their own edit/lifecycle controls).
- **Tests**: covered indirectly by the `RepairOrderHeaderEditor` component tests (which test the component's own prop-driven behavior, not this page's data-fetching).

### `apps/web/src/app/[locale]/dashboard/workshop/new/page.tsx` (MODIFIED)

- **Category**: UI/page/component
- **Findings addressed**: A
- **What changed**: same one-line call-site update as the detail page above.
- **Why it changed**: mechanical follow-through.
- **Security/business behavior affected**: the manual-creation form now correctly offers a `manage_own` caller (without `crm.contacts.read`) the "assign this order to me" checkbox, previously hidden by the same broken lookup.
- **Tests**: covered indirectly by `new-repair-order-form.test.tsx` (prop-driven; the page's own data-fetching is not independently tested, matching this repo's existing convention for server-component pages).

---

## Finding B — archived terminality for manage_all

### `apps/web/supabase-target/supabase/migrations/20260911183705_repair_orders_archived_terminal_for_all.sql` (NEW)

- **Category**: DB migration
- **Findings addressed**: B
- See the dedicated migration section below and `migration-summary.md`.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-header-editor.tsx` (MODIFIED)

- **Category**: UI/page/component
- **Findings addressed**: B
- **What changed**: `canEditHeader`'s computation changed from `canManageAll || (canManageOwn && isOwner && order.status !== "archived")` (archived-check applied only to the `manage_own` branch) to `!isArchived && (canManageAll || (canManageOwn && isOwner))` (archived-check applied unconditionally, before either permission branch).
- **Why it changed**: mirrors the DB-level fix — `manage_all` now sees no Edit control on an archived order either, matching what the RLS-level fix makes true regardless of UI (previously `manage_all` always saw an Edit control, which would have silently no-op'd against the DB post-fix).
- **Security/business behavior affected**: UX only (RLS is the real enforcement either way) — prevents a confusing "nothing happened" save attempt for `manage_all` on an archived order.
- **Tests**: new component test ("correction pass Finding B: hides the Edit control for manage_all too once the order is archived").

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-header-editor.test.tsx` (MODIFIED)

- **Category**: unit/component test
- **Findings addressed**: B
- **What changed**: one new test added (see above), mirroring the pre-existing `manage_own`+archived test.
- **Tests covering it**: itself.

---

## Finding C — field invariants (identity_status/created_by/org/branch)

### `apps/web/supabase-target/supabase/migrations/20260911183709_repair_orders_field_invariants_trigger.sql` (NEW)

- **Category**: DB migration
- **Findings addressed**: C
- See the dedicated migration section below and `migration-summary.md`.

No application code changes were needed for Finding C — the fix is entirely DB-side (a trigger), and the existing `updateHeader`/`createRepairOrder` application-layer `identity_status` derivation logic already agreed with the trigger's own computation (verified, not assumed — see `review-context.md` §C), so nothing in the service/action/UI layer needed to change.

- **Tests**: `094_repair_orders_correction_pass_rls_test.sql` T6/T7/T8 (identity_status derivation, including the overridden-inconsistent-state case and the legitimate-clearing case) / T9 (created_by immutability).

---

## Finding D — cross-organization advisor integrity

### `apps/web/supabase-target/supabase/migrations/20260911183712_repair_orders_advisor_org_scoped_fk.sql` (NEW)

- **Category**: DB migration
- **Findings addressed**: D
- See the dedicated migration section below and `migration-summary.md`.

No application code changes were needed for Finding D either — the fix is a storage-layer composite FK, transparent to every existing service/action call site (a legitimate same-org assignment behaves identically; only the previously-possible cross-org case now fails, and Finding E's error-normalization work — see below — ensures that failure surfaces as a clear message rather than a raw constraint-violation string).

- **Tests**: `094_repair_orders_correction_pass_rls_test.sql` T10 (cross-org rejected, specific SQLSTATE 23503) / T11 (no partial effect) / T12 (same-org still works) / T13 (clearing to NULL still works).

---

## Finding E — CRUD error normalization

Covered by `apps/web/src/server/services/repair-orders.service.ts` (see Finding A's entry above — both findings' fixes landed in the same file in the same pass) and its test file.

### `apps/web/src/server/services/__tests__/repair-orders.service.test.ts` (MODIFIED)

- **Category**: unit/component test (service-level)
- **Findings addressed**: A, E
- **What changed**: `getOwnAdvisorContactId`'s describe block rewritten to mock `.rpc()` instead of the old chainable-select helper (3 tests: RPC call shape, null-contact case, unexpected-error normalization); new `error normalization (Finding E)` describe block (7 tests: generic fallback for an unexpected RLS/constraint error on `createRepairOrder`, specific cross-org-advisor-FK message, specific duplicate-zl*number message still works, a \_different* 23505 constraint is NOT mislabeled as duplicate-zl_number, the same cross-org-FK message on `assignAdvisor`, generic fallback on `changeStatus`, generic fallback on `listAdvisorCandidates`); two PRE-EXISTING tests (predating this pass, in the `createRepairOrder`/`updateHeader` describe blocks) updated to use a realistic Postgres error message including the constraint name (`repair_orders_identity_unique`), since the hardened Finding-E check now requires the constraint name to match, not errcode alone.
- **Why it changed**: regression coverage for Findings A and E, and correcting two now-outdated fixtures that predated the hardened duplicate-zl_number check.
- **Tests covering it**: itself (it IS the test file).

---

## Finding F — manage_own unassigned creation

**No implementation file changed.** Finding F was verified (the current behavior was confirmed exactly as the reviewer described) and recorded as an open product decision with four options — see `review-context.md` §F. Only documentation/tracker files record this finding; no code, test, or migration exists for it, per explicit instruction not to silently decide a product question.

---

## Documentation / tracker

### `docs/mvp/zones/03-repair-orders-implementation-plan.md` (MODIFIED)

- **Category**: documentation/tracker
- **Findings addressed**: A, B, C, D, E, F (summary)
- **What changed**: one new blockquote note appended after the existing Phase 7 verify-first/product-decision notes, summarizing all six findings and their resolutions (11 lines).
- **Why it changed**: records the correction pass at the point in the doc a reviewer would look for Phase 7's status.

### `docs/mvp/zones/03-repair-orders-progress.md` (MODIFIED)

- **Category**: documentation/tracker
- **Findings addressed**: A, B, C, D, E, F (detailed)
- **What changed**: a new "2026-09-11 external-review correction pass" subsection under Phase 7's detailed task list (one `[x]` bullet per finding, each with Evidence/Fix/Tests sub-bullets), a testing-summary paragraph, an updated Phase-7-status closing paragraph, and a matching change-log entry at the end of the file.
- **Why it changed**: this file is the authoritative, continuously-updated execution log for Zone 3 — the detailed per-finding record belongs here, with the implementation plan carrying only the summary (matching this file pair's established convention from every prior corrective-review pass in Zone 3).

---

## pgTAP / DB test

### `apps/web/supabase/tests/094_repair_orders_correction_pass_rls_test.sql` (NEW)

- **Category**: pgTAP/DB test
- **Findings addressed**: A, B, C, D
- **What changed**: 13 new pgTAP assertions, run live as the genuinely-RLS-enforced `authenticated` role, covering all four confirmed findings (T1-T2: Finding A; T3-T5: Finding B; T6-T9: Finding C; T10-T13: Finding D).
- **Why it changed**: this phase's/pass's own testing requirement — DB/RLS regression coverage for every confirmed finding, proving exact row state or exact SQLSTATE, not accepting any exception as proof.
- **Live result**: 13/13 passing, zero residual data after `ROLLBACK`. The pre-existing `093_repair_orders_header_ownership_rls_test.sql` was also re-run unchanged against the corrected policies — 12/12 still passing, confirming no regression from the `repair_orders_update` policy rewrite (Finding B). `093_...` itself is unmodified by this pass and is therefore NOT part of this diff (it was already part of the original Phase 7 bundle).

---

## Migrations — detailed

All four applied via Supabase MCP (`apply_migration`) against `supabase-target`, live-verified, local filenames renamed to their exact live-reported versions. No existing applied migration was edited in place.

| Local filename                                               | Live version     | Local/live parity | DB objects affected                                                                                                                 |
| ------------------------------------------------------------ | ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `20260911183702_repair_orders_own_advisor_contact_id_fn.sql` | `20260911183702` | ✅ verified       | new function `public.get_own_advisor_contact_id(uuid)`                                                                              |
| `20260911183705_repair_orders_archived_terminal_for_all.sql` | `20260911183705` | ✅ verified       | policy `repair_orders_update` (dropped + recreated)                                                                                 |
| `20260911183709_repair_orders_field_invariants_trigger.sql`  | `20260911183709` | ✅ verified       | new function `public.repair_orders_enforce_invariants()`; new trigger `repair_orders_enforce_invariants_trigger` on `repair_orders` |
| `20260911183712_repair_orders_advisor_org_scoped_fk.sql`     | `20260911183712` | ✅ verified       | new constraint `crm_contacts_org_id_unique`; constraint `repair_orders_advisor_contact_id_fkey` (dropped + recreated as composite)  |

Full before/after SQL and behavior for each is in `migration-summary.md`.

---

## Bundle validation

- **Files in `zone3-phase7-corrections.diff`**: 14 (verified: `git diff <baseline> --name-status` over the same pathspec returns exactly these 14 lines, each present as a `diff --git` header in the `.diff` file).
- **Files in this manifest**: 14 — one-to-one match with the diff (verified by direct list comparison; see `review-context.md`'s "Bundle validation" section for the exact comparison command/output).
- **Diff line count**: 1,081 lines.
- **Diff byte size**: 83,262 bytes (~81 KB).
- **Net change**: 818 insertions, 55 deletions across 14 files.
