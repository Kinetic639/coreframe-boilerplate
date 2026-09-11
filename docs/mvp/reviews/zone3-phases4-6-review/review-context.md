# Zone 3 — Repair Orders — Phases 4–6 — Review Context

Companion to `zone3-phases4-6.diff` and `changed-files.md` in this same directory. Source of truth for architecture: `docs/mvp/zones/03-repair-orders.md`. Source of truth for the full phase plan: `docs/mvp/zones/03-repair-orders-implementation-plan.md`. Live status tracker: `docs/mvp/zones/03-repair-orders-progress.md`.

---

# Scope

This bundle covers three implementation phases built in one session, on top of the already-live Zone 3 foundation (Phases 1–3: schema, domain types, the `materialize_repair_orders_from_session` RPC and its service wrapper — all pre-existing, not part of this diff):

- **Phase 4 — Explicit Matcher approval workflow.** A real user-facing `ready_for_review → approved` transition for `wdd_matcher_sessions`, with server-side authorization, an atomic/race-safe state-transition guard, and a UI trigger on the existing Matcher review screen.
- **Phase 5 — Matcher → RepairOrder materialization.** Wires the Phase 4 approval to the pre-existing Phase 3 materialization RPC as one orchestrated user-facing flow (not one user-facing button click as two separate DB transactions internally), with success/failure UX and an explicit, idempotent Retry path.
- **Phase 6 — RepairOrder list and search.** The first real, persisted-data Workshop UI: a branch-scoped list of materialized RepairOrders with search by `zl_number`/VIN/`order_number`, and a minimal detail shell — replacing the previous static "coming soon" placeholder at `/dashboard/workshop`.

