# Zone 3 Phase 10 — Changed Files Manifest

Baseline: `HEAD` at `0475bcd8` ("phase 9 complete"), working tree clean before this phase started (verified via `git status --short` at both the start and end of this phase — see `review-context.md` §S).

Diff scope: **only** Phase 10 files. No Phase 9, 10A-10F, Zone 5, Zone 8, Zone 11, or unrelated-repo changes are included. Cross-validated against `zone3-phase10.diff`'s own `diff --git` headers — 8/8 match exactly, no extra, none missing.

## Modified (5)

### `apps/web/src/server/audit/event-registry.ts`

Added one new registry entry, `workshop.repair_orders.movement_attributed` (Mode A, `category: "STATE"`, `intent: "CREATE"`), following the exact shape of the sibling `workshop.repair_orders.*` entries already in this file. No existing entry modified.

### `apps/web/src/server/services/repair-orders.service.ts`

Added: `REPAIR_ORDER_MOVEMENT_LINK_KNOWN_ERRORS` (12-entry code+message-pattern allowlist) + `normalizeMovementLinkRpcError`; `RepairOrderLineMovementAttachment` type; `RepairOrdersService.attachMovementToRepairOrderLine` (new static method — calls `attach_repair_order_line_movement`, maps the jsonb result, emits `workshop.repair_orders.movement_attributed` Mode A). No existing method, type, or normalizer modified.

### `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`

Added one new `describe("RepairOrdersService.attachMovementToRepairOrderLine")` block (18 tests: RPC param mapping, jsonb→domain mapping, event emission on success, best-effort-on-emit-failure, RPC-error → no emission, a 12-case `it.each` over the full known-error allowlist, unexpected-error non-leakage, same-errcode-different-message non-leakage). No existing test modified.

### `docs/mvp/zones/03-repair-orders-implementation-plan.md`

Rewrote the Phase 10 section only (objective/dependencies/repository-areas/Supabase-changes/existing-infrastructure/implementation-tasks/testing-requirements/acceptance-criteria unchanged in structure, content updated to reflect what was actually verified/built) and added a verify-first note at the top of that section. No other phase's section touched.

### `docs/mvp/zones/03-repair-orders-progress.md`

Updated: the `Current phase` and `Runtime status` header lines; the `Overall execution` completed/pitch-required task counts (87/165 → 94/166; 87/151 → 94/152); the Phase 10 row in the phase table; appended one new change-log entry at the end of the file. No other phase's row or change-log entry touched.

## Added (3)

### `apps/web/supabase-target/supabase/migrations/20260912162802_repair_order_line_movement_attach_rpc.sql`

New migration: `attach_repair_order_line_movement(p_actor_user_id, p_repair_order_line_id, p_inventory_movement_line_id, p_applied_quantity, p_relation_type) RETURNS jsonb`, `SECURITY DEFINER`, hardened `search_path`. Applied live via MCP (`mcp__supabase-target__apply_migration`) as version `20260912162802`.

### `apps/web/supabase-target/supabase/migrations/20260912162827_repair_order_line_movement_attach_rpc_revoke_anon.sql`

Corrective same-session follow-up migration: `REVOKE ALL ... FROM anon` on the new function, after live-discovering this project's schema default-privileges rule grants EXECUTE on newly created functions directly to `anon` (a separate grant, not via `PUBLIC`) — confirmed via `pg_proc.proacl` before/after, and confirmed to now exactly match the two sibling RPCs' own live grant shape. Applied live via MCP as version `20260912162827`.

### `apps/web/supabase/tests/097_repair_order_line_movement_attach_phase10_test.sql`

New pgTAP suite, 21 assertions, executed live against `supabase-target` as the `authenticated` role inside a transaction-scoped `BEGIN ... ROLLBACK` (zero residual data). Every positive assertion calls the real `attach_repair_order_line_movement` RPC against real fixture `inventory_movement_lines`/`inventory_movement_headers` rows created by the test itself.

## Cross-validation

- File count: **8** (5 modified + 3 added), matching this manifest's own count and the diff's 8 `diff --git` headers exactly.
- `zone3-phase10.diff`: 1265 lines, 101669 bytes.
- Baseline: `HEAD` (`0475bcd8`) — no worktree reconstruction needed (Phase 9 was already committed at session start; working tree was clean before this phase's first edit, confirmed via `git status --short`).
- Packaging verification: `git status --short` immediately after generating the diff (via `git add` + `git diff --cached HEAD` + `git restore --staged .`) shows the exact same 8 changed/untracked paths as before packaging began, plus this review bundle's own new files — confirming diff generation did not alter, stage, or commit any implementation file.
