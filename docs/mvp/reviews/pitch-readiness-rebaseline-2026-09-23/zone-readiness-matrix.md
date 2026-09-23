# Zone-by-Zone Readiness Matrix (current re-baseline, 2026-09-23)

Classification key: PITCH BLOCKER / PITCH SHOULD / OPTIONAL / PILOT / DEFER. Independent judgment based on current-code evidence, NOT copied from old zone-doc P0/P1 labels.

## Zone 1 — Auth, Org, Branch Access, Authorization, RLS

**Doc status:** 🟡 PARTIAL (own doc, well-maintained, explicit Gate-to-DEMO-READY checklist).
**Current verdict: HAS CONFIRMED BUGS THAT WOULD BE VISIBLE IN A DEMO.** Strong foundation (real Supabase auth, real org/branch resolution, real RBAC, real invitation lifecycle, sound RLS/server-side re-derivation on every write) — but a from-scratch, code-level trace found **three confirmed, file-and-line-cited bugs**, all sharing one root cause: `SidebarBranchSwitcher.handleBranchSelect` never calls `router.refresh()` or invalidates React Query cache after a successful branch switch — only a Zustand store update runs. This silently breaks: (1) every server-rendered dashboard page (stays frozen on the old branch until reload/navigation), (2) the Matcher session-history list (`wddMatcherKeys.sessions()` has no branch segment in its cache key — exactly the instance the product owner suspected), and (3) all three flagship Warehouse DataView lists (Locations, Inventory Movements, Inventory Balances — static, branch-agnostic `queryKey` literals). Full detail, evidence, and the verified-clean inventory (data isolation itself is sound; this is display/staleness-only, never a wrong-branch write) in `zone1-branch-switch-audit.md`.
**Classification: PITCH BLOCKER.** All three bugs touch screens central to the current master pitch script (Matcher, Warehouse). The fix is small and low-risk — one root-cause fix (add `router.refresh()`/invalidation to the branch switcher) plus two query-key corrections, following an already-proven-correct pattern that exists elsewhere in the same codebase (Warehouse Map page, permission query) — but it must be built and then manually re-verified on the current build before Zone 1 can be called DEMO READY, per the zone's own doc ("Status change rules": static inspection and passing tests alone cannot promote Zone 1).

## Zone 2 — Matcher

