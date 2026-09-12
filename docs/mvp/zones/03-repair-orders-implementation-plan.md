# Zone 3 — Repair Orders Implementation Plan

- **Zone:** 3
- **Priority:** P0
- **Architecture status:** APPROVED (see `docs/mvp/zones/03-repair-orders.md` → `## Product clarification and final design`)
- **Runtime status:** 🔴 NOT IMPLEMENTED
- **Plan status:** ACTIVE
- **Primary goal:** DEMO READY first, then PILOT READY
- **Last updated:** 2026-09-10

> **Source-of-truth hierarchy.** `docs/mvp/zones/03-repair-orders.md` is the approved product/architecture source of truth and is NOT to be used as a daily log. This file is the execution plan derived from it. `docs/mvp/zones/03-repair-orders-progress.md` is the live status tracker derived from this file. If implementation evidence proves an accepted assumption in the architecture doc impossible or unsafe, the correct response is: **stop that specific task, mark it BLOCKED in the progress tracker, record the evidence, report it** — never silently redesign here or in code.

## Approved architecture summary (do not redesign here)

- **Business identity**: `organization_id + branch_id + zl_number` (partial unique index, `WHERE zl_number IS NOT NULL AND deleted_at IS NULL`). `order_number` (`BLWK/...`) is descriptive/reference only. VIN is searchable, not unique, not identity. Unresolved orders (no parseable `zl_number`) use a staged `identity_status ('resolved'|'unresolved')` model.
- **Eight Zone-3-owned tables** — 7 PITCH, 1 PILOT:
  1. `repair_orders` (PITCH)
  2. `repair_order_lines` (PITCH)
  3. `workshop_source_documents` (PITCH)
  4. `repair_order_source_document_links` (PITCH)
  5. `workshop_source_document_lines` (PITCH)
  6. `repair_order_line_source_links` (PITCH)
  7. `repair_order_line_movement_links` (PITCH)
  8. `repair_order_legacy_records` (PILOT)
- **`workshop_source_documents` natural key**: `UNIQUE (organization_id, branch_id, document_type, external_document_number, source_session_id)`.
- **Source-line provenance**: `workshop_source_document_lines` + `repair_order_line_source_links` (with `quantity_contribution`). Default: `UNIQUE (workshop_source_document_line_id)` — a given source line links to exactly one logical line unless a concrete counter-example forces revisiting this.
- **Movement-line linkage**: `repair_order_line_movement_links` (`repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type ∈ {receipt, issue, reversal}`), `UNIQUE (repair_order_line_id, inventory_movement_line_id, relation_type)`.
- **Quantity semantics** — two explicit derived concepts, never one ambiguous `remaining_quantity`:
  - `outstanding_to_receive = ordered_quantity - received_quantity`
  - `available_for_issue = received_quantity - issued_quantity`
  - `received_quantity`/`issued_quantity` are always `SUM(applied_quantity)` over `repair_order_line_movement_links` filtered by `relation_type`, never stored as editable counters.
- **Advisor model**: `repair_orders.advisor_contact_id → crm_contacts.id`, `crm_contacts.linked_user_id → public.users.id`. Requires a new `UNIQUE (organization_id, linked_user_id) WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL` constraint on `crm_contacts`, and an `employee` value added to `crm_party_roles.role`'s CHECK constraint. Advisor ownership never grants `inventory.*` permissions.
- **Approval gate**: materialization occurs only when `wdd_matcher_sessions.status = 'approved'`. The `approveSession` action/service method and its UI trigger do not exist yet and must be built (Phase 4).
- **Materialization**: one atomic SECURITY DEFINER RPC/transaction creating/linking `repair_orders` + `repair_order_lines` + `workshop_source_documents` + `workshop_source_document_lines` + both link-table sets. Never a sequence of independent application-level Supabase calls.
- **Idempotency**: enforced at the DB level via unique constraints + `ON CONFLICT` + row locks — never via disabled buttons or client state.
- **RLS**: `repair_orders` and `workshop_source_documents` are Tier 1 with direct `organization_id`/`branch_id` columns + FORCE RLS. `repair_order_lines` and `workshop_source_document_lines` are Tier 1 with scope join-derived from parent (no duplicated columns). All link tables are Tier 1, scope join-derived through `repair_order_id`.
- **Matcher provenance**: Matcher evidence is never mutated by later warehouse actions. Post-approval corrections use an explicit reconcile action (append delta, `platform_events` emission), not silent re-materialization or full versioning.
- **Migration workflow**: Phase 0A is a short current-state-capture/safety-boundary step (NOT full historical reconciliation — see 2026-09-10 scope correction below). After it, every Zone 3 DB change follows: local migration SQL → review → apply via Supabase MCP → live verification via MCP → regenerate types if needed → tests → confirm repo/live alignment. Live-only changes are forbidden for all **new** Zone 3 work. Historical migration-tree drift (pre-existing, cross-zone, unrelated to Zone 3) is accepted technical debt, deferred to POST-PITCH / PILOT HARDENING.

> **SCOPE CORRECTION (2026-09-10, product owner directive):** full migration-history reconciliation was originally planned as a hard Phase 0A blocker. This is now explicitly overridden: historical migration-tree drift is accepted technical debt for the pitch, not a pitch blocker. Phase 0A is narrowed to a short current-state-capture step. Full reconciliation moves to Phase 15 (pilot hardening) as a PILOT-READY candidate requirement, to be confirmed necessary at that time. This does **not** relax discipline for new Zone 3 work: every new Zone 3 schema/RLS/RPC change still requires a matching local migration, MCP apply + live verification, regenerated types where applicable, and tests — no live-only changes are permitted going forward, historical debt or not.

