# Documentation Staleness Audit

Every "this works" / "this is NOT implemented" claim checked against current code, classified CURRENT / STALE / PARTIALLY STALE / HISTORICAL-BUT-VALID / SUPERSEDED. This file is assembled from direct investigation (Zone 1, Zone 3, Zone 5, Zone 3↔5 integration, Inventory Core) plus Agent 1's full 8-document MVP-level audit and Agent 3's zone-by-zone verification (both appended once returned).

## CRITICAL FINDING: `docs/mvp/zones/03-repair-orders.md` is severely stale — its entire verdict is superseded

**Claim** (line 5): `**Stan obecny:** 🔴 NOT IMPLEMENTED` — "Workshop module to dziś wyłącznie siatka kart 'coming soon' bez jakiejkolwiek warstwy trwałości" (the Workshop module is today only a 'coming soon' card grid with no persistence layer at all), "Nie istnieje żadna trwała encja zlecenia naprawczego" (no persistent RepairOrder entity exists at all).

**Classification: SUPERSEDED.** This entire document — including its full pitch-readiness checklist, which is built on the premise that nothing exists — describes the state of the repository BEFORE 2026-09-11. Direct verification this pass:

- `apps/web/src/app/[locale]/dashboard/workshop/page.tsx`, `[id]/page.tsx`, `new/page.tsx` all exist, are NOT static placeholder cards, and directly import `RepairOrdersService` (confirmed via `grep -rl "RepairOrdersService"`).
- Real components exist: `repair-order-header-editor.tsx`, `repair-order-lines-list.tsx`, `repair-order-line-reservation.tsx`, `repair-order-line-sources.tsx`, `repair-order-provenance.tsx`, `repair-orders-search.tsx`, `new-repair-order-form.tsx` — each with its own test file.
- `git log --diff-filter=A` on these page files shows first-commit dates of **2026-09-11** ("Zone 3: RepairOrder Workshop list/search UI + approval status strip") and **2026-09-12** ("Zone 3 Phase 7: header/advisor/lifecycle/manual creation") — i.e., the real implementation landed IMMEDIATELY after this document's own last dated section ("FINAL CLARIFICATION PASS, 2026-09-09").
- `docs/mvp/zones/03-repair-orders-progress.md` (the actual live execution tracker for this zone, continuously updated per its own header) confirms: schema, domain types, materialization RPC/service, Matcher approval, a real Workshop list/search/detail UI, the full header/advisor/lifecycle/manual-creation flow, RepairOrderLine read model/UI, source-document provenance read model/UI, `attach_repair_order_line_movement`, reservation integration, allocation integration, and container orchestration are **"all live and tested against real data"** — with Phases 4-6 additionally **manually confirmed in a real browser by the product owner**.

**Root cause of the staleness**: `03-repair-orders.md` is architecturally the "Zone 3 architecture/target design" document (its own header says "Source of truth for architecture" in the progress tracker's cross-reference) — it was written BEFORE implementation began and was never updated to reflect the implementation that followed, unlike the progress tracker which was. This is not a case of two documents disagreeing about current reality; it is one document that stopped being about current reality the moment implementation started.

**Disposition recommended**: `03-repair-orders.md` should be re-labeled HISTORICAL / ORIGINAL TARGET DESIGN (its own "Product clarification and final design" section, dated 2026-09-09, remains genuinely valuable as the accepted business-identity/data-model design record — e.g. the `zl_number` vs `order_number` cardinality analysis is real, valid, load-bearing design work that the implementation actually followed). Its own top-of-file "Stan obecny: 🔴 NOT IMPLEMENTED" status line and pitch-readiness checklist must NOT be read as current — a prominent notice is needed. See `documentation-ownership.md`.

## Zone 3 (RepairOrders) — current verdict (direct verification)

**CURRENT** (superseding the above): Phases through **10C are DONE**, with real UI, real backend, extensive live pgTAP (097-101, all passing at time of last progress-tracker entry), real Vitest coverage (`repair-orders.service.test.ts`, 159/159 as of the Zone3↔Zone5 integration entry). Phase 7's own manual UAT was still outstanding as of the last progress-tracker entry (2026-09-15) — **this specific claim needs fresh manual verification, not assumed done**.

**Phase 10D, 10E, 10F: confirmed NOT STARTED** (per `03-05-integration.md`'s own explicit phase mapping: 10D = container/location QR, 10E = container relocation, 10F = 201/WZ issue) — consistent with this session's own Inventory Core Final Pilot Freeze audit, which independently confirmed Phase 10D is still not started as of today.

**Phase 10D is NO LONGER BLOCKED.** The progress tracker's own 2026-09-15 entry explicitly states "Phase 10D is now marked BLOCKED ON INVENTORY CORE CONSOLIDATION... will not resume until the INVENTORY CORE FINAL GATE is reached and accepted." Inventory Core reached and was accepted at its Final Gate (IC-8, `4ea0cb04`) and was then formally closed (Final Pilot Freeze, `0eb58f2e`) — the blocking condition is satisfied. This is a genuine, material status change that no existing document yet reflects.

## Zone 5 (Receiving/Putaway) — current verdict (direct verification)

**PARTIALLY STALE.** `docs/mvp/zones/05-receiving-putaway.md`'s own high-level verdict — "🟠 EARLY/DISCONNECTED... mobile putaway does not exist at all (confirmed placeholders); containers are completely disconnected from receiving (orphan actions with zero UI callers)" — **remains directionally accurate today**: `putaway_repair_order_stock` still has zero UI callers (confirmed independently this session during the Inventory Core Final Pilot Freeze caller-audit). However, specific technical details in this document are now outdated:

- It references `ambra-location-inventory.ts`'s container actions as "disconnected but present" — that file was **deleted** during the Inventory Core Final Pilot Freeze pass (confirmed dead code, zero callers).
- It states "no reversal RPC exists despite the schema already anticipating one" — `inventory_reverse_movement` **has existed since IC-2** (well before this pass) and is fully implemented, secure, and tested — it simply also has zero UI callers, a different and more specific finding than "does not exist."
- It does not mention `receive_repair_order_stock`/`putaway_repair_order_stock` by name — the actual current Zone 5 RPCs (built during the Inventory Core Zone3↔Zone5 integration work) — it appears to predate their construction, reasoning instead about the generic movement-type-101 + Matcher-import UI path.
- Its "Product clarification and final design" section is entirely unresolved ("_No final decisions recorded yet_") — but `03-05-integration.md` (a separate, later document) DID reach and record a product decision on the exact question this section left open: the normal RepairOrder stock lifecycle is 101 receive → 801 putaway → reservation → allocation → container → QR → relocation → issue, sequential stages of one lifecycle.

**Net current verdict, reconciling old doc + new evidence**: the mobile putaway/location-confirmation UI genuinely does not exist today (both the old doc's placeholder-route finding and this session's own zero-UI-callers finding agree, independently, via different evidence). This is a real, current, unresolved gap — not stale in its bottom-line conclusion, only stale in some of its supporting technical detail.

## [Agent 1 and Agent 3 findings appended below once returned]