**Doc status:** 🟡 PARTIAL, written before the Approve→RepairOrder-materialization flow existed.
**Current verdict:** PARTIALLY STALE — better than documented. A genuinely new, UI-wired "Approve" flow (`extraction-review-view.tsx`, permission-gated, calls `approveAndMaterializeSessionAction`) landed 2026-09-16, connecting Matcher → RepairOrder materialization end-to-end, with real tests (425-line action test file). The doc's specific named gaps remain accurate and unfixed: `persistPreparedSessionAction` still has no transaction wrapping or idempotency guard; `insertLineMatches` is still never called (line-match data never persisted); zero tests on the raw save path.
**Classification:** PITCH SHOULD (public matcher — real pipeline, low risk) / **PITCH BLOCKER-ADJACENT for the persistent matcher IF the current pitch script demos Approve→RepairOrder** (cross-check against `pitch-script-truth-matrix.md` — capability now exists where it didn't when the doc was written) / PILOT (save-path hardening).

## Zone 3 — Repair Orders

**Doc status:** `03-repair-orders.md` says 🔴 NOT IMPLEMENTED — **SUPERSEDED, see `documentation-staleness-audit.md`**. `03-repair-orders-progress.md` (the actual live tracker) is CURRENT.
**Current verdict:** Phases through **10C DONE** — real schema, real `RepairOrdersService`, real UI at `/dashboard/workshop` (list/search/detail/new, built 2026-09-11/12), reservation/allocation/container orchestration all live and tested, Phases 4-6 manually confirmed by the product owner in a real browser. Phase 7's own manual UAT was still outstanding as of the last tracker entry (2026-09-15) — needs fresh confirmation. **Phases 10D (container/location QR), 10E (container relocation), 10F (201/WZ issue): confirmed NOT STARTED.**
**Phase 10D unblock confirmed:** was explicitly "BLOCKED ON INVENTORY CORE CONSOLIDATION" per the tracker's own 2026-09-15 entry; Inventory Core reached its Final Gate (IC-8) and was formally closed (Final Pilot Freeze) — the blocking condition is now satisfied. No existing document yet reflects this status change; corrected in this bundle.
**Classification:** Core RepairOrder CRUD/workflow: PITCH SHOULD (needs fresh Phase 7+ manual UAT, not a build gap) / QR (10D), relocation (10E), issue (10F): see Zones 4, 6, 7 respectively for the actual current-code answer to each (10D→Zone 4's container-QR gap, 10E→Zone 6's container-relocation gap, 10F→Zone 7's blocker).

## Zone 4 — Locations, QR, Labels

**Doc status:** 🟠 EARLY/DISCONNECTED — CURRENT, re-confirmed via fresh `git log --since` on every cited file (zero drift since the doc was written).
**Current verdict:** Location QR (create → assign → print label → phone scan → login redirect → resolve) is a real, complete, reachable path — but its only recorded manual verification is **6+ weeks old (2026-08-06)**, predating the entire RepairOrder/Inventory-Core work, and needs re-verification before pitch. **Part/container QR does not exist** — the QR target registry has exactly 3 types (`warehouse.location`, `helpdesk.ticket`, `planning.task`), no `part`/`container` type, no schema/migration for `qr_codes`/`qr_assignments` in the repo at all (a known, disclosed schema-drift gap).
**Classification:** **PITCH BLOCKER — decision RESOLVED 2026-09-23: BUILD container QR (Phase 10D), not narrow.** The 2026-09-10 product-owner scope-expansion directive settles this — container QR is PITCH REQUIRED, superseding the "narrow the script instead" framing this entry originally carried. Per-piece (individual part) QR remains correctly narrowed/not built — that half of the original decision stands. See `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/current-pitch-scope.md`. Also: PITCH SHOULD (fresh manual re-verification of the location QR path) / PILOT (missing `qr_codes`/`qr_assignments` migrations).

## Zone 5 — Receiving / Putaway

**Doc status:** 🟠 EARLY/DISCONNECTED — PARTIALLY STALE, see `documentation-staleness-audit.md` for the reconciliation.
**Current verdict:** Backend RPCs (`receive_repair_order_stock`, `putaway_repair_order_stock`) exist, are secure and tested (through A8) — **zero UI callers**, confirmed independently via this session's own Inventory Core Final Pilot Freeze caller-audit AND the zone doc's own independent finding (mobile putaway routes `/warehouse/deliveries` and `/warehouse/scanning/delivery` are confirmed placeholder components). Container actions the old doc cites as "disconnected" (`ambra-location-inventory.ts`) were **deleted** during the Inventory Core closing pass as confirmed-dead code — this doesn't change the underlying finding (containers still have zero receiving-time UI wiring), only the specific file reference.
**Classification: PITCH BLOCKER IF the current pitch script demos receiving+mobile-putaway+location-confirmation live** (per the task's own explicit flag — cross-check `pitch-script-truth-matrix.md`). If the script does not demo this live, PILOT-adjacent (needed before real operational use, not before a controlled demo).

## Zone 6 — Search, Relocation, History

**Doc status:** 🟡 PARTIAL — CURRENT, re-confirmed via fresh code inspection (SKU-search bug, history mislabeling bug, `posted_by` omission all independently re-verified present in current code).
**Current verdict:** A real, generic (non-RepairOrder-specific) "where is my stock" search + single-item relocation (movement type 801) UI **is wired and functional** — this answers the task's own cross-reference question affirmatively: yes, a separate generic search/relocate UI exists beyond the RepairOrder-specific, zero-UI-caller `get_repair_order_line_physical_state`. Container relocation (`relocateContainerAction`) remains fully backend-disconnected — zero UI callers, re-confirmed fresh.
**Classification:** PITCH SHOULD (3 small, stage-visible bugs: product search matches name only, not SKU; movement-kind label never renders "transfer" for 801/311 due to a raw-code vs. label string comparison bug; acting user never shown in history) / **PITCH BLOCKER — decision RESOLVED 2026-09-23: BUILD container relocation UI (Phase 10E)**, not narrow — same 2026-09-10 directive as Zone 4's container QR, supersedes the original "PITCH DECISION NEEDED" framing here / PILOT (server-side pagination, concurrency/idempotency hardening).

## Zone 7 — Normal Issue / Legacy Stock

**Doc status:** 🟠 EARLY/DISCONNECTED (base doc) + a separate, later accepted design doc (`07-normal-issue-and-legacy-stock-design.md`, 2026-09-10) that explicitly designs a proper `201`/WZ issue path and explicitly REJECTS using a 402 adjustment as a normal issue.
**Current verdict — CRITICAL FINDING:** the accepted design's own author classifies this capability as **PITCH-required**, and explicitly states none of 402/WU/401 are interchangeable with a real issue document. Despite that, **zero items from the design's own implementation plan have been built, two weeks later**: movement type `201` is not seeded in the authoritative migration tree; the `workshop_post_repair_order_issue` orchestration RPC does not exist; `issueStockAction` is still a hardcoded stub (`"Issue movements not yet available in v1. Use the movements page."`). The only technically-available workaround today is exactly the modeling inconsistency (manual 402 adjustment) the design explicitly argues against.
**Classification: PITCH BLOCKER.** If the pitch script's demo arc includes "issue the part to the customer/workshop" (per the task's own presentation-flow outline, it does — "201/WZ issue" is an explicit step), there is currently **nothing correct to demonstrate** for this step.

## Zone 8 — Tickets (Help Desk)

**Doc status:** 🟡 PARTIAL — CURRENT, zero code drift confirmed via `git log --since` across every cited file.
**Current verdict:** Real, coherent core (atomic RPC-based ticket creation, multi-assignee model, RPC-enforced accept, QR-based scan-to-open). No reject action exists (only accept). Ticket-number search is broken (title-only `.ilike`, same bug pattern as Zone 6's SKU search). `helpdesk_ticket_references` (ticket↔RepairOrder/part linking) exists at the schema/RLS layer with zero call sites — dead infrastructure.
**Classification:** PITCH SHOULD — genuinely demoable as-is with a narrow, honest two-account create/comment/accept/QR-scan scenario; the missing reject action and reference-table wiring are not required for a short demo. PILOT (branch-level RLS is currently org-only despite a `branch_id` column, zero automated tests).

## Zone 9 — Planning

**Doc status:** 🟡 PARTIAL — CURRENT, zero code drift confirmed.
**Current verdict:** Real task CRUD, real calendar aggregation (tasks/tickets/Kanban/native calendars by permission), real Kanban drag-and-drop with persisted position. Zero test coverage for the Kanban service specifically. `AttachmentsPanel` registered as a valid target but never rendered anywhere in Planning's own UI.
**Classification:** OPTIONAL — doc's own P2/"partially ready" framing holds; at most one small, pre-verified example, does not extend the core P0/P1 demo arc. PILOT only if explicitly pulled into pilot scope (undecided).

## Zone 10 — Notifications / Operational Alerts

**Doc status:** 🟠 EARLY/DISCONNECTED — CURRENT, independently re-confirmed via direct file read of the notification bell component (still renders a hardcoded `EXAMPLE_NOTIFICATIONS` array with a literal `TODO: Connect to real notifications system` comment).
**Current verdict:** Zero delivery engine exists for any business event. Preferences screen genuinely saves to DB but has zero downstream effect (nothing reads the saved settings). A new, unrelated `event.service.ts`/`platform_events` audit-trail primitive was added recently for the Matcher-approval flow's own audit log — this is NOT a notification-delivery mechanism and should not be mistaken for progress on this zone.
**Classification: DEFER — explicitly ROADMAP ONLY**, per the zone's own doc, re-confirmed accurate. **Presenter must not click into the notification bell during the demo** — it looks fully functional (real-looking UI) but shows entirely fabricated example data, which would be actively misleading if shown live.

## Zone 11 — Home / Operational Dashboard

**Doc status:** 🔴 NOT IMPLEMENTED — CURRENT, independently re-confirmed via direct read of the live page file (a 15-line static component: one `<PageHeaderV2>` with a generic welcome message, zero data fetching, zero widgets).
**Current verdict — CRITICAL FINDING:** this is the literal first screen every user sees immediately after login. Zero code has touched this file since the zone doc was written (2026-09-08) despite 29 intervening commits and roughly two weeks of engineering effort on adjacent work. Even the doc's own minimal "product clarification" section (which widgets to build) remains entirely unanswered — there is no scope decision yet, let alone an implementation.
**Classification: CORRECTED 2026-09-23 — PITCH SHOULD / HIGH FIRST-IMPRESSION RISK, not a hard blocker.** The current master pitch script (`ambra-skrypt-prezentacji.md`) does not itself require lingering on `/dashboard/start` — the choreography moves directly into the Matcher/RepairOrder flow after login. Still flagged as the single highest first-impression risk across all 11 zones given the imminent "this week" deadline and that both a scope decision AND implementation are still fully outstanding — but not classified a hard blocker unless the rehearsed choreography changes to require it.

## Cross-zone pattern (noted by Agent 3, confirmed consistent with this session's own Inventory Core findings)

A recurring architecture pattern across MULTIPLE zones: a real, secure, tested backend RPC exists with **zero UI callers**. Confirmed instances: `receive_repair_order_stock`/`putaway_repair_order_stock` (Zone 5), `inventory_reverse_movement` (Inventory Core / Zone 3 reversal), `get_repair_order_line_physical_state` (Zone 3), container-relocation (`relocateContainerAction`, Zone 6), container QR (Zone 4, though here the backend itself is also incomplete), `helpdesk_ticket_references` (Zone 8). This is a consistent, deliberate "backend built ahead of UI" pattern across this codebase, not a series of isolated oversights — worth naming as such in the final report rather than treating each instance as independent.