> **SCOPE EXPANSION (2026-09-10, product owner directive — supersedes the container-audit's own PILOT classification):** the **full physical container workflow is now PITCH scope**, not PILOT. `RepairOrderLine → Reservation → Allocation → Container → Container QR → Container location → whole-container relocation (801) → WU 201/WZ → exact issue history` is the accepted near-term pitch chain. This overrides the earlier classification in the container audit (`03-repair-orders-container-workflow-audit.md` §24–25), which was based solely on the then-active pitch script omitting this workflow — that script is no longer the sole scope authority for this decision. **Generic movement reversal remains PILOT. Legacy Stock 105/PZ-I remains PILOT.** See the new "Container/Reservation/Allocation architecture decisions" section below (frozen, do not redesign) and Phases 10A–10F for the implementation plan. This expansion does not move Phase 3 or any already-sequenced phase — the approved implementation order (Phase 3 → Matcher approval/materialization integration → RepairOrder read model → Reservation → Allocation → Container → Container QR → 801 relocation → 201/WZ issue → pitch E2E) is unchanged and deliberately sequences container work _after_ the RepairOrder foundation, specifically so this expansion does not force rework of Phases 0A–10.

---

## Container/Reservation/Allocation architecture decisions (FROZEN 2026-09-10 — do not redesign here)

> Source of evidence: `docs/mvp/zones/03-repair-orders-container-workflow-audit.md` (READ-ONLY audit, live-verified findings). The decisions below are product/architecture calls made **on top of** that audit's findings, not re-derivations of it — if a later phase's implementation evidence proves one of these decisions unsafe, the correct response is the same standing rule as everywhere else in this plan: stop, mark BLOCKED, record evidence, report — never silently redesign here or in code.

1. **Container relocation = container-as-movement-carrier.** Whole-container relocation reuses the real 801 bin-to-bin movement (generic inventory engine). `inventory_balances` remains the sole authoritative stock ledger. `inventory_containers.current_location_id` becomes a **synchronized, denormalized physical pointer** kept in lockstep with the 801 movement in the same transaction — never an independently-writable location. A relocation is one atomic operation: create+finalize the 801 movement (source balance −, destination balance +) and update `current_location_id`, in a single RPC transaction. **Rejected explicitly**: updating `current_location_id` alone without moving `inventory_balances`. This resolves the audit's §10 open design question in favor of option 1.
2. **Normal RepairOrder flow is Reservation-before-Allocation.** `RepairOrderLine → Reservation → Allocation → Container` is the standard business path (Phase 10A before 10B). The generic inventory platform's existing direct-allocation-without-reservation capability (`inventory_create_allocation` with `p_reservation_line_id = NULL`) is not removed and may continue to be used elsewhere in the platform, but Zone 3's own service layer only exercises the reservation-first path for RepairOrders.
3. **Container ownership = one container : one RepairOrder (operationally), via the existing generic reference pattern.** `inventory_containers.reference_type = 'repair_order'`, `reference_id = repair_orders.id` — no new FK/column. One RepairOrder may own multiple containers. No user/technician custody model before pitch (explicitly PILOT/later, per the audit's §23/§25).
4. **Container-level QR only, via the existing generic QR registry.** New `target-registry.ts` entry: `type: 'inventory.container'`, `target_id = inventory_containers.id`. No dedicated QR column on `inventory_containers`, no per-part QR identity before pitch (audit §7 recommendation accepted as-is). Reuses the existing compound-permission pattern (`qr.assign`/`qr.read` + a domain permission — see decision 5).
5. **Permissions: reuse existing architecture, no new taxonomy.** Reservation/allocation/container create/release/relocate operations gate on `warehouse.inventory.operate` (same as today's live reservation/allocation RPCs). Normal WU (201) issue gates on `warehouse.inventory.operate`. An issue that exceeds the reserved/allocated quantity (override path) additionally requires `warehouse.inventory.adjust` **plus** an explicit UI confirmation **plus** a mandatory reason string persisted on the movement/audit record. No new permission slugs added before pitch unless a later phase's implementation evidence shows this genuinely cannot enforce the required security (report, don't silently add).
6. **Empty container = explicit status value, kept consistent with contents.** Add `'empty'` to `inventory_containers.status`'s CHECK constraint (additive migration, Phase 10C). The container-orchestration RPC(s) are responsible for keeping `status='empty'` consistent with `SUM(inventory_container_lines.quantity) = 0` — never settable independently by a raw client update (RLS's `_manage` policy alone does not enforce this consistency; the orchestration RPC becomes the intended write path once built — the same posted-header-immutability-by-convention caveat the audit flagged in the generic movement engine applies here too and should be kept in mind, not re-litigated).
7. **Allocation↔Container relation = a dedicated quantity-bearing link entity, not a single FK.** Rejected: inferring the relation from `(variant_id, location_id)` (ambiguous per the audit's §11) and a bare `inventory_allocation_lines.container_id` FK (audit's own straw-man, rejected here because it cannot represent one allocation line split across multiple containers). **Accepted minimal shape** (exact DDL to be finalized in Phase 10C, not here): a new table, e.g. `inventory_allocation_container_links (id, organization_id, branch_id, allocation_line_id FK, container_line_id FK, quantity numeric CHECK > 0, created_by, created_at, deleted_at)`, with: (a) a constraint/trigger ensuring `SUM(quantity) OVER allocation_line_id` never exceeds `allocation_lines.allocated_quantity` (no double allocation); (b) `container_line_id`'s container and the allocation's org/branch match (branch/org integrity); (c) no uniqueness constraint forcing 1:1 (explicitly supports one allocation line → many containers and one container line → many allocation lines); (d) `deleted_at` for soft-release without losing history. This table is a **generic inventory-domain construct**, not one of Zone 3's eight owned tables — Zone 3 depends on it but does not own it, matching the existing reservation/allocation ownership split.

---

## Phase 0A — Current-state capture and safe implementation boundary

> **NARROWED 2026-09-10 per explicit product-owner directive.** This phase previously planned full historical migration-tree reconciliation as a hard blocker. That is now explicitly deferred to Phase 15 (pilot hardening) as accepted technical debt for the pitch. This phase is now a short capture/safety step only — it must not consume substantial implementation time, and does not block starting Phase 1/2 once its narrow acceptance criteria are met.

### Objective

Confirm the authoritative live target project and migration directory, verify the current live state of the specific schema objects Zone 3 depends on or extends, and record existing migration-tree drift as accepted technical debt — establishing the safe boundary for new Zone 3 work without attempting historical cleanup.

### Why it exists

Zone 3 must know it is building against the real live schema (not a stale local assumption) for the handful of objects it directly touches (`crm_contacts`, `crm_party_roles`, `inventory_movement_lines`/`_headers`, `wdd_matcher_*`, RLS helper functions) — but does not need the entire repository's historical migration drift resolved to do that safely.

### Dependencies

None — first task.

### Repository areas affected

- `apps/web/supabase-target/supabase/migrations/` (confirmed authoritative tree for new work).
- New reference doc: `docs/mvp/zones/03-repair-orders-phase0a-baseline.md` (point-in-time capture, not a migration).
- No application code affected.

### Supabase changes

None — read-only capture only.

### Existing infrastructure reused

Supabase MCP (`supabase-target` server): `list_migrations`, `execute_sql` against `information_schema`/`pg_catalog` for the specific dependent objects.

### Implementation tasks

- [x] ✅ Confirm authoritative live target project: `rjeraydumwechpjjzrus` (`ambra-system-target`), matching `apps/web/supabase-target/supabase/config.toml`.
- [x] ✅ Confirm authoritative local migration directory for new work: `apps/web/supabase-target/supabase/migrations/`.
- [x] ✅ Verify live RLS status (enabled/forced) for every table Zone 3 depends on or extends (`crm_contacts`, `crm_party_roles`, `inventory_movement_headers`, `inventory_movement_lines`, `app_attachments`, `platform_events`, `wdd_matcher_sessions`, `wdd_matcher_blocks`, `wdd_matcher_lines`, `wdd_matcher_session_files`) — LIVE VERIFIED, see `03-repair-orders-phase0a-baseline.md` §3.
- [x] ✅ Verify live signatures of RLS/permission helper functions Zone 3 will reuse (`has_branch_permission`, `has_permission`, `can_access_comment_target`, `user_has_effective_permission`) — LIVE VERIFIED, see baseline doc §3.
- [x] ✅ Record historical migration-tree drift as accepted technical debt with a corrected (previously overstated) measurement — see baseline doc §1–2: 73% of live migrations have a name-matching local file in at least one tree; the real gap is 46 live-only names (27%), not the previously carried-forward "only 1/172."
- [x] ✅ Confirm no destructive/live-write reconciliation was attempted or is required to proceed.

### Testing requirements

None (capture-only phase).

### Acceptance criteria

- Authoritative target project confirmed. ✅
- Authoritative migration directory confirmed. ✅
- Live state of every Zone-3-dependent schema object verified via MCP. ✅
- Historical drift recorded as accepted technical debt, not resolved. ✅
- No destructive reconciliation attempted. ✅
- Implementation may proceed to Phase 0B/1/2.

### Scope classification

PITCH prerequisite (short capture step only — closed, not a blocker for subsequent phases).

---

## Phase 0B — Remaining technical closure

### Objective

Close the small number of technical unknowns explicitly flagged as still-open in the architecture doc's "Remaining technical unknowns" section, to the extent they can be closed without new live data from another branch.

### Why it exists

The architecture doc explicitly separates "decided" from "still open" — Phase 0B exists so implementation does not silently pick an answer for an open item.

### Dependencies

Phase 0A (schema investigation tooling/confidence); independent of 0A's outcome otherwise.

### Repository areas affected

`packages/contracts/src/permissions.ts` — **resolved as canonical**: `apps/web/src/lib/constants/permissions.ts` is a 1-line re-export (`export * from "@repo/contracts/permissions"`), confirmed via that file's own content and `packages/contracts/CLAUDE.md`'s package-boundary rules.

### Supabase changes

None directly — this phase is decision-closure, not schema change.

### Existing infrastructure reused

N/A.

### Implementation tasks

- [x] ✅ Already CLOSED by the architecture doc (no action needed, listed for traceability): business-identity field choice (`zl_number`), source-document natural key (`+ source_session_id`), table count (eight).
- [x] ✅ **Remaining-quantity formula**: `available_for_issue = received_quantity - issued_quantity` — DECIDED by the work order's explicit quantity-semantics section, recorded and implemented (`computeRepairOrderLineQuantities` in Phase 1's domain types).
- [x] ✅ **Matcher reconcile flow granularity**: explicit-reconcile-action approach (append delta links + `platform_events`, no full versioning) — DECIDED by the work order's "Matcher provenance rule" section; recorded, implementation deferred to the phase that builds the reconcile action (post-Phase 5).
- [x] ✅ **Source-line 1:1 default**: `UNIQUE (workshop_source_document_line_id)` on `repair_order_line_source_links` — DECIDED and **live** (Phase 2 migration, LIVE VERIFIED via pgTAP test 16 in `090_repair_orders_schema_test.sql`).
- [x] ✅ **Permission key naming**: finalized — `workshop.repair_orders.read` / `.manage_own` / `.manage_all`, canonical location resolved, slugs seeded live (Phase 2 migration).
- [ ] ⬜ **Cross-branch `zl_number`/D-code behavior**: remains genuinely UNRESOLVED (no second-branch data available) — not closeable this phase; recorded as an accepted open risk mitigated by keeping `branch_id` in every relevant composite key.

### Testing requirements

None (decision-closure only).

### Acceptance criteria

Every item in the architecture doc's "Remaining technical unknowns" list is either closed-and-recorded here or explicitly carried forward as an accepted open risk with its mitigation stated. **Met** (5/6 closed, 1 accepted-open by design — cross-branch risk cannot be closed without data that doesn't exist).

### Scope classification

PITCH prerequisite.

---

## Phase 1 — Domain contracts and shared types

### Objective

Define the TypeScript domain types/contracts for all eight Zone 3 tables and their relationships, before any schema or service code is written.

### Why it exists

Establishes a single, reviewable definition of the domain shape (matching the approved eight-table model) that schema (Phase 2) and services (Phase 3+) are built against, catching model drift before it reaches SQL.

### Dependencies

Phase 0A, Phase 0B (permission-slug location decision).

### Repository areas affected

- `apps/web/src/lib/types/repair-orders.ts` — **resolved**: this is the convention (mirrors `crm-contacts.service.ts`'s hand-written `CrmContactListRow`/`CrmContactDetail` pattern; `packages/contracts` is reserved for cross-cutting permission/module/entitlement constants only, confirmed via its own CLAUDE.md).
- `apps/web/src/lib/types/__tests__/repair-orders.test.ts` — unit tests.
- `packages/contracts/src/permissions.ts` — Zone 3 permission slug additions.

### Supabase changes

None (types only; the domain layer is written against the schema Phase 2 also implements this session, but this file's own changes are types-only).

### Existing infrastructure reused

Existing contract/type conventions from other domains (`crm-contacts.service.ts`'s hand-written interface pattern), generated-types workflow via `mcp__supabase-target__generate_typescript_types` (used as the persistence-shape source of truth, not leaked directly into application code).

### Implementation tasks

- [x] ✅ Define `RepairOrder` type: id, organization_id, branch_id, zl_number, order_number, identity_status, advisor_contact_id, status, vehicle fields (incl. VIN), timestamps.
- [x] ✅ Define `RepairOrderLine` type: id, repair_order_id, product/variant reference, ordered_quantity, unit, status, timestamps.
- [x] ✅ Define `WorkshopSourceDocument` type: id, organization_id, branch_id, document_type, external_document_number, source_session_id, official_warehouse_code, block_id, created_at.
- [x] ✅ Define `RepairOrderSourceDocumentLink` type.
- [x] ✅ Define `WorkshopSourceDocumentLine` type.
- [x] ✅ Define `RepairOrderLineSourceLink` type (incl. `quantity_contribution`).
- [x] ✅ Define `RepairOrderLineMovementLink` type (incl. `relation_type`, `applied_quantity`).
- [x] ✅ Define `RepairOrderLegacyRecord` type (PILOT scope, stub only in Phase 1).
- [x] ✅ Define derived read-model types: `RepairOrderLineQuantities` + the pure `computeRepairOrderLineQuantities()` derivation function — explicitly documented as derived, never persisted as a mutable shape.
- [x] ✅ Define `document_type`, `relation_type`, `identity_status`, `RepairOrderStatus`, `RepairOrderLineStatus` as string literal unions matching the live DB CHECK constraints, plus a type guard per union.
- [x] ✅ Add/reconcile Zone 3 permission slugs (`workshop.repair_orders.read`, `.manage_own`, `.manage_all`) in `packages/contracts/src/permissions.ts` — LIVE VERIFIED seeded (Phase 2 migration).
- [x] ✅ Unit tests for type-guard/discriminated-union helpers, plus `canTransitionRepairOrderStatus` and `computeRepairOrderLineQuantities` (including the architecture doc's exact worked example) — **16/16 passing**.

### Testing requirements

- **Unit**: type-guard/discriminated-union helpers, status-transition rule, quantity-derivation worked example. **Met** — `apps/web/src/lib/types/__tests__/repair-orders.test.ts`, 16/16 passing; `tsc --noEmit` clean in `apps/web`.

### Acceptance criteria

All eight tables and both derived read-model concepts have a reviewed TypeScript type; permission slugs are registered in exactly one canonical location; no schema exists yet (types-only phase). **Met.**

### Scope classification

PITCH prerequisite (7 PITCH tables' types), PILOT (`RepairOrderLegacyRecord` stub only).

---

## Phase 2 — Database schema, constraints, indexes and RLS

> **STATUS CORRECTION (2026-09-10):** schema creation and live verification via MCP were previously marked as making this phase fully DONE. That was wrong — this phase's own acceptance criteria require pgTAP/RLS tests to pass, and those had not been written. Direct MCP inspection is not a substitute for the automated tests this phase's plan defines. Corrected status: 🔵 IN PROGRESS until the tests below are written and passing.

### Objective

Create the actual migration(s) for the seven PITCH tables (deferring `repair_order_legacy_records` to Phase 14/PILOT), their constraints/indexes, and RLS policies — following the Phase 0A-established migration workflow.

### Why it exists

This is the schema realization of the approved domain model; nothing in Zone 3 can function without it.

### Dependencies

Phase 0A (must be complete — no exceptions), Phase 1 (types reviewed).

### Repository areas affected

- New migration file(s) in `apps/web/supabase-target/supabase/migrations/` (the Phase-0A-confirmed authoritative tree), e.g. `<timestamp>_repair_orders_core_schema.sql` — exact filename TO VERIFY DURING PHASE (follow repo's existing timestamp-prefix convention, confirmed live via `list_migrations`).
- Regenerated types file (wherever `mcp__supabase-target__generate_typescript_types` output is checked in — TO VERIFY DURING PHASE, likely `apps/web/src/lib/database.types.ts` or similar).
- pgTAP test files under `apps/web/supabase/tests/` (existing convention, TO VERIFY DURING PHASE whether target tree has its own tests directory).

### Supabase changes

- **Tables**: `repair_orders`, `repair_order_lines`, `workshop_source_documents`, `repair_order_source_document_links`, `workshop_source_document_lines`, `repair_order_line_source_links`, `repair_order_line_movement_links`.
- **Constraints**:
  - `repair_orders`: partial unique `(organization_id, branch_id, zl_number) WHERE zl_number IS NOT NULL AND deleted_at IS NULL`; CHECK on `identity_status IN ('resolved','unresolved')`; CHECK on `status` — **corrected 2026-09-10 to `IN ('open','closed','archived')`** (was `('open','closed')` in the originally-applied migration; see forward migration below — the applied migration is never edited in place once live, corrections are additive forward migrations).
  - `workshop_source_documents`: unique `(organization_id, branch_id, document_type, external_document_number, source_session_id)`; CHECK on `document_type` literal union.
  - `repair_order_source_document_links`: composite PK `(repair_order_id, workshop_source_document_id)`.
  - `repair_order_line_source_links`: unique `(workshop_source_document_line_id)`.
  - `repair_order_line_movement_links`: unique `(repair_order_line_id, inventory_movement_line_id, relation_type)`; CHECK on `relation_type` literal union.
  - `crm_contacts`: new `UNIQUE (organization_id, linked_user_id) WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL` (additive, per architecture doc Correction 2).
  - `crm_party_roles`: CHECK constraint replacement adding `employee` to the allowed `role` values (additive, per architecture doc Correction 2).
- **Indexes**: supporting indexes for FK columns and common lookups (`zl_number`, `order_number` for search, `vin` for search) — exact index list TO VERIFY DURING PHASE against real query patterns from Phase 6.
- **RLS**: FORCE RLS on `repair_orders` and `workshop_source_documents` (Tier 1, direct columns, `has_branch_permission`); join-derived-scope RLS on `repair_order_lines`, `workshop_source_document_lines`, and all three link tables (Tier 1, scope via parent FK, per architecture doc's Authorization and ownership model section).
- **Functions/RPCs**: none yet in this phase (materialization RPC is Phase 3).
- **Storage**: none.
- **Generated types**: regenerate after migration applied and verified live.

### Existing infrastructure reused

- `has_branch_permission(org_id, branch_id, permission)` RLS helper (REPO/LIVE VERIFIED correct branch-aware helper — do not use the org-only `has_permission`).
- Existing RLS/FORCE RLS patterns from Tier 1 tables like `inventory_movement_headers`.

### Implementation tasks

- [x] ✅ Write migration: seven PITCH tables with all columns per Phase 1 types.
- [x] ✅ Write migration: all constraints listed above (status CHECK now corrected to include `archived` via forward migration — see below).
- [x] ✅ Write migration: all indexes.
- [x] ✅ Write migration: RLS enable + FORCE RLS + policies per table per the Tier 1 direct-vs-join-derived split.
- [x] ✅ Write migration: `crm_contacts` unique constraint addition.
- [x] ✅ Write migration: `crm_party_roles` role CHECK constraint replacement (adds `employee`).
- [x] ✅ Apply migration via Supabase MCP against `supabase-target`.
- [x] ✅ Live-verify via MCP: `information_schema.columns`, `pg_constraint`, `pg_policies` for every new/altered table match the migration exactly.
- [x] ✅ Regenerate TypeScript types via MCP and check in the diff.
- [x] ✅ Write migration: `status` CHECK constraint correction (forward migration `20260910071755_repair_orders_status_archived.sql`, adds `archived` — original migration not edited in place since already applied live).
- [x] ✅ Write pgTAP tests: constraint enforcement (unique violations, CHECK violations), RLS isolation (cross-org/cross-branch denial), FORCE RLS actually forces. `pgtap` extension installed live via forward migration (was not previously installed on `supabase-target`); tests executed live via MCP — see results recorded in the progress tracker.
- [x] ✅ Confirm local migration file matches what MCP applied (byte-level or logical equivalence) — no live-only drift introduced by this phase itself.

### Testing requirements

- **DB/RLS**: constraint violation tests (duplicate `zl_number` within org+branch rejected, duplicate source-document natural key rejected, duplicate link rejected); cross-org/cross-branch row invisibility for every new table; FORCE RLS verification. **Written and executed** — `apps/web/supabase/tests/090_repair_orders_schema_test.sql`, results in progress tracker.

### Acceptance criteria

All seven PITCH tables exist live, verified via MCP; every constraint/index/RLS policy in this phase's list is live-verified; local migration file(s) reproduce live state exactly; pgTAP/RLS tests pass. **Met — see progress tracker for the executed test run.**

### Scope classification

PITCH.

---

## Phase 3 — Transactional domain/materialization RPC/service layer ✅ DONE (2026-09-10)

### Objective

Build the single atomic transaction boundary (SECURITY DEFINER RPC) that creates/links a RepairOrder and all its child rows from an approved Matcher session in one all-or-nothing operation, plus the service-layer wrapper around it.

### Why it exists

The architecture doc is explicit: "Application-level multiple Supabase calls without one DB transaction are NOT acceptable for final materialization." This phase builds that boundary before anything calls it.

### Dependencies

Phase 2 (schema/RLS live) — met.

### Matcher → RepairOrder mapping actually discovered (live-verified before writing the RPC, not guessed)

- **`zl_number`** source: `wdd_matcher_blocks.metadata->>'zl_number'`, present on `brand_order`/`direct_order` blocks.
- **`order_number`** source: `wdd_matcher_blocks.metadata->>'order_number'` — descriptive only, per the approved identity model.
- **VIN**: `wdd_matcher_blocks.metadata->>'vin'`.
- **Which lines become logical RepairOrderLines**: `wdd_matcher_lines` rows under a block carrying a resolved `zl_number`.
- **One session → multiple RepairOrders**: grouping session blocks by distinct `zl_number` — LIVE VERIFIED and pgTAP-proven (test: two blocks, two distinct `zl_number`s, two `repair_orders` created).
- **Source lines → logical lines**: within one `repair_order_id`, source lines sharing a `product_code` consolidate into one logical line (quantity summed); lines with no `product_code` always get their own line (no safe matching key). This is a documented reconciliation _choice_, not a duplicate-prevention mechanism — idempotency itself comes from `workshop_source_document_lines`' own unique index (see below).
- **Which fields may legitimately be null**: `quantity` (nullable on `wdd_matcher_lines`) — LIVE VERIFIED. Handled by preserving the raw source line (quantity coalesced to 0) but skipping the logical-line contribution (`quantity_contribution` requires `> 0`), never erroring.
- **SCOPE LIMIT, not silently skipped**: `wdd_reconciliation` (WDD) blocks are **not linked to RepairOrders by this RPC**. LIVE VERIFIED before writing this migration: 100% of `wdd_reconciliation` blocks (3,389/3,389) carry neither `zl_number` nor VIN in their metadata — there is no safe, non-guessed field-level rule to attribute a WDD document to a specific RepairOrder. This is reported, not invented around; a future migration adds WDD-document linking once a product/data decision resolves that mapping (candidate: VIN cross-referencing if a reliable source of VIN-per-WDD-document is ever found, or a positional/session-structural rule — neither is currently evidenced).

### Repository areas affected

- Migrations (all applied live, local files renamed to match live-reported versions — see below).
- `apps/web/src/server/services/repair-orders.service.ts` — new (matches the flat `*.service.ts` convention, confirmed against `helpdesk-tickets.service.ts`'s `acceptTicket` RPC-wrapper pattern).
- `apps/web/src/server/audit/event-registry.ts` — new `workshop.repair_orders.materialized` entry.
- `apps/web/supabase/tests/091_repair_orders_materialization_rpc_test.sql` — new pgTAP suite.

### Supabase changes (all live-verified)

- **Function**: `materialize_repair_orders_from_session(p_actor_user_id uuid, p_session_id uuid) RETURNS jsonb`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`. `EXECUTE` revoked from `PUBLIC`/`anon`, granted only to `authenticated` (LIVE VERIFIED via `has_function_privilege`).
- **Corrected constraint**: `workshop_source_document_lines.quantity` CHECK relaxed from `> 0` to `>= 0` — discovered via real testing (a null-quantity Matcher line legitimately exists and must not be lost from raw provenance).
- **New unique index**: `workshop_source_document_lines_matcher_line_unique` on `(workshop_source_document_id, wdd_matcher_line_id) WHERE wdd_matcher_line_id IS NOT NULL` — discovered missing during RPC design; required for real idempotency (not previously in Phase 2's constraint list).
- **Operational discovery + fix**: `public.user_effective_permissions` (the compiled permission cache `has_branch_permission` reads) is refreshed only by triggers on `role_permissions`/`user_role_assignments`/etc. — **not** by inserts into the `public.permissions` catalog. Phase 2's migration seeded the 3 new `workshop.repair_orders.*` permissions but, correctly following the "wildcard-covered roles need no explicit grant" convention, never touched `role_permissions` — so no recompile trigger fired, and every pre-existing `workshop.*`-holding user had a stale cache lacking the new slugs. Fixed via a one-time backfill migration calling the existing `compile_user_permissions()` for every affected `(user_id, organization_id)`. LIVE VERIFIED before/after with a real org_owner user.

### Existing infrastructure reused, and one pattern deliberately NOT reused

- `has_branch_permission` (REPO/LIVE VERIFIED, `auth.uid()`-based, correct).
- `platform_events` / `eventService.emit()` — **Mode A** (application-side, best-effort, per `event.service.ts`'s own documented header) is used, called from the service layer _after_ the RPC commits, not from inside the RPC. **Resolved, not guessed**: `event.service.ts`'s own header explicitly names Mode A as the only implemented path today; Mode B (atomic DB-side emission) is documented as an accepted future pattern requiring pre-validation machinery this codebase has not built yet. Using Mode A here preserves the existing architecture instead of forking a parallel one; the trade-off (an emit failure never rolls back or blocks the already-committed domain write) is the same documented trade-off every other Mode A caller in the repo accepts.
- **Deliberately NOT reused**: the `p_actor_user_id`-trusted-blindly pattern found live in `inventory_finalize_posting` (no permission check at all inside the function body, and EXECUTE open to `anon`/`authenticated` by default). LIVE VERIFIED this is a real, pre-existing gap in that function — out of scope to fix here, but explicitly not copied into the new RPC. This RPC instead verifies `p_actor_user_id = auth.uid()`, checks `has_branch_permission` itself, and has EXECUTE revoked from `anon`.

### Implementation tasks

- [x] ✅ Write migration for the materialization RPC (`20260910075814_repair_orders_materialization_rpc.sql`).
- [x] ✅ Idempotency verified: pgTAP proves a second call for the same session is a pure no-op (all `created_*` = 0, `already_materialized = true`), and a second _session_ referencing the same `zl_number` correctly reuses the RepairOrder while creating a new source document.
- [x] ✅ `SELECT ... FOR UPDATE` on `wdd_matcher_sessions` is the first statement after actor/parameter validation.
- [x] ✅ Non-`approved` sessions rejected with a clear error — pgTAP-verified.
- [x] ✅ Service wrapper `repair-orders.service.ts` — `RepairOrdersService.materializeFromSession()`, typed `MaterializationResult`, no raw generated `Row` types leaked to callers.
- [x] ✅ Unit tests for the service wrapper — `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`, 5/5 passing (RPC param mapping, jsonb→domain-type mapping, event emission on success, error path with no emission, Mode-A best-effort trade-off when emission itself fails, idempotent-replay result mapping).
- [x] ✅ pgTAP live-DB tests for the RPC: happy path (multi-order), idempotent replay, non-approved rejection, actor-mismatch rejection, multi-document-per-order, cross-order SKU independence, atomicity-on-forced-failure, **authorization denial**. **17/17 passing** (16 from the original pass + 1 authorization-denial test added 2026-09-10, all 17 re-verified live in the same session via a single aggregated-assertion query against `supabase-target`).
- [x] ✅ Applied via MCP; local migration files renamed to match live-reported versions in every case (`20260910075359`, `20260910075814`, `20260910080123`, `20260910080512`, plus the pre-existing `20260910074716`).
- [x] ✅ **Authorization-denial test added** (2026-09-10): an authenticated actor (`p_actor_user_id = auth.uid()`, no identity spoof) holding zero `workshop.repair_orders.*` permission grants in the session's org/branch is rejected by the RPC's own `has_branch_permission` check (not merely by RLS on the underlying tables), and no RepairOrder is created — closes the gap between this RPC's real authorization check and the test suite's prior coverage of it (only the actor-_identity_ spoofing guard was previously tested, not the actor-_permission_ gate).

### Testing requirements

- **Service/integration**: RPC wrapper happy path, error mapping — **met**, `repair-orders.service.test.ts`, 5/5 passing.
- **DB**: idempotency (duplicate call) — pgTAP-verified. Transaction rollback on a forced post-call failure — pgTAP-verified via a real materialization call followed by a forced exception inside a nested PL/pgSQL block (proves no autonomous/out-of-band write path escapes rollback). A true _mid-loop internal constraint-violation_ rollback proof was attempted and not achieved safely without contriving an unrealistic fixture (every natural failure mode the RPC can hit is handled gracefully by design, e.g. null/negative quantities) — reported honestly rather than claimed. **Authorization denial** (both actor-identity spoofing and actor-permission-absence) — pgTAP-verified, both paths.
- **Concurrency**: sequential idempotent replay (zero duplicates on repeat calls) and the presence of the `FOR UPDATE` row lock in the function body are both verified — this is the "realistic concurrency / duplicate invocation behavior" bar. **Genuine two-connection simultaneous execution is NOT tested here** — it cannot be expressed in a single pgTAP script/MCP call — and remains explicitly scheduled for Phase 15's live-DB integration tests (`SetupClient`/`RlsClient` pattern, which can open two real connections). This is a deliberate, reported scope boundary, not a silent gap.
- **TypeScript**: `pnpm type-check` clean in `apps/web` (re-verified 2026-09-10, after the authorization-denial test addition — the addition is pgTAP/SQL only, no `.ts` changes, so this simply reconfirms no regression).

### Acceptance criteria

RPC live-verified via MCP to be atomic (pgTAP-proven for the achievable failure modes), idempotent (pgTAP-proven), and correctly authorization-gated on both actor-identity and actor-permission axes (pgTAP-proven); service wrapper written, typed, and unit-tested (5/5 passing); `tsc --noEmit` clean. No application code yet calls this in a user-facing flow (that's Phase 5). **Marked DONE 2026-09-10**: every acceptance-criteria item this phase's own plan named is met with live evidence. Genuine multi-connection concurrent-execution proof (a live two-connection integration harness — this test suite's MSW-based Vitest setup intercepts real-DB calls by default, and pgTAP cannot open two connections from one script) remains out of reach for this phase's tooling and stays explicitly assigned to Phase 15, per the standing plan — this is treated as a Phase 15 test-infrastructure item, not a Phase 3 blocker, consistent with Phase 3's own testing requirements only calling for "realistic concurrency / duplicate invocation behavior."

### Scope classification

PITCH.

---

## Phase 4 — Explicit Matcher approval workflow ✅ DONE (2026-09-11 — functionally built, unit/action/component-tested, live-data-verified, and manually confirmed working end-to-end in a real browser by the product owner)

> **2026-09-11 corrective review**: a verify-first review pass found and fixed one CONFIRMED live security gap in this phase's own RLS layer (Finding A — the `wdd_matcher_sessions` UPDATE policy had no `WITH CHECK`, so an upload-only actor could bypass the application's approval-permission check via a raw client update). Full evidence, the live-verified fix, and the new pgTAP regression test are recorded in `03-repair-orders-progress.md`'s Phase 4 task list and its 2026-09-11 corrective-review change-log entry — not duplicated here.
>
> **2026-09-11 corrective review, SECOND pass**: that same-day fix was itself re-verified against a narrower reviewer hypothesis and found insufficient — `wdd_matcher.approve` had silently become generic Matcher UPDATE authority, and RLS could not enforce the intended `ready_for_review→approved` OLD-status transition (a genuine PostgreSQL RLS limitation, not an oversight). Fixed with a dedicated `approve_wdd_matcher_session` RPC (new migration `20260911090117`, matching the established `materialize_repair_orders_from_session` pattern), narrowing `wms_update` back to upload-only reachability. Separately, this pass also independently re-verified the nullable-`branchId` question specifically for `wdd_matcher_sessions` (not the Workshop tables the first pass's Finding C reasoning covered) and confirmed a real, already-known, Zone-1-owned inconsistency (`01-auth-org-branch-access.md`'s "problem C") — correctly left unfixed here, cross-referenced instead of silently redefined. Full evidence in `03-repair-orders-progress.md`'s Phase 4 task list and its second 2026-09-11 corrective-review change-log entry.

### Objective

Build the currently-nonexistent `approveSession` action/service method and its UI trigger, implementing the `review → approve → approved → materialize` gate the architecture doc requires.

### Why it exists

REPO VERIFIED: `WddMatcherService.approveSession` has zero callers today; the `approved` status value exists in the enum/live data but nothing reaches it through application code. Materialization (Phase 5) depends on this existing first.

### Dependencies

None from Zone 3 schema (this phase touches Matcher/Strefa 3 code, not new Zone 3 tables) — can technically run in parallel with Phase 2/3, but sequenced here because Phase 5 needs it.

### Repository areas affected

- `apps/web/src/server/services/wdd-matcher.service.ts` — add/wire `approveSession` (TO VERIFY DURING PHASE: confirm exact current method signature/existence per the frozen audit's claim vs. live code state before writing).
- `apps/web/src/app/actions/tools/wdd-matcher.ts` — add `approveSessionAction`.
- UI: Matcher review screen — TO VERIFY DURING PHASE exact file path (Matcher/Strefa 3 UI location not yet traced in this plan).

### Supabase changes

None new — `wdd_matcher_sessions.status`, `approved_by`, `approved_at` columns already exist live (LIVE VERIFIED in the architecture doc).

### Existing infrastructure reused

Existing `wdd_matcher_sessions` status enum/columns, existing session-review UI shell.

### Implementation tasks

- [x] ✅ Confirm exact current state of `WddMatcherService.approveSession` — re-verified live before writing: existed as genuinely dead code (zero callers anywhere in the actions/UI layer; confirmed via repo-wide grep), with no state-transition guard and no actor-identity check. Not merely "not wired" — the method itself needed correcting.
- [x] ✅ Implement/wire the service method: rewrote `approveSession` so the `status = 'ready_for_review'` guard is part of the UPDATE's own WHERE clause (atomic, race-safe — no separate SELECT-then-UPDATE), sets `status='approved'`, `approved_by`, `approved_at`; returns a distinct `SESSION_NOT_READY` error (not a generic failure) that collapses "not found" and "wrong status" into one message so it never leaks cross-org/branch row existence.
- [x] ✅ Add `approveSessionAction` server action with permission check — `PERMISSION_WDD_MATCHER_APPROVE`, checked server-side before any DB call (not merely hiding the button).
- [x] ✅ Add UI approval button/flow on the Matcher session review screen (`extraction-review-view.tsx`'s header + a new approval-status strip) — Approve button only when `status==='ready_for_review'` AND the caller's permission snapshot allows it (UX convenience; the real gate is server-side).
- [x] ✅ Add permission slug for approval — **re-verified live first**, per the work order's explicit instruction to prefer reuse: `wdd_matcher.approve` already existed as a seeded permission (`PERMISSION_WDD_MATCHER_APPROVE` in `packages/contracts/src/permissions.ts`, confirmed live via `SELECT slug FROM permissions`), just never referenced by any action. No new permission created — reused as-is, no permission-cache recompile issue applicable (this is an existing slug, not a newly-inserted one, so DISCOVERY-002's gap does not apply here).
- [x] ✅ Emit a `platform_events` entry on approval — new `workshop.matcher_session.approved` registry entry (session id, org, branch, actor, previous status, new status), emitted from `approveSessionAction` after the DB write commits (Mode A, matching the repo's established pattern).
- [x] ✅ Unit tests for the service method — `wdd-matcher.service.test.ts` (4 tests: ready_for_review→approved succeeds with correct WHERE-clause filters; other states rejected with SESSION_NOT_READY; branch-filter omitted when branchId is null; DB error normalized).
- [x] ✅ Component test for the approval UI control — `extraction-review-approval.test.tsx` (7 tests: button visible only when ready_for_review + permitted; hidden without permission; hidden for other statuses; loading state; approved+materialized state with no duplicate approve control; approved+needs-retry state with a working Retry button; just-approved failure state rendered without waiting on the status query).
- [x] ✅ **E2E: review → approve → session shows `approved` status** — **not completed as an automated browser-based Playwright spec** (the sandboxed dev environment's headless-Chromium instances could not reliably render/screenshot this app's pages without crashing — see the detailed troubleshooting note below, unchanged from the original attempt). **Closed instead by direct product-owner manual browser UAT (2026-09-11)**: logged in, opened a real `ready_for_review` Matcher session, clicked Approve, and confirmed the session transitions correctly to `approved` in the running app. This is a real human, in a real browser, against the real running application — a stronger form of the same "does this actually work when someone clicks it" proof the automated E2E spec would have provided, even though it is manual rather than scripted. Combined with the pre-existing live-integration-script evidence (`ready_for_review → approved` succeeds with correct `approved_by`/`approved_at`; re-approval correctly rejected with `SESSION_NOT_READY`), both the data-layer and UI-layer halves of this criterion are now met.
  - Original troubleshooting note (unchanged, kept for record): Playwright's own downloaded Chromium build and a nix-provided fallback could not reliably render/screenshot this app's pages without crashing, despite the app itself serving pages correctly (confirmed via raw HTTP and via CDP target-list titles) — root-caused to the sandbox's software-rendering stack, not the application. Automated Playwright E2E for this flow remains a genuine, separate, not-yet-closed gap; it was not attempted again this pass.

### Testing requirements

- **Unit**: service state-transition logic. **Met.**
- **Component**: approval button/flow. **Met.**
- **E2E**: full review-to-approved path. **Met via direct product-owner manual browser UAT (2026-09-11)**, not an automated Playwright spec (that remains a separate, unclosed gap — see task note above).

### Acceptance criteria

A real user can move a session from `ready_for_review` to `approved` through the UI; the transition is rejected for sessions not in `ready_for_review`; live-verified via MCP that `approved_by`/`approved_at` populate correctly. **Met.** The data-layer half was already live-verified via the integration script (run against `supabase-target`). The "through the UI" half — previously the sole open gap — is now closed by the product owner's own manual browser UAT (2026-09-11): login, session approval, and the `ready_for_review → approved` transition were all directly observed working in the real running app. **Phase 4 is marked ✅ DONE.** Automated (Playwright) browser E2E for this flow remains a genuine, explicitly-tracked follow-up item, not required to close this phase given the direct manual verification.

### Scope classification

PITCH.

---

## Phase 5 — Matcher → RepairOrder materialization ✅ DONE (2026-09-11 — same status as Phase 4: functionally built + live-data-verified + manually confirmed working end-to-end in a real browser by the product owner)

> **2026-09-11 corrective review**: five CONFIRMED findings in this phase were fixed (B — materialization-status permission gap matching the underlying RLS; D — incomplete org/branch scope on the materialization-failure audit event; F — the approval-status UI silently rendering a status-query error as success, plus an undercounted RepairOrder cache-seed; G — raw RPC error text reaching the client unnormalized; I — a defense-in-depth soft-delete filter matching this service's sibling methods). Two reviewer findings touching this phase's design (C — nullable branchId; H — redundant-but-safe authorization re-checks across the approve/materialize/retry/status actions) were investigated and classified as **not** problems, with evidence, and left unchanged — the accepted two-transaction approve→materialize design itself was not touched. Full evidence and exact fixes are recorded in `03-repair-orders-progress.md`'s Phase 5 task list and its 2026-09-11 corrective-review change-log entry.
>
> **2026-09-11 corrective review, SECOND pass**: two further items confirmed and fixed in this phase — the audit-scope fix above was itself refined (item D) to use the target session's own org/branch instead of the caller's active context (already in memory for the initial attempt; one new failure-path-only read for retry); the error-normalization allowlist above (item G) was hardened (item E) to require both errcode AND message-shape match, since a same-errcode native Postgres error could otherwise have leaked. The first pass's own noted test gap (the amber "status unavailable" UI state, item F) was also closed. Full evidence in `03-repair-orders-progress.md`'s Phase 5 task list and its second 2026-09-11 corrective-review change-log entry.

### Objective

Wire the Phase 3 RPC/service to the Phase 4 approval action so that approving a session automatically runs materialization into RepairOrders as one orchestrated user-facing workflow, with an explicit retry path for the failure case.

### Why it exists

This is the actual "Matcher becomes RepairOrder" moment the architecture doc's approval gate exists to protect.

### Dependencies

Phase 3, Phase 4.

### Repository areas affected

- `apps/web/src/app/actions/tools/wdd-matcher.ts` or a new `apps/web/src/app/actions/workshop/repair-orders.ts` (TO VERIFY DURING PHASE which action module owns this — likely a new Workshop-domain action file per repo convention of per-module action directories).
- UI: approval button's result state (success / success-with-materialization-failed) and a conditionally-shown "Retry Materialization" action.

### Supabase changes

None new (uses Phase 3's RPC). If session-level materialization-failure state needs to be queryable (see below), it may require a small addition to `wdd_matcher_sessions` (e.g. a `materialization_status` column) — TO VERIFY DURING PHASE whether this is needed or whether "approved but has zero linked repair_orders" is a sufficient signal to detect the failure case without a new column.

### Existing infrastructure reused

Phase 3 RPC, Phase 4 approval state.

### Approve → Materialize UX (DECIDED, 2026-09-10 correction — supersedes the earlier "separate explicit action" default)

- **Normal path**: `Approve` action (Phase 4) automatically and immediately triggers the Phase 3 materialization RPC as part of the same user-facing workflow. The user does **not** need to click a second "Materialize" button on the happy path. Approval and materialization remain two technically separate operations (the RPC boundary from Phase 3 is unchanged — materialization is still one atomic transaction, called from the approval action, not merged into the approval's own transaction), but the application layer orchestrates them as one flow from the user's perspective.
- **Exception path**: if approval succeeds but the materialization call fails (RPC error, partial data issue, etc.), the session's `approved` state is preserved (never rolled back because of a downstream materialization failure — approval itself already committed), the failure is recorded (via `platform_events`, per the Observability section), a clear error is surfaced in the UI, and an explicit **"Retry Materialization"** action becomes available. Retry calls the same idempotent Phase 3 RPC — safe to invoke repeatedly per its Phase 3 idempotency guarantees.
- This directly supersedes the implementation plan's earlier default recommendation of "separate explicit action" — that framing incorrectly treated approval and materialization orchestration as needing to stay decoupled at the UX level; only their transaction/RPC boundaries need to stay decoupled.

### Implementation tasks

- [x] ✅ Implement the approval action to call the Phase 3 materialization RPC immediately after a successful approval — `approveAndMaterializeSessionAction` calls `approveSessionAction` then, only on its success, `RepairOrdersService.materializeFromSession` as a genuinely distinct call (not the same DB transaction as the approval write — approval commits in its own statement first).
- [x] ✅ On materialization success: surface the result to the UI — the approval-status strip shows the repair-order count (created + reused) from the RPC's own returned counts, and a "Go to Workshop" link; no raw RPC JSON exposed.
- [x] ✅ On materialization failure: keep `approved` state (never rolled back — approval already committed independently), record failure via a new `workshop.repair_orders.materialization_failed` platform event (session id, actor, org/branch, normalized error class/message), surface a clear error, and expose a working "Retry Materialization" control.
- [x] ✅ Implement the Retry Materialization action — `retryMaterializationAction`, calls the same idempotent Phase 3 RPC directly (permission-gated on `wdd_matcher.approve`; the RPC's own internal `workshop.repair_orders.manage_own/manage_all` check is the second, authoritative layer).
- [x] ✅ Handle the "already materialized" idempotent-replay case gracefully — the materialization-status read model (`getMaterializationStatusForSession`, new service method + action) distinguishes "materialized" from "needs retry" on reload without re-running materialization just to find out; live-verified this session (`already_materialized: true`, all `created_*` counts 0, `reused_repair_orders: 1` on a real repeat call).
- [ ] ⬜ **E2E: one session with multiple distinct `zl_number` values → multiple RepairOrders on approval** — **genuinely not manually or automatically verified through the browser this session or during the 2026-09-11 product-owner UAT** (the UAT exercised a single-session approval/materialization, not a multi-`zl_number` session). The underlying multi-order RPC behavior itself remains pgTAP-proven in Phase 3 (unchanged, reused as-is here). Recorded as a genuine, explicit follow-up gap — not required by this phase's own acceptance criteria (below), which concerns correct materialization of a session, not specifically the multi-order case, so it does not block marking this phase DONE.
- [x] ✅ **E2E: materialization fails (simulated) → approved preserved → Retry succeeds** — **not manually simulated in the browser** during the 2026-09-11 product-owner UAT (explicitly out of scope for that pitch-focused pass, per direct product-owner instruction: "not required for pitch happy-path demonstration"). Covered instead by: (a) a component test injecting a `materializationError` into the just-approved mutation result and asserting the Retry control renders (`extraction-review-approval.test.tsx`), and (b) an action-level unit test asserting `approveAndMaterializeSessionAction` returns `success:true` with `materializationError` set (not a thrown/failed action) when the underlying RPC call fails (`wdd-matcher-approval-actions.test.ts`). Per explicit product-owner directive, this automated coverage is accepted as sufficient for this item; a genuine manual/browser rehearsal of the failure→retry path remains a good follow-up for pilot hardening but is not required for pitch.
- [x] ✅ **E2E-equivalent: re-triggering materialization on an already-materialized session is a safe no-op** — this one genuinely **is** live-verified, end-to-end, against the real database (not just mocked): the live-integration script called `materializeFromSession` twice in sequence for the same real session and confirmed the second call was a pure no-op (`already_materialized: true`, `created_repair_orders: 0`, `reused_repair_orders: 1`). This specific acceptance criterion does not depend on the browser layer to be meaningfully proven, so it is marked done on that evidence.
- [x] ✅ **E2E: approve → automatic materialization → RepairOrder appears in Workshop, through the real UI** — **closed by direct product-owner manual browser UAT (2026-09-11)**: approving a real `ready_for_review` session triggered automatic materialization successfully, and the resulting RepairOrder was confirmed to appear in the Workshop list. This is the core happy-path scenario this phase's acceptance criteria is about, now confirmed working end-to-end in a real browser by a real user, not just via the live-integration script.

### Testing requirements

- **Service/integration**: multi-order-per-session materialization result correctness — **met via Phase 3's existing pgTAP coverage** (unchanged RPC, reused as-is); not re-proven through this phase's own UI layer.
- **E2E**: single-session approve→materialize→appears-in-Workshop (**done, confirmed via direct product-owner manual browser UAT, 2026-09-11**); re-materialization no-op (**done, live-verified** — see above); materialization-failure→retry (**not manually rehearsed, explicitly not required for pitch per product-owner directive — automated test coverage accepted as sufficient**); one-session→multiple-orders (**genuine follow-up gap, not required by this phase's own acceptance criteria** — see task list above).

### Acceptance criteria

Approving a real session and triggering materialization produces real, persisted `repair_orders` rows with correct `zl_number` identity, verified live via MCP — not mocked/fixture data. **Met**: this session's live-integration script signed in as a real user, called the real approval + materialization service logic against `supabase-target`, and produced one real, persisted `repair_orders` row with `zl_number = 'ZL/95001/26/3252/BL'`, independently re-queried and confirmed via `listForWorkshop`/`getByIdForWorkshop`. **The browser-UI half of end-to-end verification, previously the sole open gap, is now closed** by the product owner's own manual browser UAT (2026-09-11): approval → automatic materialization → RepairOrder visible in Workshop was directly observed working in the real running app. **Phase 5 is marked ✅ DONE.** The multi-`zl_number`-per-session scenario and a manual failure/retry rehearsal remain genuine, explicitly-tracked follow-up items (see task list above) — neither is required by this phase's own stated acceptance criteria, and the latter is explicitly waived for pitch by product-owner directive.

### Scope classification

PITCH.

---

## Phase 6 — RepairOrder list and search ✅ DONE (2026-09-11 — the actual milestone this run targeted; real UI built, live-data-verified, and the product owner has now performed the manual/visual browser review this milestone existed to enable)

> **2026-09-11 corrective review**: this phase's search-filter construction (Finding E) was investigated against a repo-wide grep of every other `.or()` caller and classified **ACCEPTABLE CURRENT DESIGN** — it matches established repo-wide precedent, and no shared PostgREST-escaping helper exists anywhere to reuse. A small, optional, local hardening was applied anyway and live-verified directly against the target Supabase REST endpoint (an unquoted comma-containing search value previously caused a real `HTTP 400 PGRST100` filter-parse failure; the fix resolves it). Full evidence is recorded in `03-repair-orders-progress.md`'s Phase 6 task list and its 2026-09-11 corrective-review change-log entry.

### Objective

Build list/search UI and backing query for RepairOrders: search by `zl_number`, `order_number`, VIN.

### Why it exists

Pitch-gate requirement: "Istnieje wyszukiwanie zlecenia po numerze" (search by number exists) from the frozen audit's pitch checklist, now generalized to the corrected identity model.

### Dependencies

Phase 2 (schema), Phase 5 (real data to search, for meaningful E2E — though the list screen itself can be built against Phase 2's empty schema first).

### Repository areas affected

- `apps/web/src/app/[locale]/dashboard/workshop/` — new route(s) for RepairOrder list, replacing/extending the current coming-soon shell (REPO VERIFIED current state: static card grid, `page.tsx`/`layout.tsx`/`loading.tsx`/`error.tsx`).
- `apps/web/src/hooks/queries/workshop/` (per repo convention `src/hooks/queries/[module]/index.ts`).
- `apps/web/src/server/services/repair-orders.service.ts` — add list/search query methods.

### Supabase changes

Possibly additional search-supporting indexes if not already added in Phase 2 (trigram/ILIKE indexes on `zl_number`, `order_number`, VIN — TO VERIFY DURING PHASE based on real query plans).

### Existing infrastructure reused

`useDebounce` hook (`src/hooks/use-debounce.ts`, REPO VERIFIED naming per project convention), existing list/table UI patterns from another domain (e.g. inventory or helpdesk list screens) as a template.

### Implementation tasks

- [x] ✅ Add `listForWorkshop`/`getByIdForWorkshop` service methods (org/branch-scoped, RLS-backed; single combined search box matching `zl_number`/`vin`/`order_number` via one OR-ILIKE clause, per the architecture doc's "order_number is descriptive only, never identity" rule — search convenience across all three fields does not change that).
- [ ] ⬜ **Add corresponding server action(s) — deliberately NOT added, by design, not an oversight.** `page.tsx` is a server component that calls `RepairOrdersService.listForWorkshop`/`getByIdForWorkshop` directly at render time (matching the exact convention already established by `help-desk/tickets/page.tsx` and `planning/tasks/page.tsx`, both of which call their services directly for initial SSR data, not through an action) — a server action is for mutations or client-triggered fetches, neither of which applies to a server component's own read. Recorded here so this isn't mistaken for a missed task later.
- [ ] ⬜ **Add query hook under `src/hooks/queries/workshop/` — N/A, per the work order's own explicitly offered alternative.** The work order's Phase 6 section states search "may use: URL search params + server rendering, OR the project's existing query-hook pattern — choose whichever best matches the repository's current architecture." This implementation chose URL-search-params + server rendering (`?q=`, debounced client-side navigation via `RepairOrdersSearch`, re-rendered server-side on each navigation) — a genuinely standard Next.js App Router pattern already implicit even in the data-view-based pages (their own URL state is the source of truth underneath the client machinery). No react-query hook was needed or added for this simpler first version.
- [x] ✅ Build list UI: table/cards with `zl_number`, `order_number`, VIN, status, advisor — desktop table (`hidden md:block`) + mobile card list (`md:hidden`), both real, at `/dashboard/workshop/page.tsx`. Row-open action links to a new minimal detail shell at `/dashboard/workshop/[id]/page.tsx` (identifier/context only — zl_number, order_number, VIN, status, identity_status, advisor, created/updated — explicitly not Phase 7's full header/lines/lifecycle view, per the work order's "option A, don't steal Phase 7 scope" instruction).
- [x] ✅ Build search input wired to `useDebounce` — `RepairOrdersSearch` (350ms debounce, clears the `?q=` param entirely rather than setting it empty).
- [ ] ⬜ **Handle the "ambiguous number in different workshop contexts" disambiguation — NOT built.** Under the corrected identity model, `zl_number` is unique per `(organization_id, branch_id)`, so true same-branch ambiguity should not occur; cross-branch same-`zl_number` collisions are structurally possible (per the architecture doc's accepted cross-branch open risk) but this list is branch-scoped by default, so they wouldn't co-appear. No explicit disambiguation UI was built for this edge case — flagged as a real gap, not assumed away.
- [x] ✅ Unit tests for service query methods — 14 tests added to `repair-orders.service.test.ts` (`listForWorkshop`: domain mapping, org/branch scoping, OR-ILIKE search construction, empty-result handling, advisor-join mapping, DB-error propagation; `getMaterializationStatusForSession`: 2 tests; `getByIdForWorkshop`: not-found-returns-null, found-maps-correctly).
- [ ] ⬜ **Component tests for list/search UI — PARTIAL.** `RepairOrderStatusBadge` (4 tests) and `RepairOrdersSearch` (3 tests: initial value, debounced navigation to `?q=`, clearing removes the param) are genuinely unit/component tested. The list/table/empty-state rendering itself is **not** independently component-tested — it lives inline in the async server component (`page.tsx`), which this repo's existing convention does not typically unit-test directly (server data-fetching pages are exercised through E2E, not RTL, elsewhere in this codebase too — confirmed by absence of `page.test.tsx` files for the Help Desk/Planning equivalents). Flagged, not silently assumed covered.
- [x] ✅ **E2E: search by `zl_number`, by VIN, by `order_number` all return the correct order** — **not run as an automated browser Playwright spec** (see Phase 4's E2E note for the environment-level reason; unchanged). **Closed instead by direct product-owner manual browser UAT (2026-09-11)**: search by ZL number, search by VIN, and search by order_number were each individually confirmed working in the real running app; RepairOrder detail opens correctly; a page reload preserves the persisted state; the Workshop list persists correctly after reload. This is real human confirmation in a real browser, on top of the pre-existing live-integration-script evidence (all three searches independently found the correct real `repair_orders` row via the exact reviewed query logic; a non-matching search correctly returned zero rows; a cross-branch `getByIdForWorkshop` call correctly returned `null`, proving RLS/branch-scoping live). Both the query-logic layer and the actual rendered UI layer are now confirmed.
  - **Known issue surfaced by this UAT (Zone 1-owned, not a Phase 6 blocker)**: switching the active branch does not immediately refresh/invalidate the Workshop RepairOrder list — the previous branch's RepairOrders only disappear after a manual page refresh. After that refresh, the correct branch-scoped data is shown and no cross-branch data remains accessible, so this is a UX/cache-invalidation gap, not a data-security gap. This is the same class of issue as Zone 1's existing branch-switch/cache-invalidation work (branch-context propagation on switch is owned by Zone 1, not Zone 3) and is recorded here for traceability, to be addressed during Zone 1 work rather than patched locally in Zone 3.

### Testing requirements

- **Unit**: service query logic. **Met** (14 tests).
- **Component**: list/search rendering, empty states. **Partially met** — search input and status badge tested; list/table/empty-state rendering itself not independently tested (see task note above; a genuine, non-blocking follow-up gap).
- **E2E**: search-by-each-field scenarios. **Met via direct product-owner manual browser UAT (2026-09-11)**, not an automated Playwright spec (that remains a separate, unclosed follow-up item).

### Acceptance criteria

A real materialized RepairOrder (from Phase 5's real data) is findable via search by `zl_number`, VIN, and `order_number`; RLS-scoped correctly (verified with a cross-branch negative test). **Met.** The data layer was already live-verified this session exactly as described above. **The UI/browser layer, previously the sole open gap, is now closed**: the product owner directly confirmed the rendered search box, all three search fields, the table, and the detail page working correctly in a real browser (2026-09-11 manual UAT) — the explicit goal of this milestone ("the product owner can... visually inspect and manually validate the first real Workshop UI"). **Phase 6 is marked ✅ DONE.** The ambiguous-number disambiguation UI, full list/table component tests, and automated (Playwright) browser E2E remain genuine, explicitly-tracked follow-up items (see task list above), none of which are required by this phase's own stated acceptance criteria. The branch-switch list-refresh issue surfaced during UAT is recorded above as a known, Zone-1-owned issue — not a Phase 6 blocker.

### Scope classification

PITCH.

---

## Phase 7 — Header, advisor ownership, lifecycle, and manual RepairOrder creation ✅ DONE (2026-09-11)

> **2026-09-11 verify-first pass, before any code was written**: re-read the current architecture doc, current code (Phase 4-6 state), and live Supabase schema/RLS before touching anything, per explicit instruction. Found and fixed **one CONFIRMED, pre-existing, live security/correctness bug** in already-deployed Phase 2 RLS (not introduced by this phase): `repair_orders_update`'s ownership check (`advisor_contact_id IN (SELECT id FROM crm_contacts WHERE linked_user_id = auth.uid())`) is a plain correlated subquery against `crm_contacts`, itself subject to `crm_contacts`' own RLS (`crm.contacts.read` required) -- so ANY `manage_own` advisor who does not also separately hold `crm.contacts.read` had their own, genuine ownership silently evaluate to false: a hard self-lockout on the exact ownership model this table exists to enforce. Found live, while writing this phase's own RLS test, not assumed. Fixed with a `SECURITY DEFINER` helper (`is_own_advisor_contact`), matching `has_branch_permission`'s own established pattern of bypassing the underlying table's RLS for this class of cross-table authorization check -- see the migrations list below. Also found and closed a smaller, related INSERT-time gap (`repair_orders_insert` let a `manage_own`-only actor name ANY contact as advisor, not just themselves) before it could compound the same class of problem. Both fixes are narrow, additive, forward migrations -- no RLS was broadened, only tightened to match the already-accepted ownership model.
>
> **One genuine, unresolved product-decision gap identified and NOT silently invented around**: the architecture doc's own prose for advisor-picker scoping ("a `crm_contacts` row representing an internal advisor gets a `crm_party_roles` row with `role='employee'`") is not literally implementable against the live schema -- `crm_party_roles.role` is a PARTY-level tag (`crm_party_roles.party_id -> crm_parties.id`), not a CONTACT-level one; `crm_party_roles` has no `contact_id` column at all, and no existing code anywhere in the repo uses this party-role-employee pattern. Implementing it as literally described would require inventing a new, undocumented, unprecedented synthetic-party-per-employee scheme. This phase does NOT invent that scheme. Instead, the advisor picker uses a narrower, schema-real, reversible interim signal: `crm_contacts` rows already linked to a real platform user (`linked_user_id IS NOT NULL`) -- the only contacts that can ever function as an "owner" under the `manage_own` ownership model in the first place. See `RepairOrdersService.listAdvisorCandidates`'s own doc comment for the full reasoning. **This remains an open product decision, and the interim signal is deliberately provisional**, not a load-bearing security boundary (RLS enforces real ownership independent of picker scoping either way) — see the progress tracker's Phase 7 task list for the exact decision needed if/when the party-role scheme is genuinely wanted.
>
> **2026-09-11 external-review correction pass**: an external reviewer examined the full Phase 7 diff/bundle and raised six findings. Each was independently live-reproduced against `supabase-target` (as the genuinely-RLS-enforced `authenticated` role, not `postgres`) BEFORE any fix was written, per explicit "verify first" instruction. **Four of six findings CONFIRMED and fixed**, all via new forward migrations (no existing applied migration edited in place); **one (Finding F) is a genuine product/UX decision, documented with a recommendation but deliberately NOT decided or implemented**; the advisor-picker product decision from the note above was explicitly kept separate from this pass, per instruction, and remains equally open.
>
> - **Finding A (CONFIRMED, fixed)**: `RepairOrdersService.getOwnAdvisorContactId` performed a plain authenticated SELECT against `crm_contacts` -- itself subject to that table's own RLS (`crm.contacts.read` required) -- reintroducing in the APPLICATION layer the exact same visibility bug the first correction pass had already fixed at the RLS layer (`is_own_advisor_contact()`). Live-reproduced: a real self-linked contact, for which `is_own_advisor_contact()` correctly returned true, returned zero rows from this method's exact query shape for an actor holding only `workshop.repair_orders.manage_own`/`.read`. Consequence: a genuine advisor without CRM access was shown as a non-owner on their own RepairOrder and could not self-assign during manual creation. Fixed with a new `SECURITY DEFINER` RPC, `get_own_advisor_contact_id(p_organization_id)` (migration `20260911183702`), mirroring `is_own_advisor_contact`/`has_branch_permission`'s own established pattern -- derives identity from `auth.uid()` only, organization-scoped, exposes only the resulting contact id.
> - **Finding B (CONFIRMED, fixed)**: `repair_orders_update`'s RLS restricted `status='archived'` writes only for the `manage_own` branch -- the `manage_all` branch had no status restriction at all, meaning a raw Data API call as `manage_all` could un-archive a row or edit its fields while archived, violating the accepted "archived is terminal for everyone" contract. Live-reproduced both paths succeeding before the fix. Fixed by adding `status <> 'archived'` to the policy's `USING` clause (migration `20260911183705`) -- evaluated against the CURRENT row, this makes an already-archived row unreachable for UPDATE by anyone, without blocking the act of archiving itself (`OLD.status` is never already `'archived'` when transitioning into it). The UI's edit-control gating was also extended to match (previously `manage_all` always saw an Edit control regardless of status).
> - **Finding C (CONFIRMED, fixed)**: `identity_status`, `created_by`, `organization_id`, and `branch_id` were documented as non-client-writable but enforced only by the zod/action layer, not the DB -- live-reproduced a direct UPDATE setting `identity_status`/`zl_number` into a self-consistent-but-fabricated state, a genuinely inconsistent state (`identity_status='unresolved'` while `zl_number` remained non-null, a direction the existing one-way CHECK constraint does not cover), and a direct rewrite of `created_by`. Determined (by examining sibling services) that Ambra's general pattern is application-layer-authoritative for ordinary fields, RLS-authoritative for row-level scoping -- but `identity_status` (a derived invariant) and `created_by` (audit authorship) cross that bar. Fixed with a single, minimal `BEFORE INSERT OR UPDATE` trigger (migration `20260911183709`) that recomputes `identity_status` from `zl_number`'s presence unconditionally and freezes `created_by`/`organization_id`/`branch_id` after insert -- confirmed via `pg_get_functiondef` not to interact adversely with `materialize_repair_orders_from_session` (which already only ever inserts consistent values for these fields).
> - **Finding D (CONFIRMED, fixed)**: `repair_orders.advisor_contact_id` was a simple FK to `crm_contacts(id)` with no organization scoping, and no RLS branch (including `manage_all`) checked the contact's own organization against the RepairOrder's. Live-reproduced: `manage_all` successfully assigned a crm_contacts row belonging to a completely different organization as advisor. Fixed at the storage layer, not just RLS, per explicit instruction to "prefer DB integrity over picker-only validation": a new `crm_contacts_org_id_unique (organization_id, id)` constraint plus a composite FK, `repair_orders (organization_id, advisor_contact_id) -> crm_contacts (organization_id, id)` (migration `20260911183712`) -- enforced for every caller, including any future/service-role code path, not merely an authorization gate a future RLS change could loosen. Zero existing rows violated this before it was added (live-verified).
> - **Finding E (CONFIRMED, fixed)**: the five plain-CRUD Phase 7 service methods returned raw `error.message` for any non-23505 failure, unlike the curated normalization already established for the materialization RPC. Fixed with a shared `normalizeRepairOrderCrudError` helper: a small, curated allowlist (duplicate `zl_number`, matched by constraint name not errcode alone; cross-org/invalid advisor FK violation, matched by column name) passes through a specific safe message, everything else is logged server-side and replaced with one generic message.
> - **Finding F (verified, NOT decided)**: confirmed that a `manage_own` actor can currently create a RepairOrder with `advisor_contact_id IS NULL` (the manual-creation UI's self-assign checkbox is opt-in, unchecked by default), producing an order its own creator cannot subsequently edit via `manage_own`. This is a genuine product/UX question, not a security bug -- see the progress tracker's Phase 7 task list for the recorded options and recommendation. **Not implemented or decided in this pass.**
>
> Full evidence (live reproduction queries, exact before/after policy text, migration versions, and the 13 new pgTAP assertions) is recorded in the progress tracker's Phase 7 task list and its 2026-09-11 correction-pass change-log entry.
>
> **2026-09-12 final narrow verify-first pass**: a second, narrower review round found and fixed one more CONFIRMED gap in Finding C's own fix (`created_by` was frozen only on UPDATE, not INSERT -- a raw INSERT could still spoof authorship as another real user; fixed via `COALESCE(auth.uid(), NEW.created_by)` on INSERT, migration `20260911192411`, verified compatible with manual creation, materialization, and a hypothetical service-role path), verified two more hypotheses (own-advisor-contact cardinality; `SECURITY DEFINER` EXECUTE grants) as already safe without changing anything, and closed one regression-test gap (`organization_id`/`branch_id` immutability, now committed as pgTAP tests). No Finding B/D/E work was reopened. See the progress tracker's own 2026-09-12 entry for full detail.

### Objective

Build the RepairOrder header detail view, advisor assignment/ownership flow per the CRM-based advisor model, the `open`/`closed`/`archived` lifecycle, and **manual RepairOrder header creation** (PITCH scope — see correction below).

### Why it exists

Architecture doc's Authorization and ownership model section; frozen audit's pitch checklist "Nagłówek" section. Manual creation is here because it is a **DEMO READY gate requirement** ("Manual RepairOrder creation path works") — RepairOrders must not depend exclusively on Matcher import, per explicit product decision (2026-09-10 correction). This was previously misplaced under Phase 14/PILOT in this plan; corrected here.

### Dependencies

Phase 2 (`crm_contacts` unique constraint, `crm_party_roles` extension), Phase 6 (list/detail navigation).

### Repository areas affected

- Workshop detail route: `apps/web/src/app/[locale]/dashboard/workshop/[id]/` or equivalent (TO VERIFY DURING PHASE exact routing convention).
- New RepairOrder creation route/form (manual header creation).
- `repair-orders.service.ts` — header read/update/create, advisor assignment methods.
- CRM-side: confirm `crm_contacts` create/search UI can be reused for advisor selection (TO VERIFY DURING PHASE whether a contact-picker component already exists in the CRM module).

### Supabase changes

None beyond Phase 2's `crm_contacts`/`crm_party_roles` changes and the `archived` status value (see the forward migration recorded under Phase 2 below — status model corrected to `open`/`closed`/`archived`).

### Existing infrastructure reused

CRM contact search/selection UI if it exists; `has_branch_permission` for the ownership check.

### Manual RepairOrder creation — scope split (DECIDED, 2026-09-10 correction)

- **PITCH (this phase)**: manual creation of the RepairOrder **header/context only** — organization/branch assignment (correct org/branch, not user-selectable beyond their own active context), optional VIN, optional advisor selection (if an `employee`-role CRM contact exists), and correct `identity_status` behavior (a manually-created order with no `zl_number` starts `unresolved`; it can be promoted to `resolved` later if a `zl_number` is supplied or reconciled from a Matcher import — reusing the identity model already built in Phase 2, not a new mechanism). Permissions/RLS and persistence follow the same rules as materialized orders (`workshop.repair_orders.manage_own`/`manage_all` INSERT policy already live from Phase 2 — no new RLS needed for header creation itself).
- **PILOT (stays in Phase 14, unchanged)**: manual creation/editing of RepairOrder **lines** (parts) is NOT part of this phase and is NOT moved — it remains PILOT scope, since a manually-created order in the pitch demo does not need manual line entry to satisfy the DEMO READY gate ("manual RepairOrder creation path works" is about the header/context existing without Matcher, not about manual parts entry).

### Implementation tasks

- [x] ✅ Add `createRepairOrder` service method (manual header creation): org/branch from caller's active context (never client input), optional VIN/advisor/vehicle-brand/client-name/dealer-name fields, `identity_status` derived (`'resolved'` when `zl_number` present, `'unresolved'` otherwise — no fabricated `zl_number`), enforces the same RLS INSERT policy as materialization. `23505` (duplicate `zl_number`) mapped to a clear client-facing message.
- [x] ✅ Add `assignAdvisor`/`updateHeader` service methods implementing the ownership rule: `current_user_id = crm_contacts.linked_user_id AND has_branch_permission(..., 'workshop.repair_orders.manage_own')` OR `has_branch_permission(..., 'workshop.repair_orders.manage_all')` — **live-verified this is exactly what `repair_orders_update`'s RLS already enforces** (see the corrective-review note above for the one real bug found and fixed in that mechanism). `assignAdvisor` is a separate method from `updateHeader` since RLS treats `advisor_contact_id` specially (only `manage_all` can actually reassign; `manage_own`'s own `WITH CHECK` can never succeed at changing it away from the caller).
- [x] ✅ Add corresponding server actions with permission checks (defense in depth — RLS is not the only gate): `createRepairOrderAction`, `updateRepairOrderHeaderAction`, `assignRepairOrderAdvisorAction` (pre-checks `manage_all` explicitly, clearer error than an RLS-driven no-op), `changeRepairOrderStatusAction` (pre-checks the transition via `canTransitionRepairOrderStatus` before ever reaching the DB), `listAdvisorCandidatesAction` — new file `apps/web/src/app/actions/workshop/repair-orders.ts`.
- [x] ✅ Build manual-creation UI (form: branch context implicit and validated server-side — a clear redirect when no active branch exists, since `branch_id` is `NOT NULL`; VIN/all business fields optional; advisor optional) — new route `/dashboard/workshop/new`, linked from a "New repair order" CTA on the Workshop list page (permission-gated).
- [x] ✅ Build header UI section showing `zl_number`, `order_number`, VIN, advisor, status, vehicle brand/client/dealer fields, identity status, created/updated metadata — upgraded `/dashboard/workshop/[id]/page.tsx` from Phase 6's minimal shell to the real Phase 7 header view (`RepairOrderHeaderEditor` client component), with an edit toggle gated on the same ownership rule the RLS enforces (including a fix this phase's own component tests caught: `manage_own` must not see an Edit control on an already-`archived` order, since RLS's `WITH CHECK` would reject any write to it regardless of which field changed).
- [x] ✅ Build advisor-assignment UI (contact picker) — **scoped to `crm_contacts` rows already linked to a real platform user (`linked_user_id IS NOT NULL`), NOT literally "employee-role `crm_contacts`"** — see the corrective-review note above for why the architecture doc's literal phrasing is not implementable against the live schema, and why this is recorded as an open product decision rather than silently invented around.
- [x] ✅ Implement status/lifecycle transitions: **`open` → `closed` → `archived`**, using the existing, authoritative `canTransitionRepairOrderStatus` domain helper (unchanged from Phase 1/2 — confirmed still correct: `archived` is terminal, no `archived → closed`/`archived → open`, matching the live RLS exactly). `archived` requires `manage_all` — **RLS-layer enforcement already live from Phase 2** (`20260910074716_repair_orders_archive_rls_restriction.sql`); this phase adds the application-layer piece: `changeStatus` service method (race-safe conditional `UPDATE ... WHERE status = fromStatus`, returns a specific conflict error on 0 rows), `changeRepairOrderStatusAction`, and the UI's Close/Reopen/Archive buttons (Archive behind a confirmation dialog, `manage_all`-only).
- [x] ✅ Unit/service tests for ownership-rule-consistent RLS behavior, manual-creation identity-status defaulting (present → `resolved`, absent → `unresolved`, never fabricated), race-safe status transitions, and duplicate-`zl_number` error mapping — `repair-orders.service.test.ts`, 15 new tests (41/41 total in that file).
- [x] ✅ Component tests for header/advisor/manual-creation UI — `repair-order-header-editor.test.tsx` (8 tests, including the archived-`manage_own` read-only regression this pass's own testing caught) and `new-repair-order-form.test.tsx` (5 tests).
- [x] ✅ DB/RLS test: advisor with only `manage_own` cannot edit an order they are not assigned to (proven as a silent 0-row no-op); advisor with `manage_all` can edit any in-branch order; advisor ownership does not grant any `inventory.*`/`warehouse.*` capability (explicit negative test); archiving requires `manage_all`, not plain `manage_own` — new `apps/web/supabase/tests/093_repair_orders_header_ownership_rls_test.sql`, **12/12 passing live**, executed against `supabase-target` via MCP with zero residual data (wrapped `BEGIN;...ROLLBACK;`). This is also the test that surfaced the `is_own_advisor_contact` bug fix above — written to _prove_ the ownership rule, and initially failing for the right reason.

### Testing requirements

- **Unit/Service**: ownership-rule-consistent behavior, manual-creation identity-status defaulting, race-safe status transitions, duplicate-`zl_number` handling. **Met** (15 new tests, `repair-orders.service.test.ts` 41/41).
- **Action**: authorization pre-checks (manage_own/manage_all/archive-requires-manage_all), trusted org/branch context, validation, advisor-self-restriction for `manage_own` at creation. **Met** — new `apps/web/src/app/actions/workshop/__tests__/repair-orders.test.ts`, 21/21 passing.
- **Component**: header/advisor/manual-creation UI, including edit-visibility-by-ownership and lifecycle-button-visibility-by-status/permission. **Met** (13 new tests across two files).
- **DB/RLS**: ownership boundary tests, explicit negative inventory-permission test, archive-permission boundary test. **Met** — `093_repair_orders_header_ownership_rls_test.sql`, 12/12 passing live.

### Acceptance criteria

A RepairOrder can be created manually (no Matcher session involved) and persists with correct org/branch/`unresolved` identity; advisor assignment persists via `advisor_contact_id`; ownership rule enforced both server-side and via RLS; advisor ownership proven (via a failing-permission test) to not grant warehouse permissions; `open`/`closed`/`archived` transitions work and `archived` is permission-gated correctly. **Met — live-verified, not just unit-tested**: all of the above were proven against the real `supabase-target` database as the genuinely-RLS-enforced `authenticated` role (not `postgres`/service-role), via `093_repair_orders_header_ownership_rls_test.sql`'s 12 assertions, in addition to the mocked unit/action/component test suites (55 new tests total this phase, 62/62 in the pre-existing suite unaffected). **Phase 7 is marked ✅ DONE.** Genuine browser UAT of this phase's UI (manual creation, header edit, advisor reassignment, lifecycle buttons) has **not** been performed yet — flagged as the equivalent outstanding item Phases 4-6 also carried before their own UAT pass, recorded as a follow-up, not silently assumed covered.

### RepairOrder close behavior — smallest consistent proposal (documented 2026-09-10, NOT a Phase 3 blocker, implementation deferred to this phase's own task list once 10A–10F exist)

Per product-owner instruction: normal `open → closed` transition must **not** silently leave unresolved warehouse obligations dangling. Smallest consistent proposal, to be confirmed/refined once Phases 10A–10C exist (this phase cannot implement the full behavior before those phases build the things being checked — recorded here so the design isn't invented ad hoc later):

- **Normal close** (`workshop.repair_orders.manage_own`/`.manage_all`, the same gate `canTransitionRepairOrderStatus` already models): blocked if the RepairOrder has any line with an outstanding reservation (`reserved_quantity - released_quantity - fulfilled_quantity > 0`), an outstanding allocation (`allocated_quantity - fulfilled_quantity > 0`), or a non-empty container still referencing it (`reference_id = repair_order.id AND status <> 'empty'` once Phase 10C's status model exists). Surfaced as a clear, itemized blocker list, not a generic error.
- **Override close** (proposed permission: reuse `warehouse.inventory.adjust`, matching decision 5's existing override-permission convention, rather than inventing a new slug — confirm against real pilot-role needs before building): explicit confirmation + mandatory reason (same UX shape as the WU over-issue override in Phase 10F); on confirm, auto-releases remaining reservations/allocations via the already-live `inventory_release_reservation`/`inventory_release_allocation` RPCs (reused, not reimplemented) and records the override via `platform_events` (Mode A, matching the rest of Zone 3). Containers are **not** auto-emptied by an override close — a non-empty container represents real physical stock that still exists somewhere; the override releases the _demand-side_ commitments (reservation/allocation) and leaves the container/its contents for separate physical handling, explicitly logged as a residual note on the close event.
- **History is never deleted** — closing (normal or override) only transitions status and, for override, releases reservation/allocation rows via their existing release RPCs (which already preserve history per the live-verified release semantics in the audit's §3/§4) — no row is ever hard-deleted by a close.
- **This proposal is a starting point for this phase's own future implementation tasks, not yet added as checkboxes below** — those get added when this phase is actually picked up, after 10A–10C exist to check against. Flagging now satisfies the "document the smallest consistent proposal before implementing" instruction without inventing implementation tasks against phases that don't exist yet.

### Scope classification

PITCH.

---

## Phase 8 — Logical RepairOrder lines

### Objective

Build the logical order-lines view: SKU, name, ordered quantity, unit, aggregated across all backing source lines (not grouped by source document).

### Why it exists

Frozen audit pitch checklist "Pozycje" section: a durable, non-WDD-grouped line list is a named pitch requirement, now realized via the corrected provenance model.

### Dependencies

Phase 2, Phase 5 (real materialized lines to display).

### Repository areas affected

- Detail view line-list component.
- `repair-orders.service.ts` — line listing with quantity read-model join.

### Supabase changes

None beyond Phase 2 (may need a read-model view — TO VERIFY DURING PHASE whether a SQL view or an application-level join is preferred for the derived-quantities read model; default to application-level join for pitch simplicity, revisit as a DB view if performance requires it in pilot).

### Existing infrastructure reused

N/A new.

### Implementation tasks

- [ ] Add `listRepairOrderLines` service method joining `repair_order_lines` with aggregated `repair_order_line_movement_links` sums for `outstanding_to_receive`/`available_for_issue`.
- [ ] Build line-list UI: SKU, product name, ordered qty, unit, `outstanding_to_receive`, `available_for_issue`, status.
- [ ] Confirm same-SKU-on-multiple-lines never merges (explicit test, per architecture doc).
- [ ] Unit tests for the quantity-aggregation query logic.
- [ ] Component tests for line-list rendering including the two derived-quantity columns.
- [ ] Service test: worked example from the architecture doc (ordered=5 across 3 receipt batches totaling 5, issued=3 across 2 issue batches → `outstanding_to_receive` and `available_for_issue` computed correctly).

### Testing requirements

- **Unit/service**: quantity-derivation worked example (exact numbers from the architecture doc).
- **Component**: line list rendering.

### Acceptance criteria

Line list shows a complete, non-duplicated set of parts per order; derived quantities match the worked example exactly when replicated against real linked movement data (Phase 10 dependency for full end-to-end proof, but the query logic itself is provable against seeded test data now).

### Scope classification

PITCH.

---

## Phase 9 — Source documents, source lines and provenance

### Objective

Build the "Magazyn i Zam." documents sub-view backing data and provenance-inspection capability: which source documents and source lines back a given RepairOrder/line.

### Why it exists

Frozen audit pitch checklist "Magazyn i Zam." section; architecture doc Corrections 3/4.

### Dependencies

Phase 2, Phase 5.

### Repository areas affected

- `repair-orders.service.ts` — `listSourceDocumentsForOrder`, `listSourceLinesForOrderLine`.
- Detail view "Magazyn i Zam." tab (conceptual read-model only per the architecture doc; actual UI split into Magazyn/Zamówienia-Przyjęcia sub-views is Phase 11).

### Supabase changes

None beyond Phase 2.

### Existing infrastructure reused

N/A new.

### Implementation tasks

- [ ] Add service methods for document/line provenance listing, joined through both link tables.
- [ ] Verify (service test) one-document→many-orders and one-order→many-documents both render correctly.
- [ ] Verify (service test) one-logical-line→many-source-lines renders correctly with each source line's `quantity_contribution`.
- [ ] Verify (service test) a later-arriving WDD document correctly attaches to an existing order rather than creating a duplicate.
- [ ] Component tests for the document/line provenance list.

### Testing requirements

- **Service/domain**: exactly the M:N scenarios named in the architecture doc's testing strategy (one-document→many-orders, one-order→many-documents, one-logical-line→many-source-lines, source-line-linked-only-once).

### Acceptance criteria

Given a RepairOrder materialized from multiple sessions (Phase 5 E2E case), its full document/line provenance is correctly listable and traceable back to specific `wdd_matcher_lines` rows.

### Scope classification

PITCH.

---

## Phase 10 — Inventory movement-line linkage and warehouse read model

### Objective

Wire `repair_order_line_movement_links` to real receiving/issuing flows so that receipts/issues against a RepairOrderLine are durably attributed at the line level.

### Why it exists

Architecture doc Correction 5 — the core "never infer by SKU" requirement and the worked partial-receipt/issue example.

### Dependencies

Phase 2, Phase 8 (line read model), existing inventory movement engine (`InventoryMovementsService`/RPCs — REPO VERIFIED to exist).

### Repository areas affected

- Wherever inventory receiving/issuing actions currently run (`apps/web/src/server/services/inventory-movements.service.ts` and related actions — TO VERIFY DURING PHASE exact integration point) — extended to optionally accept a `repair_order_line_id` attribution parameter.
- `repair-orders.service.ts` — read methods for received/issued/outstanding/available quantities.

### Supabase changes

None beyond Phase 2's `repair_order_line_movement_links` table — this phase is about _populating_ it from real movement flows, not new schema (unless the movement-creation RPC needs a new optional parameter, which is a function signature change, not a new table).

### Existing infrastructure reused

Full existing `InventoryMovementsService`/movement RPC layer — extended, not replaced or duplicated.

### Implementation tasks

- [ ] Extend the relevant receiving flow to optionally write a `repair_order_line_movement_links` row (`relation_type = 'receipt'`) when a movement line is attributed to a RepairOrderLine.
- [ ] Extend the relevant issuing flow the same way (`relation_type = 'issue'`).
- [ ] Ensure attribution is explicit (user selects which RepairOrderLine a received/issued quantity applies to) — never inferred from SKU alone, per the explicit architecture-doc rule.
- [ ] Implement the derived-quantity read queries: `received_quantity`, `issued_quantity`, `outstanding_to_receive`, `available_for_issue`.
- [ ] Reproduce the architecture doc's exact worked example as an automated test: ordered=5 across 3 receipt batches (e.g. 2+2+1) totaling 5, issued=3 across 2 issue batches (e.g. 2+1), assert `received_quantity=5`, `issued_quantity=3`, `outstanding_to_receive=0`, `available_for_issue=2`.
- [ ] Test: two RepairOrderLines sharing the same SKU receive/issue independently without cross-attribution.
- [ ] Test: one RepairOrderLine receives across many movement-line batches (one-line→many-receipt-movement-lines) and issues across many batches (one-line→many-issue-movement-lines).

### Testing requirements

- **Service/domain**: exact worked example; same-SKU-different-lines independence; one-line→many-receipt/issue-movement-lines.
- **DB**: `UNIQUE (repair_order_line_id, inventory_movement_line_id, relation_type)` prevents double-application.

### Acceptance criteria

The exact worked example from the architecture doc passes as an automated test against real linked data (not mocked quantities); same-SKU lines proven independent.

### Scope classification

PITCH.

---

## Phase 10A — Reservation integration (RepairOrderLine → Reservation)

### Objective

Wire the RepairOrder domain to the existing, live `inventory_create_reservation`/`inventory_release_reservation` RPCs so a RepairOrderLine can reserve stock, per decision 2 (Reservation-before-Allocation is the normal RepairOrder path).

### Why it exists

Product-owner decision (2026-09-10): full physical container workflow is PITCH, and Reservation is its first link. The underlying RPCs are LIVE VERIFIED and require no change (audit §3); this phase is Zone 3-side wiring only.

### Dependencies

Phase 8 (logical lines to reserve against), Phase 10 (movement-line linkage pattern to follow for attribution).

### Repository areas affected

- `repair-orders.service.ts` — new `reserveForLine`/`releaseReservation` methods calling the existing generic RPCs with `reference_type='repair_order_line'`, `reference_id=repair_order_line_id`.
- No new Zone 3 table — reservations use the generic `reference_type`/`reference_id` pattern (audit §3), which requires zero schema change to attach a RepairOrderLine.

### Supabase changes

None to reservation tables/RPCs (reused as-is). Optional: a covering index on `inventory_reservation_lines (reference_type, reference_id)` if query performance requires it — TO VERIFY DURING PHASE against real query plans, not assumed necessary upfront.

### Existing infrastructure reused

`inventory_create_reservation`, `inventory_release_reservation` (LIVE VERIFIED, `warehouse.inventory.operate`-gated, per decision 5).

### Implementation tasks

- [ ] Add `RepairOrdersService.reserveForLine(lineId, quantity, ...)` calling `inventory_create_reservation` with the line as `reference_type='repair_order_line'`.
- [ ] Add `RepairOrdersService.releaseReservationForLine(...)` calling `inventory_release_reservation`.
- [ ] Read-model method: given a RepairOrderLine, list its active reservation(s) and outstanding quantity (`reserved_quantity - released_quantity - fulfilled_quantity`, per the audit's live-verified formula).
- [ ] UI affordance on the line detail (reserve button, reservation status badge) — minimal, not the full Magazyn UI (that's Phase 11).
- [ ] Unit tests: service method parameter mapping, read-model formula.
- [ ] pgTAP/service test: reserving more than `available_quantity` is rejected (existing RPC behavior, verified reachable end-to-end from the RepairOrder path).

### Testing requirements

- **Unit**: service method mapping, outstanding-quantity read-model formula.
- **Service/integration**: reserve → read-model reflects it; over-reservation rejected.

### Acceptance criteria

A real RepairOrderLine can reserve stock via the existing reservation RPC, and its reservation status is readable back through the RepairOrder domain, live-verified via MCP.

### Scope classification

PITCH.

---

## Phase 10B — Allocation integration (Reservation → Allocation)

### Objective

Wire allocation creation against an existing reservation for a RepairOrderLine, per decision 2.

### Why it exists

Completes the demand→physical-assignment step; the underlying `inventory_create_allocation` RPC is LIVE VERIFIED and already performs the correct reservation-line `fulfilled_quantity` handshake (audit §4) — no engine change needed.

### Dependencies

Phase 10A.

### Repository areas affected

- `repair-orders.service.ts` — `allocateForLine` calling `inventory_create_allocation` with `p_reservation_line_id` set from Phase 10A's reservation.

### Supabase changes

None to allocation tables/RPCs.

### Existing infrastructure reused

`inventory_create_allocation` (LIVE VERIFIED; **must** be called with `p_reservation_line_id` set for the normal RepairOrder path per decision 2 — direct allocation without a reservation stays available at the platform level but is not the Zone 3 default).

### Implementation tasks

- [ ] Add `RepairOrdersService.allocateForLine(reservationLineId, locationId, quantity, ...)`.
- [ ] Read-model method: given a RepairOrderLine, list its allocation(s), outstanding quantity (`allocated_quantity - fulfilled_quantity`).
- [ ] Explicit test: creating the allocation correctly decrements the _reservation's_ `fulfilled_quantity`-driven outstanding, per the audit's documented handshake — and does **not** get double-decremented later by a WU issue (Phase 10F must increment `allocation_lines.fulfilled_quantity` only, never re-touch `reservation_lines.fulfilled_quantity`).
- [ ] Unit tests + pgTAP/service test for the handshake.

### Testing requirements

- **Unit**: service mapping.
- **Service/integration**: reservation→allocation handshake produces the exact live-verified balance transitions (`reserved_quantity` down, `allocated_quantity` up, reservation line `fulfilled_quantity` up).

### Acceptance criteria

A real RepairOrderLine's reservation converts to an allocation at a specific location, live-verified; double-counting explicitly disproven by test.

### Scope classification

PITCH.

---

## Phase 10C — Container orchestration (Allocation → Container)

### Objective

Build the currently-nonexistent container orchestration RPCs (audit §5: container has zero RPCs today, only RLS-gated direct table access) and the new allocation↔container link entity (decision 7).

### Why it exists

This is the single largest genuine gap the container audit found. Nothing here exists yet — this phase is net-new build, not wiring.

### Dependencies

Phase 10B (allocations to place into containers).

### Repository areas affected

- New migration(s): `inventory_containers.status` CHECK gains `'empty'` (decision 6); new `inventory_allocation_container_links` table (decision 7, exact DDL below) with its constraints/RLS (FORCE RLS, Tier matching `inventory_containers`).
- New RPCs (generic inventory domain, not Zone-3-owned, mirroring `inventory_create_reservation`'s one-call/one-transaction shape): `inventory_create_container` (header + initial lines, one transaction), `inventory_add_to_container` / `inventory_remove_from_container` (writes the new link entity + container lines, enforces quantity-conservation per decision 7), `inventory_seal_container`, `inventory_close_container` (marks `'empty'` when contents hit zero, enforced server-side per decision 6).
- `repair-orders.service.ts` (or a new `inventory-containers.service.ts`, following the flat-service convention) — thin wrapper around the new RPCs, setting `reference_type='repair_order'`/`reference_id` per decision 3.

### Supabase changes

- Migration: `inventory_containers.status` CHECK → add `'empty'`.
- Migration: `inventory_allocation_container_links (id, organization_id, branch_id, allocation_line_id FK → inventory_allocation_lines, container_line_id FK → inventory_container_lines, quantity numeric CHECK (quantity > 0), created_by, created_at, deleted_at)`, plus: a trigger or CHECK-via-function ensuring `SUM(quantity) WHERE deleted_at IS NULL GROUP BY allocation_line_id` never exceeds that allocation line's `allocated_quantity` (no double allocation); a trigger/FK-pair ensuring the container line's container and the allocation's org/branch agree (branch/org integrity); FORCE RLS matching `inventory_containers`' existing Tier.
- New RPCs as listed above, `SECURITY DEFINER`, following the materialization RPC's established authorization pattern (`p_actor_user_id = auth.uid()` check + `has_branch_permission(..., 'warehouse.inventory.operate')`, EXECUTE revoked from `anon`/`PUBLIC`) — **not** the zero-check pattern found in `inventory_finalize_posting` (DISCOVERY-003, still not to be copied).

### Existing infrastructure reused

`inventory_containers`/`inventory_container_lines` (schema only, per audit §5), the materialization RPC's authorization/transaction pattern as the template for these new RPCs.

### Implementation tasks

- [ ] Migration: `'empty'` status value.
- [ ] Migration: `inventory_allocation_container_links` table + constraints + RLS.
- [ ] `inventory_create_container` RPC: creates header (`reference_type='repair_order'`, `reference_id`) + initial container lines + initial allocation-container links, one transaction.
- [ ] `inventory_add_to_container`/`inventory_remove_from_container` RPCs: quantity-conservation enforced (reject if it would exceed the allocation line's outstanding).
- [ ] `inventory_seal_container` RPC: status transition, permission-gated.
- [ ] Empty-status consistency: container lines hitting zero total quantity → RPC sets `status='empty'`; a non-zero add reverses it back to `'active'`.
- [ ] Service wrapper(s) + typed results.
- [ ] pgTAP: quantity-conservation (reject over-allocation across containers), one allocation line split across 2 containers (the audit's explicit worked scenario — qty 10 → container A qty 6 + container B qty 4), org/branch integrity negative test, empty-status consistency test.
- [ ] Unit tests for service wrappers.

### Testing requirements

- **DB/pgTAP**: quantity-conservation, multi-container split scenario, org/branch integrity, empty-status consistency, RLS.
- **Unit**: service wrapper mapping.

### Acceptance criteria

A real allocation for a RepairOrderLine can be placed into one or more real containers with quantities conserved and no double-allocation, live-verified via MCP against the worked multi-container scenario from decision 7.

### Scope classification

PITCH.

---

## Phase 10D — Container QR

### Objective

Register `inventory.container` as a QR target-registry entry (audit §6) and build the container-scan detail screen.

### Why it exists

Product-owner decision 4: container-level QR is PITCH. The registry pattern is proven and reusable (3 existing target types); this is additive, not a redesign.

### Dependencies

Phase 10C (a container must exist to scan).

### Repository areas affected

- `apps/web/src/server/qr/target-registry.ts` — new `'inventory.container'` entry (`validate()` against `inventory_containers`, `requiredAssignPermission`/`requiredReadPermission = WAREHOUSE_INVENTORY_OPERATE`/`WAREHOUSE_INVENTORY_READ` per decision 5, `resolverPath()`/`getLabelContext()` per the existing 3-entry pattern).
- New container-detail route: code, RepairOrder context, contents, quantities, current location, relevant warehouse actions (per decision 4's explicit minimum).
- Reuses `qr-camera-scanner.tsx` and `resolvePublicQrToken` as-is (audit §19 — positive finding, no new scanner component).

### Supabase changes

None (QR platform has no functions; this is pure app-layer, per audit §6).

### Existing infrastructure reused

`QrCodesService`/`QrAssignmentsService`, `target-registry.ts`, `resolvePublicQrToken`, `qr-camera-scanner.tsx` — all reused verbatim.

### Implementation tasks

- [ ] Add `inventory.container` descriptor to `target-registry.ts`.
- [ ] Build the container-detail screen (code, RepairOrder link, contents/quantities, current location, actions).
- [ ] Wire "assign QR to container" action (reuses `QrAssignmentsService.assignToTarget` / `createAndAssign`).
- [ ] Test: scan → resolves to the correct container detail screen.
- [ ] Test: cross-org/branch denial (live, per the repo's established two-account convention for this class of test).

### Testing requirements

- **Component**: container-detail screen.
- **E2E**: scan → correct detail screen; cross-account denial.

### Acceptance criteria

A real container can be QR-assigned and scanning its code opens its real detail screen with live contents/location, cross-org access proven denied.

### Scope classification

PITCH.

---

## Phase 10E — 801 whole-container relocation

### Objective

Build the container-relocation RPC per decision 1 (container-as-movement-carrier): one atomic operation that posts a real 801 movement for the container's contents AND updates `inventory_containers.current_location_id` together.

### Why it exists

Audit §9/§10: 801 today has no container concept at all (`container_id` exists on `inventory_movement_lines` but is silently dropped by `inventory_create_draft`; nothing writes `current_location_id`). This is genuinely new build, resolved in favor of the movement-carrier design by decision 1.

### Dependencies

Phase 10C (containers must be orchestrated first).

### Repository areas affected

- Migration: extend `inventory_create_draft`'s `jsonb_to_recordset` line shape to accept `container_id` (currently silently dropped, per audit §5/§9) — additive, does not change existing non-container callers' behavior (`container_id` stays nullable and optional).
- New RPC `inventory_relocate_container(p_container_id, p_destination_location_id, p_actor_user_id, ...)`: for each container line, create+finalize an 801 draft (source = current container location, destination = new location, `container_id` tagged per the above), then update `inventory_containers.current_location_id`, all in one transaction. Lock the container row (`SELECT ... FOR UPDATE`) first, per the audit's §17 concurrency recommendation.
- Service wrapper + minimal UI ("scan container → scan destination → confirm").

### Supabase changes

- Migration: `inventory_create_draft` line-shape extension (`container_id` accepted, still optional).
- New RPC `inventory_relocate_container`, `SECURITY DEFINER`, same authorization pattern as Phase 10C's RPCs.

### Existing infrastructure reused

`inventory_create_draft`/`inventory_finalize_posting` (801 category, on_hand effects only — unchanged, per audit §9), extended not replaced.

### Implementation tasks

- [ ] Migration: `inventory_create_draft` accepts optional `container_id` per line.
- [ ] `inventory_relocate_container` RPC: container row lock, one 801 draft+finalize per container line, `current_location_id` update, all atomic.
- [ ] Reject relocation of an `'archived'` container (status guard).
- [ ] Service wrapper.
- [ ] Minimal relocation UI: scan container QR (reuses Phase 10D) → scan/select destination location → confirm.
- [ ] pgTAP: relocation moves both the balance (via the 801 effect rows) and `current_location_id` atomically; a forced failure after the balance move rolls back `current_location_id` too (no partial relocation); archived-container rejection.
- [ ] Unit tests for the service wrapper.

### Testing requirements

- **DB/pgTAP**: atomicity of balance+pointer update together, archived-container rejection.
- **Unit**: service wrapper.
- **E2E**: scan → scan destination → confirm → container detail screen (Phase 10D) reflects the new location and the movement appears in history.

### Acceptance criteria

A real container relocation moves real `inventory_balances` rows for its contents AND updates `current_location_id`, atomically, live-verified via MCP; no code path can update one without the other.

### Scope classification

PITCH.

---

## Phase 10F — 201/WZ issue from container

### Objective

Implement the WU (201/WZ) movement type per `07-normal-issue-and-legacy-stock-design.md`'s already-accepted contract, and wire "issue from a specific container" against an allocation.

### Why it exists

Closes the pitch chain's final link: physical issue. The movement-code contract (201, category=issue, doc type=WZ, source/on_hand decrease) was already designed and accepted in Turn 7/8's design pass — this phase implements it, scoped now to include container sourcing per this turn's expanded scope.

### Dependencies

Phase 10C (containers), Phase 10E (relocation, not strictly required for issue itself but establishes the RPC-authorization pattern this phase reuses), the accepted WU design doc.

### Repository areas affected

- Migration: seed the `201`/`WZ` movement type + document type (per the accepted design doc's exact contract — not re-derived here).
- New RPC (or extension of the existing generic posting flow) for issuing against a container: decrements the container line's `quantity` (audit §15), increments `allocation_lines.fulfilled_quantity` (audit's critical live finding — **must not** re-touch `reservation_lines.fulfilled_quantity`, per the standing "avoid double counting" rule and Phase 10B's explicit test), writes `repair_order_line_movement_links` (`relation_type='issue'`, existing Zone 3 table).
- Over-reservation override path per decision 5: requires `warehouse.inventory.adjust` + explicit UI confirmation + mandatory reason, persisted on the movement/audit record.

### Supabase changes

- Migration: `201`/`WZ` movement type + document type seed (per the accepted design doc).
- New RPC/extension for container-sourced issue, `SECURITY DEFINER`, same authorization pattern as Phase 10C/10E.

### Existing infrastructure reused

Generic movement engine (`inventory_create_draft`/`inventory_finalize_posting`, on_hand effects), `repair_order_line_movement_links` (already live, Zone 3), the override-permission pattern from decision 5.

### Implementation tasks

- [ ] Migration: seed 201/WZ per the accepted design doc.
- [ ] RPC: issue-from-container — decrements container line quantity, increments allocation line `fulfilled_quantity` only, writes the movement + `repair_order_line_movement_links` row, all atomic.
- [ ] Container reaching zero contents → `status='empty'` (reuses Phase 10C's consistency rule).
- [ ] Over-reservation override path: `warehouse.inventory.adjust` gate + mandatory reason + explicit confirmation UI.
- [ ] Explicit test: issuing against an allocation does NOT double-decrement the parent reservation's `fulfilled_quantity` (the audit's critical live finding, now proven end-to-end).
- [ ] pgTAP: normal issue, over-issue rejected without override, over-issue succeeds with override + reason recorded, container empties correctly, `repair_order_line_movement_links` correctly written.
- [ ] Service wrapper + unit tests.

### Testing requirements

- **DB/pgTAP**: normal issue, override path, double-counting disproof, empty-container transition, movement-link correctness.
- **Unit**: service wrapper.
- **E2E**: full chain — reserve → allocate → container → relocate (optional) → issue → RepairOrderLine's `available_for_issue`/issue history reflect it correctly.

### Acceptance criteria

A real WU issue against a real container decrements the right balances exactly once (no double-counting against the reservation), correctly attributes to the RepairOrderLine, and the override path is provably gated and audited. Live-verified via MCP.

### Scope classification

PITCH.

---

## Phase 11 — Magazyn / Zamówienia-Przyjęcia UI/read models

### Objective

Build the two named sub-views under the RepairOrder detail's warehouse tab: "Magazyn" (current/available stock view) and "Zamówienia-Przyjęcia" (ordered/receiving view), per the architecture doc's conceptual read-model description.

### Why it exists

Named pitch surface in the frozen audit and the architecture doc's Architecture implications section (conceptual read-model, no UI implementation specified there — this phase is the implementation).

### Dependencies

Phase 9, Phase 10.

### Repository areas affected

- New UI components under the Workshop detail route for the two sub-tabs.

### Supabase changes

None beyond prior phases.

### Existing infrastructure reused

Read-model service methods from Phase 8/9/10.

### Implementation tasks

- [ ] Build "Zamówienia-Przyjęcia" sub-view: per-line ordered vs. received vs. `outstanding_to_receive`, with drill-down to the specific receipt-movement-lines and source documents behind each.
- [ ] Build "Magazyn" sub-view: per-line `available_for_issue`, current location(s) if tracked, with drill-down to issue history.
- [ ] Component tests for both sub-views.
- [ ] E2E: partial-receipt/issue-attribution-per-line scenario rendered correctly across both sub-views.

### Testing requirements

- **Component**: both sub-views.
- **E2E**: the named partial-attribution scenario.

### Acceptance criteria

Both sub-views render real, persisted, correctly-attributed data for a representative multi-document, multi-receipt RepairOrder.

### Scope classification

PITCH.

---

## Phase 12 — Attachments

### Objective

Register `workshop.repair_order` as a new target type in the existing generic attachments system.

### Why it exists

Former Zone 9 audit: infrastructure is ready and reusable, blocked only on RepairOrder existing. This phase removes that block.

### Dependencies

Phase 6/7 (a real RepairOrder with a stable id to attach to).

### Repository areas affected

- `apps/web/src/server/comments/target-registry.ts` — add `workshop.repair_order` entry, `validate()` checking org/branch-scoped existence.
- New migration: SQL function body copy adding the `workshop.repair_order` branch to `can_access_comment_target` (REPO VERIFIED pattern: full-body-copy migrations for `ticket`/`task`/`kanban_card` — follow the same pattern, do not attempt a partial/generic rewrite of the function in this phase).
- Detail view: add "Załączniki" section rendering the existing, unmodified `AttachmentsPanel` with `targetType="workshop.repair_order"`.

### Supabase changes

- New migration replacing `can_access_comment_target`'s body to add the `workshop.repair_order` IF-branch (REPO VERIFIED pattern from `20260604170000_generic_app_comments.sql`, `20260604173000_comments_planning_task_target.sql`, `20260605170000_planning_kanban_card_details.sql`).

### Existing infrastructure reused

Entire generic attachments stack: `app_attachments`, `attachments.service.ts`, `file-response.ts`, `AttachmentsPanel` — REUSED VERBATIM, no new component per the frozen audit's explicit instruction ("bez tworzenia nowego, dedykowanego komponentu").

### Implementation tasks

- [ ] Add `workshop.repair_order` descriptor to `target-registry.ts`.
- [ ] Write and apply the `can_access_comment_target` migration adding the new branch.
- [ ] Add minimal read/attachment permission requirement consistent with Phase 7's permission model.
- [ ] Render `AttachmentsPanel` on the detail view.
- [ ] Test: upload/list/download works for a RepairOrder attachment.
- [ ] Test: cross-org/cross-branch access denial (live, two-account test per the frozen audit's explicit "sprawdzone na żywo dwoma kontami" instruction, not just inferred from code).

### Testing requirements

- **DB/RLS**: `can_access_comment_target` new branch behaves correctly (positive + negative).
- **E2E**: upload → list → download → cross-account denial.

### Acceptance criteria

A real signed delivery-document image can be uploaded to and retrieved from a real RepairOrder, with unauthorized access proven denied live.

### Scope classification

PITCH.

---

## Phase 13 — Pitch E2E and DEMO READY verification

### Objective

Run the full pitch scenario end-to-end on real, persisted data and formally evaluate the DEMO READY gate.

### Why it exists

The architecture doc and work order both require this as the pitch gate — no partial/mocked substitute is acceptable.

### Dependencies

All of Phases 0A–12, including 10A–10F (reservation/allocation/container/container-QR/801-relocation/WU-issue — added 2026-09-10 per the container-workflow scope expansion; the pitch E2E scenario must exercise the full `RepairOrderLine → Reservation → Allocation → Container → QR → relocation → WU issue` chain, not just the materialization/read-model surface Phases 0A–12 originally covered).

### Repository areas affected

- E2E spec(s) under `e2e/workshop/` (new directory, following the existing `e2e/<domain>/<name>.spec.ts` convention).

### Supabase changes

None (verification phase).

### Existing infrastructure reused

Playwright fixtures pattern from `auth`/`organization`/`warehouse` (REPO VERIFIED as the only domains with specs today — Workshop becomes the next).

### Implementation tasks

- [ ] Write the representative E2E: approve a Matcher session with multiple `zl_number` values and multiple source documents → materialize → search for a resulting order by `zl_number`/VIN/`order_number` → view header/lines/provenance/warehouse sub-views → attach a document → verify cross-branch denial.
- [ ] Run full pitch checklist from `docs/mvp/zones/03-repair-orders-progress.md`'s DEMO READY gate (see progress tracker) and check off each item with evidence.
- [ ] Manual rehearsal on demo-representative data (not synthetic minimal fixtures) — record outcome in the progress tracker, not here.

### Testing requirements

- **E2E**: the full representative scenario above.

### Acceptance criteria

Every item in the DEMO READY gate (progress tracker) is checked with evidence; manual rehearsal performed and recorded.

### Scope classification

PITCH (this phase IS the pitch gate).

---

## Phase 14 — Pilot bootstrap functionality

### Objective

Build the PILOT-only functionality: `repair_order_legacy_records`, manual **line** entry (manual RepairOrder _header_ creation is PITCH scope — see Phase 7, corrected 2026-09-10), comments (pilot-only per architecture doc), legacy/external issue record path, and real AutoStacja import hardening.

### Why it exists

Separates pitch-critical scope from pilot-hardening scope, per the architecture doc's explicit Final controlled-pilot scope section.

### Dependencies

Phase 13 (pitch complete first).

### Repository areas affected

- New migration for `repair_order_legacy_records`.
- Manual line-entry UI/service extensions.
- Comments target registration (reusing `target-registry.ts` again, comments infra — TO VERIFY DURING PHASE whether comments infra is already generic-ready like attachments or needs its own closure work).

### Supabase changes

- New table `repair_order_legacy_records` (PILOT-only, per the architecture doc's authoritative inventory).

### Existing infrastructure reused

Generic comments infrastructure (if it mirrors the attachments pattern — TO VERIFY DURING PHASE).

### Implementation tasks

- [ ] Migration + RLS for `repair_order_legacy_records`.
- [ ] Manual RepairOrder **line** creation/editing flow (no Matcher origin) for an existing RepairOrder header (manual or materialized) — NOT header creation, which is PITCH scope (Phase 7).
- [ ] Comments target registration for `workshop.repair_order`.
- [ ] Legacy/external issue record path (TO VERIFY DURING PHASE exact product requirement — not fully detailed in the architecture doc's current text, flag for product-owner confirmation before building if ambiguous).
- [ ] AutoStacja import hardening scenarios beyond the pitch's representative case.
- [ ] Tests per each of the above.

### Testing requirements

Per-feature unit/service/component/E2E as each is built (test-as-you-go rule).

### Acceptance criteria

Each PILOT-only feature individually tested and demonstrably working on real persisted data.

### Scope classification

PILOT.

---

## Phase 15 — Pilot hardening and PILOT READY verification

### Objective

Close the remaining pilot-gate requirements: concurrency, idempotency proof, real RLS integration tests, multi-user tests, migration reproducibility confirmation, audit/reconcile path, pilot E2E, representative roles, manual pilot scenario. **Also where full historical migration-tree reconciliation (deferred from Phase 0A per the 2026-09-10 scope correction) is revisited and confirmed necessary or not for PILOT READY** — not assumed necessary by default; re-evaluate against actual pilot risk at that time.

### Why it exists

Formal PILOT READY gate per the work order and architecture doc.

### Dependencies

Phase 14.

### Repository areas affected

- Additional test suites across DB/RLS/service/E2E layers.
- Live-DB RLS integration test pattern (`SetupClient`/`RlsClient`, REPO VERIFIED currently only exists for org-membership — Zone 3 becomes the first P0 domain table to get this treatment).

### Supabase changes

None new expected — this phase proves the existing schema/RPCs hold up under concurrency/multi-user load, it does not add new tables.

### Existing infrastructure reused

`SetupClient`/`RlsClient` live-DB integration pattern.

### Implementation tasks

- [ ] Concurrency test suite: simultaneous materialization, simultaneous approval, simultaneous advisor reassignment.
- [ ] Idempotency proof suite: every duplicate-prevention scenario named in the architecture doc's testing strategy, run against live DB not just mocks.
- [ ] Real RLS integration tests (live DB, `SetupClient`/`RlsClient`) for all eight tables.
- [ ] Multi-user test: two advisors/two warehouse workers operating on the same order simultaneously.
- [ ] Migration reproducibility re-confirmation (fresh clone replay matches live, per Phase 0A's ongoing guarantee).
- [ ] Audit/reconcile path test: post-approval Matcher correction triggers the explicit reconcile action, old provenance preserved, `platform_events` recorded.
- [ ] Pilot E2E covering representative pilot roles.
- [ ] Manual pilot scenario rehearsal, recorded in the progress tracker.

### Testing requirements

All of the above, run against live/staging DB where the architecture doc calls for DB-level (not mocked) proof.

### Acceptance criteria

Every item in the PILOT READY gate (progress tracker) checked with evidence.

### Scope classification

PILOT (this phase IS the pilot gate).

---

## Change log

- **2026-09-10**: Initial plan created from the approved `docs/mvp/zones/03-repair-orders.md` architecture (correction pass + final clarification pass). No implementation started yet at time of writing.
- **2026-09-10 (same day, later)**: Product-owner scope correction — full migration-history reconciliation demoted from Phase 0A hard blocker to accepted technical debt, deferred to Phase 15. Phase 0A narrowed and closed same day (see `03-repair-orders-phase0a-baseline.md`). Phase 0B closed (permission-file location resolved). Phase 2 (database schema, constraints, RLS) implemented and applied live: migration `20260910061711_repair_orders_core_schema.sql` — all 7 PITCH tables, business-identity partial unique index on `zl_number`, corrected `workshop_source_documents` natural key (incl. `source_session_id`), CRM advisor-model extension (`crm_contacts` unique index, `crm_party_roles` `employee` role), FORCE RLS on all 7 tables, 3 new permission slugs seeded. Types regenerated (`packages/supabase/src/database.types.ts`) and permission constants added (`packages/contracts/src/permissions.ts`). Phase 1 (domain contracts) marked done prematurely and Phase 2 marked done without its required tests — both corrected in the same-day follow-up entry below.
- **2026-09-10 (same day, correction pass)**: Consistency correction pass per explicit product-owner review. (1) Phase 2 demoted to 🔵 IN PROGRESS until its required pgTAP/RLS tests existed and passed, then genuinely completed: `pgtap` extension installed live (`20260910071815_enable_pgtap_extension.sql`), 25 pgTAP tests written and executed live against `supabase-target` (25/25 passing, verified zero residual test data after rollback — `apps/web/supabase/tests/090_repair_orders_schema_test.sql`), `repair_orders.status` corrected to `open`/`closed`/`archived` via a new forward migration `20260910071755_repair_orders_status_archived.sql` (the original applied migration was left untouched, per the "never edit an already-applied migration in place" rule). (2) Phase 1 completed for real: hand-written domain/read-model TypeScript layer at `apps/web/src/lib/types/repair-orders.ts` (all 7 entity types, `RepairOrderLegacyRecord` stub, `RepairOrderLineQuantities` + pure derivation function, literal unions + type guards, `canTransitionRepairOrderStatus`), 16/16 unit tests passing, `tsc --noEmit` clean. (3) Manual RepairOrder **header** creation moved from Phase 14 (PILOT) to Phase 7 (PITCH) — DEMO READY gate requirement, RepairOrders must not depend exclusively on Matcher import; manual **line** entry confirmed to remain PILOT/Phase 14. (4) Approve→Materialize UX resolved: normal path is automatic materialization immediately on approval (no second button); exception path preserves the `approved` state and exposes an idempotent "Retry Materialization" action. (5) Self-caught and corrected a migration-version/local-filename mismatch discovered while writing the pgTAP tests (local files were named with the write-time-guessed timestamp, not the actual live-reported `schema_migrations` version) — see progress tracker DISCOVERY-001. Total task count recomputed from the fully-detailed plan: 125 (the earlier 176 was a rough upfront estimate before every phase had granular tasks), 35 now complete. Phase 3 is now genuinely the next task — both its prerequisites (Phase 1, Phase 2) actually meet their own acceptance criteria.
- **2026-09-10 (container-workflow scope expansion + Phase 3 completion pass)**: Product-owner directive: the full physical container workflow (`RepairOrderLine → Reservation → Allocation → Container → Container QR → Container location → 801 relocation → WU 201/WZ → issue history`) is now **PITCH**, superseding the container audit's own PILOT classification (which was based solely on the then-active pitch script). Generic reversal and Legacy Stock 105/PZ-I remain PILOT, unchanged. Seven frozen architecture decisions recorded in the new "Container/Reservation/Allocation architecture decisions" section (container-as-movement-carrier relocation; reservation-before-allocation as the normal RepairOrder path; container ownership via the existing generic reference pattern, one RepairOrder : many containers; container-only QR via the existing target-registry, no new column; permission reuse — `warehouse.inventory.operate` normal, `warehouse.inventory.adjust` + confirmation + reason for over-reservation issue; explicit `'empty'` container status kept consistent with contents; a dedicated quantity-bearing `inventory_allocation_container_links` entity instead of inference or a bare FK, supporting one-allocation-to-many-containers and one-container-to-many-allocations). Six new implementation phases added (10A Reservation integration, 10B Allocation integration, 10C Container orchestration, 10D Container QR, 10E 801 whole-container relocation, 10F 201/WZ issue from container), inserted between the existing Phase 10 and Phase 11 to avoid renumbering every cross-reference in the plan; Phase 13's dependency list updated to include them. A "smallest consistent proposal" for RepairOrder-close blocking on outstanding reservations/allocations/non-empty containers (with an explicit, auditable override path reusing `warehouse.inventory.adjust` and the existing release RPCs, never deleting history) documented under Phase 7, implementation deferred until 10A–10C exist to check against — explicitly not a Phase 3 blocker. Separately: **Phase 3 completed** — an authorization-denial pgTAP test was added (an authenticated, non-spoofed actor with zero `workshop.repair_orders.*` permission grants is rejected by the RPC's own `has_branch_permission` check, not merely by RLS; the prior suite only tested actor-_identity_ spoofing, not actor-_permission_ absence), bringing the RPC test suite to 17/17 passing, all re-verified live this session via a single aggregated-assertion query against `supabase-target`. `pnpm type-check` reconfirmed clean. Phase 3 moved from 🔵 IN PROGRESS to ✅ DONE: every criterion in its own acceptance-criteria list is now met, including the "realistic concurrency / duplicate invocation behavior" bar (row lock + idempotent replay); genuine two-connection concurrent-execution proof remains explicitly assigned to Phase 15 (pgTAP/MSW-Vitest tooling cannot express it), which was already the standing plan and is treated as a Phase 15 test-infrastructure item, not a re-opened Phase 3 gap.