No new Supabase schema or RPC was required for any of the three phases — this was re-verified live before writing any code (see `docs/mvp/zones/03-repair-orders-implementation-plan.md`'s Phase 4 task list for the exact re-verification evidence). This bundle is therefore application-code-only: no new migrations.

---

# Accepted workflow

```
ready_for_review
  │  (user clicks Approve on the Matcher review screen)
  ▼
Approve  ──────────────────────────────────────────────────────────
  │  server-side: permission check (wdd_matcher.approve) then an
  │  atomic UPDATE ... WHERE status = 'ready_for_review' (race-safe,
  │  no separate SELECT-then-UPDATE)
  ▼
approved  (approved_by, approved_at set; workshop.matcher_session.approved
           platform event emitted)
  │  same user-facing action, immediately, as a genuinely SEPARATE
  │  service call (not the same DB transaction as the approval write)
  ▼
automatic materialization  ──────────────────────────────────────────
  │  RepairOrdersService.materializeFromSession (Phase 3 RPC, unchanged)
  ├─ success ──► repair_orders / lines / source documents created or
  │              reused; UI shows a repair-order count + "Go to Workshop"
  └─ failure ──► approved state is PRESERVED (never rolled back — it
                 already committed independently); workshop.repair_
                 orders.materialization_failed event emitted; UI shows
                 "Materialization failed" + a working Retry control
                     │
                     ▼
              Retry Materialization (idempotent — calls the exact same
              Phase 3 RPC; a retry against an already-materialized
              session is a harmless no-op, already_materialized: true)
  ▼
Workshop RepairOrder list/search  ────────────────────────────────────
  │  /dashboard/workshop — real, branch-scoped, persisted data only
  │  single search box matches zl_number / VIN / order_number
  ▼
RepairOrder detail shell  ─────────────────────────────────────────────
     /dashboard/workshop/[id] — identifier/context only (zl_number,
     order_number, VIN, status, identity_status, advisor, timestamps);
     deliberately NOT Phase 7's full header/lines/lifecycle view
```

---

# Important architecture decisions

- **Approval permission = `wdd_matcher.approve`.** Re-verified live before writing any code that this permission slug already existed (seeded, present in `packages/contracts/src/permissions.ts` as `PERMISSION_WDD_MATCHER_APPROVE`) but was referenced by zero actions anywhere in the codebase. Reused as-is — no new permission slug was created, and no permission-cache recompile was needed (that gap, discovered in Phase 3, only applies to _newly inserted_ permission rows; this one was already live).
- **Server-side authorization is required, not UI-hiding.** `approveSessionAction`, `retryMaterializationAction`, and `getMaterializationStatusAction` all check the caller's permission snapshot before any DB call. The client-side `can(...)` check that hides the Approve button in the UI is a UX convenience only — it is not the security boundary.
- **The approval state transition must be atomic and race-safe.** `WddMatcherService.approveSession`'s `status = 'ready_for_review'` check is one of the `.eq()` filters on the UPDATE statement itself, not a separate SELECT-then-UPDATE. Two concurrent approval attempts on the same session serialize on Postgres's row lock; only the first to commit finds a matching row, the second gets zero rows updated (returned as `SESSION_NOT_READY`, not a crash or a double-approval).
- **Approval and materialization remain two separate calls, never merged into one DB transaction.** `approveAndMaterializeSessionAction` calls `approveSessionAction` to completion first, then — only if that succeeded — calls `RepairOrdersService.materializeFromSession` as a distinct, independent call. This preserves the Phase 3 RPC's own transaction boundary unchanged and is what makes the "approved survives a materialization failure" guarantee possible (see below).
- **Materialization retry is idempotent.** `retryMaterializationAction` calls the exact same Phase 3 RPC (`materialize_repair_orders_from_session`) used by the initial automatic call — no separate "retry" code path exists. A retry against an already-fully-materialized session is a genuine no-op (`already_materialized: true`, every `created_*` count `0`), proven this session against the live database, not just asserted.
- **The `approved` state survives a materialization failure.** Because approval already committed independently before materialization is even attempted, a materialization failure (RPC error, permission gap, etc.) never rolls back or otherwise disturbs the session's `approved` status. The failure is recorded via a `platform_events` entry and surfaced with a Retry control; nothing about the session's own row is left in an ambiguous state.
- **The RepairOrder list is branch-scoped.** `listForWorkshop`/`getByIdForWorkshop` both apply `.eq('branch_id', branchId)` explicitly when a branch is known — not left to RLS alone, since a caller's permission grants may legitimately span more than one branch. This matches the pre-existing convention already used by `WddMatcherService.listSessions`.
- **Search fields are `zl_number` (primary business identity) / VIN / `order_number` (descriptive only).** A single search box issues one combined `OR (zl_number ILIKE ... OR vin ILIKE ... OR order_number ILIKE ...)` query — `order_number` being included in search does not promote it to an identity field; that distinction is enforced elsewhere (materialization's own conflict/uniqueness logic keys on `zl_number`, never `order_number`).
- **Cross-branch detail access must not leak data.** `getByIdForWorkshop` returns `{success: true, data: null}` — not an error, and not the row — when the id exists but belongs to a different branch than the one requested. This was live-verified this session: a real RepairOrder's id, queried with a different real branch id in the same org, correctly returned `null`.

---

# Known unresolved findings

- **`wdd_matcher_sessions`'s UPDATE RLS policy currently gates on `wdd_matcher.upload`, not `wdd_matcher.approve`.** Discovered and reported during Phase 4, not fixed — out of this phase's scope, and RLS is explicitly the _secondary_ defense layer here (the action's own server-side permission check on `wdd_matcher.approve` is the primary, correctly-enforced gate). This means a caller holding only `wdd_matcher.upload` (and not `.approve`) could theoretically still reach this table via a raw client `.update()` call bypassing the service layer entirely, the same class of gap already flagged (and, in that earlier case, fixed) for `repair_orders` in Phase 2. Flagged here for a future dedicated pass, not silently left undocumented.
- **Genuine browser-based Playwright E2E was not completed, due to an environment/browser failure, not an application defect.** Extensive, documented troubleshooting was attempted (Playwright's own bundled Chrome for Testing failed to launch — missing shared libraries, `install-deps` requires root access this sandbox does not grant; a nix-provided Chromium 126 was obtained and successfully loaded real app pages, confirmed via the Chrome DevTools Protocol's own target list showing correct page titles after navigation — but crashed reproducibly during the screenshot/rasterization step specifically, across multiple fresh instances and font-configuration fixes). Root-caused to this sandbox's software-rendering stack, not to Zone 3 code — the same pages return correct `200` responses with correct content via plain HTTP.
- **Visual review is still outstanding.** No screenshots exist from this session. The actual rendered list/search/detail pages, the approval button/status-strip UI, responsive behavior, and light/dark/theme rendering have not been visually confirmed by any automated or manual process this session.
- **DEMO READY remains NOT PASSED.** Per `docs/mvp/zones/03-repair-orders-progress.md`'s DEMO READY gate: several individual items now have live-data evidence (durable persistence, `zl_number` identity, materialization on real data, branch-scoped search), annotated inline in the tracker, but none are checked off, because the gate's own bar ("required automated tests exist and pass for every item," "representative E2E scenario passes," "manual rehearsal performed and recorded") explicitly requires the browser-level proof this session could not complete.
- **A separate, unrelated infrastructure bug was found and fixed in a later part of the same session** (`apps/web/src/proxy.ts`/`proxy.test.ts`): this cloud dev environment's HTTPS-terminating preview proxy caused `next-intl`'s internal same-origin locale rewrite to fail with `EPROTO`/500 on effectively every page load. This fix is **deliberately excluded from this review bundle** — it is not Zone 3 domain/feature work, and ships separately. See the exclusion note in the final response accompanying this bundle.

---

# Tests performed

**Automated test files (this session's Phase 4–6 work only):**

| Test file                                                                                                                | Passing                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/server/services/__tests__/wdd-matcher.service.test.ts`                                                     | 4/4                                                                                                                                                                                 |
| `apps/web/src/server/services/__tests__/repair-orders.service.test.ts` (14 new, 5 pre-existing Phase 3 tests unaffected) | 19/19                                                                                                                                                                               |
| `apps/web/src/app/actions/tools/__tests__/wdd-matcher-approval-actions.test.ts`                                          | 12/12                                                                                                                                                                               |
| `apps/web/src/components/tools/svwms-wdd-matcher/__tests__/extraction-review-approval.test.tsx`                          | 7/7                                                                                                                                                                                 |
| `apps/web/src/app/[locale]/dashboard/workshop/_components/__tests__/repair-order-status-badge.test.tsx`                  | 4/4                                                                                                                                                                                 |
| `apps/web/src/app/[locale]/dashboard/workshop/_components/__tests__/repair-orders-search.test.tsx`                       | 3/3                                                                                                                                                                                 |
| **Total (this session's new/changed test files)**                                                                        | **49/49** (also reported as 81/81 in the original final report, which additionally counted pre-existing, unmodified sibling test files run in the same batch as a regression check) |

**Typechecks:** `pnpm type-check` (root `tsc --noEmit` for `apps/web`) — clean, zero errors, run repeatedly through the session after each meaningful change.

**Lint:** `pnpm lint` — 0 errors; the pre-existing 319 warnings (all in unrelated/`temp/` files) unchanged; zero warnings in any file touched by this bundle.

**Live integration verification (beyond mocked unit tests):** a dedicated, real E2E test user (`zone3-e2e-test@ambra-internal.test`, `org_owner` role, created via Supabase's admin API — does not touch any real person's account) was created in the same org used throughout Zone 3 testing. A script signed in as that real user with a real (non-service-role) Supabase client and exercised the exact reviewed query/RPC logic end-to-end against the live `supabase-target` project:

1. `approveSession`: `ready_for_review → approved` succeeded, with correct `approved_by`/`approved_at`.
2. Re-approving the same session immediately failed with `SESSION_NOT_READY` (no double approval).
3. `materializeFromSession`: created one real, persisted `repair_orders` row (`zl_number = 'ZL/95001/26/3252/BL'`) plus its source document/line/link rows.
4. A second `materializeFromSession` call for the same session was a genuine no-op (`already_materialized: true`, `created_repair_orders: 0`, `reused_repair_orders: 1`).
5. `getMaterializationStatusForSession` correctly reported `{materialized: true, repairOrderCount: 1}`.
6. `listForWorkshop` (no search) found the real row with correct fields.
7. `listForWorkshop` search by `zl_number` (`"ZL/95001"`), by VIN (`"E2ETESTVIN000001"`), and by `order_number` (`"BLWK/9501"`) each independently found the correct row; a non-matching search (`"no-such-order-xyz"`) correctly returned zero rows.
8. `getByIdForWorkshop` for the real row's id, scoped to its correct branch, returned the row; scoped to a _different_ real branch in the same org, correctly returned `null`.

This proves the actual data/RLS/authorization layer end-to-end against the real database; it does not substitute for the missing browser-level UI verification (see "Known unresolved findings" above).

**Live Supabase verification:** performed via `mcp__supabase-target__execute_sql` (read-only introspection only, e.g. confirming `wdd_matcher.approve`'s existing seeded state and the RLS policy gap noted above) plus the live-integration script itself, which used the real `NEXT_PUBLIC_SUPABASE_URL`/anon key against `supabase-target` — the same live project all of Zone 3's prior phases were built and verified against. No new migrations were applied; none were needed.

---

# Manual review scenario

Steps for a human reviewer (or the product owner) to manually verify this bundle once merged/deployed to an environment with a working browser:

1. Sign in — either with your own account, or with the dedicated test account `zone3-e2e-test@ambra-internal.test` (credentials in `apps/web/.env.local`'s gitignored `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` entries, added this session).
2. Open a Matcher session in `ready_for_review` status (or use the one already live-materialized against real data this session — see below).
3. Click **Approve**.
4. Confirm the approval-status strip appears showing **"Approved"** with a repair-order count and a **"Go to Workshop"** link (not raw JSON, not a generic success toast with no detail).
5. Visit `/dashboard/workshop`.
6. Confirm the real materialized order appears in the list, including the live demo row created this session: `ZL/95001/26/3252/BL`.
7. Use the search box to search by ZL number, then by VIN, then by order number — confirm each independently finds the correct row.
8. Open a row's detail page (`/dashboard/workshop/[id]`) and confirm the identifier/context fields render correctly.
9. Reload the browser at each step and confirm state persists (approved status, materialized order, search results).
10. If time permits: attempt the same flow as a user who holds `wdd_matcher.read` but not `wdd_matcher.approve`, and confirm the Approve button does not appear _and_ a direct action call would be rejected server-side (the permission check is in `approveSessionAction`, independent of the UI).
