# Normal Issue (WU) Movement — Architecture Audit

> **READ-ONLY AUDIT. Nothing in this document has been implemented.** No migrations were created or applied, no application code was changed, Supabase MCP was used strictly read-only throughout. This document exists to determine how a normal parts-issue movement (AutoStacja "WU" equivalent) should be represented inside Ambra's existing inventory movement engine — without redesigning that engine.
>
> Evidence classification: **LIVE VERIFIED** (confirmed via Supabase MCP against `supabase-target`, `rjeraydumwechpjjzrus`), **REPO VERIFIED** (confirmed from repository code/migrations), **UNRESOLVED** (not yet provable / needs a product decision).
>
> Date: 2026-09-10.

---

## Current Ambra Movement Architecture

The inventory movement engine is **config-driven, not code-driven**. This is the single most important fact for the WU design: adding a new movement type does not mean writing new posting logic — it means inserting new rows into two config tables that an already-generic posting function reads.

**Core tables** (LIVE VERIFIED, all exist on `supabase-target`):

| Table                             | Role                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_movement_types`        | **Configuration rows**, not an enum. One row per `(organization_id, code)`. Carries `code`, `name`/`name_pl`/`name_en`, `category`, `cost_impact` (`increase`/`decrease`/`neutral`), `requires_source_location`, `requires_destination_location`, `requires_reference`, `requires_note`, `is_system`, `allows_manual_entry`, `is_active`, `document_type_id` (FK).                       |
| `inventory_movement_type_effects` | **Declarative stock-effect rules**, one or more rows per movement type: `target` (`source`/`destination`), `balance_field` (`on_hand`), `direction` (`increase`/`decrease`), `is_required`, `effect_order`. This is what the posting function loops over — it contains zero movement-type-specific logic itself.                                                                         |
| `inventory_document_types`        | Document numbering family (`PZ`, `MM`, `INW`), each with a `numbering_template` (e.g. `'PZ/{year}/{seq:6}'`).                                                                                                                                                                                                                                                                            |
| `inventory_document_sequences`    | Per-`(organization_id, document_type_id, branch_id, series, year)` counter (`next_number`). Unique index coalesces `branch_id`/`series` to a sentinel, so a NULL-branch "org-wide" sequence and a real per-branch sequence can coexist under the same uniqueness rule — but see the 101 trace below: today's `inventory_finalize_posting` only ever queries the `branch_id IS NULL` row. |
| `inventory_movement_headers`      | One row per movement (draft or posted). `status` (`draft`/`posted`/`cancelled`, cancellation LIVE VERIFIED as draft-only — see Reversal section), `reference_type`/`reference_id` (free-text, generic), `idempotency_key`, `original_movement_id`/`reversal_movement_id`/`reversed_by`/`reversed_at` (schema-ready for reversal — **no RPC populates these yet**, see below).            |
| `inventory_movement_lines`        | One row per line: `variant_id`, `source_location_id`/`destination_location_id`, `quantity`, `unit_cost`, `lot_id`/`serial_id`/`container_id` (nullable FK — **containers already integrate at the line level**), five `snapshot_*` display columns frozen at posting time.                                                                                                               |
| `inventory_movement_audit_log`    | **Movement-domain's own dedicated audit table** — not `platform_events`. `action`, `old_status`/`new_status`, `entity_type`/`entity_id`, `changes` (jsonb), `actor_user_id`, `reason_code`/`reason_text`, `transaction_id`.                                                                                                                                                              |

**Answers to the numbered questions:**

2. **Role of each concept**:
   - **movement code** (`inventory_movement_types.code`, e.g. `"101"`) — the business-facing identifier, a plain `text` column, per-organization, seeded not hardcoded.
   - **`movement_type`** — not a separate concept from "code" in this schema; `inventory_movement_types` _is_ the movement-type table, and `code` is its natural key. There is no separate `movement_type` enum column anywhere.
   - **`movement_kind`** — does not exist as a distinct column/concept anywhere in the live schema or repo. The closest live analogue is `inventory_movement_types.category` (`receipt`/`transfer`/`adjustment`/`bin_operation` — LIVE VERIFIED, the only four values currently seeded) combined with `cost_impact` (`increase`/`decrease`/`neutral`).
   - **`document_type`** — a genuinely separate concept (`inventory_document_types`): a movement type points at exactly one document type, but a document type can be shared by more than one movement type (e.g. both `401` and `402` share `INW`).
   - **movement header** — one row per movement transaction (the "document"), draft-or-posted.
   - **movement line** — one row per stock-affecting entry under a header; posting logic operates line-by-line.

3. **Are 101/401/402 literal codes, config rows, enum values, document codes, or accounting semantics?** **Configuration rows.** LIVE VERIFIED: `inventory_movement_types.code` is `text`, not backed by any Postgres enum or CHECK constraint restricting its values (REPO/LIVE VERIFIED — no `CHECK (code IN (...))` found on this table). New codes are added by inserting new config rows (exactly what `inventory_seed_movement_types_internal` does) — never by an enum migration.

4. **Where are they defined?** Exclusively in **DB seed data**, written by the RPC `inventory_seed_movement_types_internal(p_organization_id, p_actor_user_id)` (SECURITY DEFINER, REPO/LIVE VERIFIED full body retrieved) — no hardcoded reference to `"101"`/`"401"`/`"402"` exists in `inventory_finalize_posting`, `inventory_create_draft`, or any other posting-path function. Application code (services/UI) references movement types by looking them up by `code` at call time, not by embedding the code as a constant in business logic (though the UI's movement-type picker component presumably lists them — not traced in this pass, out of scope).

## Existing Movement Codes (LIVE VERIFIED, complete list)

| Code    | Name                                  | `category`      | `cost_impact` | Stock effect (from `inventory_movement_type_effects`)                              | Document type                | Used in UI/services?                                                                                                                        |
| ------- | ------------------------------------- | --------------- | ------------- | ---------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **101** | Goods Receipt (PZ)                    | `receipt`       | `increase`    | `destination` +on_hand (required)                                                  | `PZ` (`PZ/{year}/{seq:6}`)   | Yes — Zone 3's own Phase 10 will link into this; general warehouse receiving flow (not re-traced this pass, established in prior sessions). |
| **311** | Inter-Branch Transfer Out             | `transfer`      | `neutral`     | `source` −on_hand (required)                                                       | `MM`                         | REPO VERIFIED to exist (`add_inter_branch_movement_contract` migration); not traced this pass.                                              |
| **401** | Inventory Count Adjustment (Increase) | `adjustment`    | `increase`    | `destination` +on_hand (required)                                                  | `INW` (`INW/{year}/{seq:6}`) | Yes — Inventory Audits workflow.                                                                                                            |
| **402** | Inventory Count Adjustment (Decrease) | `adjustment`    | `decrease`    | `source` −on_hand (required)                                                       | `INW`                        | Yes — Inventory Audits workflow.                                                                                                            |
| **801** | Bin-to-Bin Move (MMZ)                 | `bin_operation` | `neutral`     | `source` −on_hand, then `destination` +on_hand (both required, `effect_order` 1/2) | `MM`                         | Not re-traced this pass.                                                                                                                    |

**No issue/WU/outbound-consumption code exists anywhere — seeded, dormant, or referenced.** This is a direct, definitive answer to primary questions 5–8: the seed function above is the single, exhaustive source of every movement type this system creates, and it defines exactly these five codes. A full-repo/full-schema search found:

- No `inventory_movement_types` row with `category` other than the four values above (`receipt`/`transfer`/`adjustment`/`bin_operation`) — no `issue`/`consumption`/`outbound` category exists.
- No function, migration, or seed data referencing a `"501"`/`"601"`/`"WU"`/`"wydanie"` movement code.
- No dormant/historical code path in `apps/web/src` for a normal/outbound issue, WU, consumption, customer issue, or workshop issue (targeted grep across services/actions found no genuine match beyond incidental unrelated word matches).

**Conclusion for question 7 (correct architectural way to add one)**: add a new `inventory_movement_types` row (new `code`, e.g. `"601"`, `category = 'issue'` — a **new category value**, since none of the four existing ones semantically fit an outbound consumption movement) with exactly one `inventory_movement_type_effects` row (`target = 'source'`, `balance_field = 'on_hand'`, `direction = 'decrease'`, `is_required = true`), plus a new `inventory_document_types` row (e.g. `code = 'WU'`, `numbering_template = 'WU/{year}/{seq:6}'`). **Zero changes to `inventory_create_draft` or `inventory_finalize_posting` are required** — both are already fully generic over whatever `inventory_movement_types`/`inventory_movement_type_effects` rows exist. This is the central, load-bearing finding of this audit.

## 101 Flow (full call chain, LIVE VERIFIED via `pg_get_functiondef`)

```
UI (movement-type-picker.tsx → warehouse receiving flow, not re-traced this pass)
  → server action (not re-traced this pass — established convention: action calls service, service calls RPC via supabase.rpc())
    → inventory_create_draft(p_organization_id, p_branch_id, 'movement_type_code' = '101', p_lines jsonb, ...)
        • SET LOCAL ambra.inventory_movement_engine = 'on'  — a session flag, presumably read by a trigger/RLS check elsewhere (not traced further this pass — flag its existence for WU's own draft path to replicate)
        • idempotency: if p_idempotency_key already exists for this org → return the EXISTING draft, no new row (idempotent by design, not by client-side guard)
        • looks up inventory_movement_types WHERE organization_id=... AND code='101' AND is_active=true — 404s with a clear exception if not found/inactive
        • validates p_lines is non-empty
        • validates requires_reference/requires_note against the movement type's own flags
        • generates draft_number from inventory_settings (org-scoped counter, locked FOR UPDATE, format "<prefix>-<seq:6>") — NOTE: this is the DRAFT number, distinct from the eventual DOCUMENT number assigned at posting time
        • INSERTs one inventory_movement_headers row, status='draft'
        • loops p_lines (jsonb_to_recordset): validates quantity > 0; validates source/destination location exists+belongs to branch+is stockable, per the movement type's requires_source_location/requires_destination_location flags; INSERTs one inventory_movement_lines row per line
        • INSERTs one inventory_movement_audit_log row (action='created', new_status='draft')
        • returns {movement_id, draft_number, status:'draft'}
    → [later, separate call] inventory_finalize_posting(p_movement_id, p_actor_user_id)
        • SET LOCAL ambra.inventory_movement_engine = 'on'
        • SELECT ... FOR UPDATE on the header (row lock — concurrency boundary)
        • if status='posted' already → returns the existing result (idempotent no-op, does NOT error)
        • if status not 'draft' (and not already 'posted') → RAISE EXCEPTION
        • looks up the movement type + its document type
        • locks inventory_settings FOR UPDATE (unrelated to this specific document-number step, reused from draft-numbering path)
        • ensures an inventory_document_sequences row exists for (org, document_type_id, year) — branch_id IS NULL, series IS NULL — via INSERT ... ON CONFLICT DO NOTHING, then SELECTs it FOR UPDATE
        • computes document_number = "<doc_type_code>/<year>/<next_number padded to 6>" from the type's numbering_template pattern, increments next_number
        • freezes snapshot_* columns on every line (product name/SKU/unit code/location names) via subqueries — this is what makes a posted line's display data immutable even if the underlying product/location is later renamed
        • loops every line, then loops inventory_movement_type_effects for this movement_type_id ORDER BY effect_order — for 101 this is exactly one row: target='destination', balance_field='on_hand', direction='increase'
            - resolves/creates the balance row via inventory_v1_get_or_create_balance(org, branch, location_id, variant_id)
            - computes new_qty = current + line.quantity (for 'increase') — for 101, destination location's on_hand increases by the line quantity
            - blocks negative resulting stock only when direction='decrease' and inventory_settings.negative_stock_policy='block' (not relevant to 101's own increase-only effect, but this is the exact mechanism that will matter for WU)
            - UPDATEs inventory_balances (on_hand_quantity, last_movement_id, last_movement_at)
            - INSERTs one inventory_stock_ledger_entries row per line per effect (organization/branch/location/variant, movement_id, movement_line_id, movement_type_code, document_number, document_type_code, effect_id, balance_field, direction, quantity, balance_after, unit_cost/currency, posted_at) — this is the append-only ledger
        • UPDATEs the header: status='posted', document_number, document_type_code, posted_at, posted_by=p_actor_user_id
        • INSERTs one inventory_movement_audit_log row (action='posted', old_status='draft', new_status='posted', reason via changes jsonb built from document_number)
        • returns {movement_id, document_number, status:'posted'}
```

**Exact mechanics answered:**

- **Stock sign/direction**: entirely driven by `inventory_movement_type_effects.direction` — never hardcoded per movement code in the posting function.
- **Permission checks**: enforced by RLS (see Permissions section), not inside the RPC body itself for `inventory_finalize_posting` (LIVE VERIFIED: no `has_permission`/`has_branch_permission` call in its body — **it relies entirely on RLS + the caller's own prior authorization to reach this point**, a genuine gap noted below).
- **Transaction boundary**: the entire draft-creation call is one transaction; the entire finalize call is one transaction (both are single SECURITY DEFINER function invocations, each executing in one implicit transaction unless the caller wraps multiple RPC calls in an explicit outer transaction, which application code does not appear to do — draft and finalize are two separate top-level calls, meaning a crash between them leaves a valid, resumable `draft` — not a torn write).
- **Idempotency**: `p_idempotency_key` on create (exact re-call returns the same draft, no duplicate); finalize is naturally idempotent because it checks `status='posted'` first and returns the same result rather than re-posting.
- **Audit/history**: `inventory_movement_audit_log` (create+post events) plus `inventory_stock_ledger_entries` (the actual balance-change ledger, one row per line per effect) plus the frozen `snapshot_*` columns on the line itself.

## 401 / 402 Flow

Both share the `INW` document type and the `adjustment` category; both exist because a physical inventory count can produce **either** a surplus (found more than the system expects → `401`, `destination` +on_hand) **or** a shortfall (found less → `402`, `source` −on_hand) — they are the two directions of the same reconciliation act, not two names for one thing. `402` additionally `requires_source_location = true` (must name where the missing stock was expected) while `401` requires only a destination (where the found surplus is being recorded). Both use the identical posting path traced above — the only difference in behavior is which `inventory_movement_type_effects` row applies.

**Should 401/402 ever be reused for a normal issue? No — proven from the architecture, not asserted:**

1. **Semantic mismatch**: `cost_impact`/`category = 'adjustment'` exists specifically to mark these as reconciliation-only in reporting/accounting terms (LIVE VERIFIED distinct `category` value from `receipt`/`transfer`/`bin_operation`) — reusing `402` for a real sales/consumption issue would silently misclassify every such movement as an "inventory count shortage" in any report or accounting rollup keyed on `category`.
2. **No RepairOrder/customer linkage semantics**: `402`'s `requires_reference = false` — the type is not designed to demand a reference at all, whereas a real issue conceptually always has a real-world referent (a RepairOrder, a sales order). Reusing it would mean either leaving that reference optional (losing traceability) or bolting reference-requirement logic onto a type whose whole `is_system` config says "count adjustment."
3. **No distinct permission boundary**: both are gated by the same `warehouse.inventory.adjust` permission as every other adjustment — an "issue" action is a distinct real-world responsibility (a warehouse worker fulfilling a repair order) from "a stock-take found a discrepancy," and conflating them would mean anyone who can correct inventory counts could also, silently, issue parts against a customer job (and vice versa) — a genuine authorization-scope leak, not just a labeling concern.
4. **`is_system = true`**: both are marked as system-seeded/reserved types; extending their meaning outside "count adjustment" contradicts their own `is_system` flag's implicit contract (system types = fixed, well-known semantics other code can rely on).

This is a `decrease`-direction type structurally similar to 401/402 or 311, but it must be its **own** `code`/`category`, not a reuse.

## Posting / Finalization Contract

Already traced in full above. Summary of the **contract** any new movement type (including WU) automatically inherits, at zero extra engineering cost:

- Draft-first lifecycle (`draft` → `posted`, or `draft` → `cancelled`).
- Idempotent creation via `p_idempotency_key`.
- Idempotent finalize (safe to call twice).
- Row-locked (`FOR UPDATE`) header during finalize — concurrency-safe against double-posting.
- Config-driven stock effects (`inventory_movement_type_effects`).
- Frozen line snapshots at posting time.
- Append-only stock ledger (`inventory_stock_ledger_entries`).
- Sequential, per-document-type document numbering.
- `inventory_movement_audit_log` entries at every status transition.

## Audit / Immutability / Reversal

- **Are posted movements immutable?** **Partially enforced by RLS, not fully.** LIVE VERIFIED: `inventory_movement_lines_update`'s RLS policy explicitly requires the parent header's `status = 'draft'` — so **lines cannot be edited via RLS once posted**, a hard guarantee. However, `inventory_movement_headers_update`'s RLS policy does **not** check `status` at all — it only checks the caller holds `operate`/`adjust`/`reverse` permission, regardless of the header's current status. **This means a caller with `warehouse.inventory.operate` could, today, directly `.update()` arbitrary header fields (note, counterparty_name, reference_type/reference_id, etc.) on an already-posted movement via the client SDK, bypassing `inventory_finalize_posting` entirely** — the RPC's own internal status checks only protect the _posting transition itself_, not a bare header UPDATE issued outside the RPC. This is a real, pre-existing gap in the current engine, **not** something WU should inherit or work around silently — flagged here for the product owner's awareness; not in scope to fix in this audit.
- **How are corrections represented?** By a **separate new movement** (401/402 for count corrections) — never by editing the original movement's lines/quantities. This is the established, correct pattern WU should also follow for corrections.
- **Does reversal create a new movement or edit the original?** **UNRESOLVED / not yet built.** The schema is ready (`inventory_movement_headers.original_movement_id`/`reversal_movement_id`/`reversed_by`/`reversed_at`, and the `warehouse.inventory.reverse` permission is already checked by RLS) but **no live function creates a reversal** — a targeted search for any `revers`/`correct`-named function in `public` returned zero results. `inventory_cancel_movement` is a **different, narrower** operation: it only cancels a **draft** (never a posted movement) — LIVE VERIFIED, it `RAISE EXCEPTION`s if `status != 'draft'`. So today, reversing a _posted_ movement has no implementation at all, dormant schema only.
- **Is movement history append-only?** Yes for the parts that matter: `inventory_stock_ledger_entries` (no UPDATE/DELETE policy found for it during this pass — REPO/LIVE VERIFIED it is only ever INSERTed by `inventory_finalize_posting`) and `inventory_movement_audit_log` (only INSERTed, never updated, across every RPC body read this pass).
- **Should normal WU use the same reversal contract if issued by mistake?** Yes, in principle — WU should reuse `original_movement_id`/`reversal_movement_id` exactly as designed, **but the reversal RPC itself does not exist yet for ANY movement type**, so building WU's own bespoke reversal path would be exactly the "parallel subsystem" this audit was asked to avoid. **Recommendation: a generic `inventory_reverse_movement(p_movement_id, p_actor_user_id, p_reason)` RPC is a prerequisite the whole engine is missing, not a WU-specific concern** — building it once, generically (driven by the same `inventory_movement_type_effects` table, applying the inverse `direction` per effect), benefits 101/401/402/801/WU alike. This is the single largest piece of "new wiring needed" identified in this audit, and it predates WU.

## Permissions / RLS

LIVE VERIFIED, all four movement permission slugs (no more exist):

| Slug                          | Used for                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `warehouse.inventory.read`    | SELECT on headers/lines.                                                                                                                                                                                                                                                                                                        |
| `warehouse.inventory.operate` | INSERT draft, INSERT lines, UPDATE header/lines (draft-only for lines). Also covers "normal" movement creation generically (101, 801, and presumably any future normal-flow type).                                                                                                                                              |
| `warehouse.inventory.adjust`  | Same INSERT/UPDATE surface as `operate` — the two are used together in every `OR` clause seen (headers insert, lines insert, header update) — functionally near-identical today, `adjust` appears intended to gate count-correction-specific UI/actions at the application layer rather than a genuinely separate RLS boundary. |
| `warehouse.inventory.reverse` | Included in the header UPDATE policy's `OR` clause — pre-provisioned for the reversal feature that doesn't exist yet.                                                                                                                                                                                                           |

**No issue-specific permission exists.** Recommendation: **reuse `warehouse.inventory.operate`** for WU draft-create/line-insert (matching 101/801's usage — WU is a "normal" movement in exactly the sense `operate` already covers), and use `warehouse.inventory.reverse` for any future WU reversal (matching the existing pattern, once the generic reversal RPC exists). **Do not create a new permission** — none of the four existing ones would need a peer; `operate` already models "make a normal movement happen," which is exactly what issuing a WU is.

## Document Numbering

Confirmed pattern: `<document_type_code>/{year}/{seq:6}` (e.g. `PZ/2026/000123`), driven by `inventory_document_types.numbering_template` and a per-`(org, document_type, branch, series, year)` sequence row in `inventory_document_sequences`. **Current live behavior always requests the `branch_id IS NULL` sequence row** (LIVE VERIFIED in `inventory_finalize_posting`'s body) — so today, numbering is effectively **org-wide per year**, not per-branch, even though the schema supports per-branch sequences. **Recommendation for WU**: follow the exact existing pattern — a new `inventory_document_types` row `code = 'WU'`, `numbering_template = 'WU/{year}/{seq:6}'`, producing document numbers like `WU/2026/000045`. This is not invented — it is the literal existing template convention applied to a new code, matching 101→`PZ/...`/401,402→`INW/...`. Whether WU numbering should become branch-scoped (unlike today's org-wide 101/401/402) is a legitimate product question — **UNRESOLVED**, flagged for the product owner; the schema already supports it if desired (just needs `inventory_finalize_posting` to stop hardcoding `branch_id IS NULL`, a change affecting all movement types, not WU-specific).

## Reservations / Allocations (LIVE VERIFIED, fully built, entirely dormant)

| Table                         | Purpose                                                                                                                                                                                           | Key columns                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `inventory_reservations`      | Header: a claim against future stock for a `reference_type`/`reference_id` (generic — could be `'repair_order'`).                                                                                 | `status`, `reference_type`, `reference_id`, `reference_number`, `expires_at`, `priority`. |
| `inventory_reservation_lines` | `reserved_quantity`, `released_quantity`, `fulfilled_quantity` — exactly the "committed/held quantity" model requested. `location_id` **nullable** (can reserve a variant without pinning a bin). |
| `inventory_allocations`       | Header, optionally tied to a `reservation_id`; its own `reference_type`/`reference_id`.                                                                                                           |
| `inventory_allocation_lines`  | `allocated_quantity`, `fulfilled_quantity`; `location_id` **NOT NULL** (allocation pins a specific bin, unlike a reservation). Links back to `reservation_line_id` (nullable).                    |

RPCs exist and are complete: `inventory_create_reservation`, `inventory_release_reservation`, `inventory_create_allocation`, `inventory_release_allocation` — all `SECURITY DEFINER`, all RLS-protected (FORCE RLS confirmed on all four tables). **No `inventory_fulfill_reservation`/`inventory_consume_reservation`-style RPC exists** — nothing currently sets `fulfilled_quantity` anywhere in the live function set. **Zero application-layer callers found** (`ambra-location-inventory.service.ts`'s incidental keyword match was checked and is unrelated) — this entire layer is built, RLS-secured, and 100% dormant, exactly matching the "fully built at DB/service level, zero UI callers" finding from prior Zone 3 investigation of adjacent inventory subsystems.

**Reservation → WU consumption is new wiring, not existing wiring**: WU issuing stock should decrement `reserved_quantity`/increment `fulfilled_quantity` on the relevant `inventory_reservation_lines` row(s) as part of the same posting transaction — but no existing function does this "consume a reservation as part of posting a movement" step. This must be built as part of WU's own posting extension (see Recommended WU Design), reusing the reservation _tables_ and RLS, but adding the missing _fulfillment_ logic — the correct minimal new wiring, not a parallel reservation system.

## Containers (LIVE VERIFIED)

- **Do containers already exist?** Yes. `inventory_containers` (header: `code`, `type`, `status`, `current_location_id` **NOT NULL**, generic `reference_type`/`reference_id`) + `inventory_container_lines` (`container_id`, `variant_id`, `unit_id`, `quantity`, plus `lot_id`/`serial_id`).
- **Can containers hold product quantities?** **Yes, for real** — `inventory_container_lines.quantity` is a real numeric column; containers are not mere grouping metadata, they store actual quantities.
- **Do containers have QR?** No dedicated QR column on `inventory_containers` itself (LIVE VERIFIED, full column list above). A generic `qr_platform_*` system exists elsewhere in the schema (REPO VERIFIED via migration `20260423100000_qr_platform_foundation`, not re-traced in depth this pass) — whether it already targets containers via a registry entry is **UNRESOLVED**, not confirmed this pass; likely follows the same target-registry pattern seen elsewhere (comments/attachments), meaning adding container QR support (if not already wired) would be a registry-entry-sized change, not a schema change.
- **Does `current_location_id` exist?** Yes, NOT NULL.
- **Does moving a container change child items' effective location?** **UNRESOLVED this pass** — `inventory_movement_lines.container_id` exists (nullable), meaning a movement line CAN reference a container, but whether moving a container (updating `current_location_id`) is itself expressed as an `inventory_movement_headers`/`lines` transaction (consistent with the "every stock-affecting event is a movement" architecture) or via a separate, out-of-band update was not traced this pass — flagged for a future audit before container-integrated WU issuing (issuing FROM a container) is built.
- **Are quantities stored inside containers, or is the container only grouping metadata?** Real quantities, per above — this matters directly for WU: **issuing "from a container" means decrementing `inventory_container_lines.quantity` in addition to the normal `inventory_balances`/ledger effect**, another piece of new wiring, not existing wiring.

## Recommended WU Movement Contract

1. **Exact movement code**: a new code, e.g. `"501"` or `"601"` (SAP-style issue-range naming per this repo's `CLAUDE.md` convention notes — exact number is a naming choice, not an architectural one; recommend `501` as the first free "issue" slot below `801`'s bin-operation range, but this is a naming decision for the product owner, not derived from evidence).
2. **Does it already exist?** No — confirmed exhaustively above.
3. **`movement_kind`**: no such column exists; use `category = 'issue'` (a new category value — first of its kind, alongside `receipt`/`transfer`/`adjustment`/`bin_operation`).
4. **Stock effect**: one `inventory_movement_type_effects` row — `target = 'source'`, `balance_field = 'on_hand'`, `direction = 'decrease'`, `is_required = true` — structurally identical in shape to `402`'s single decrease-effect, but under its own `code`/`category` (see the proof above for why 402 itself must not be reused).
5. **Document numbering**: new `inventory_document_types` row, `code = 'WU'`, `numbering_template = 'WU/{year}/{seq:6}'` — literal application of the existing pattern.
6. **RPCs/services to reuse**: `inventory_create_draft` and `inventory_finalize_posting` **as-is, unmodified** — both are already fully generic. `inventory_v1_get_or_create_balance` (balance resolution) and the stock-ledger-entry insertion inside `finalize_posting` are reused verbatim.
7. **New wiring needed**:
   - The new config rows themselves (movement type, document type, effect) — via `inventory_seed_movement_types_internal` extension or a parallel seed function, TO DECIDE.
   - **Reservation-consumption step**: extending `inventory_finalize_posting` (or a WU-specific wrapper called before/after it, TO DECIDE) to decrement `inventory_reservation_lines.reserved_quantity`/increment `fulfilled_quantity` for the reservation(s) tied to the RepairOrderLine(s) being issued — genuinely new logic, not reuse.
   - **`repair_order_line_movement_links` population**: after a WU posts, insert rows linking each `inventory_movement_lines.id` to the relevant `repair_order_line_id` with `relation_type = 'issue'` and `applied_quantity` — this is Zone 3's own table, populated from the _outside_ (WU's own service/RPC layer), not something the generic movement engine needs to know about.
   - **Container-quantity decrement**, if issuing from a container — new logic, since no existing RPC decrements `inventory_container_lines.quantity`.
   - **Reversal RPC** (`inventory_reverse_movement`) — missing for the _entire engine_, not WU-specific; needed before WU can be safely correctable, but should be built generically.
8. **New movement-type seed/config row required?** Yes — exactly one new `inventory_movement_types` row + one `inventory_movement_type_effects` row + one `inventory_document_types` row, per organization (via the existing per-org seeding pattern).
9. **RepairOrder linkage (header)**: `reference_type = 'repair_order'`, `reference_id = repair_orders.id` on `inventory_movement_headers` — reusing the existing free-text generic reference pattern exactly as `inventory_reservations`/`inventory_allocations`/`inventory_containers` already do for their own `reference_type`/`reference_id` columns. **Consistent with the existing convention, not a new pattern.**
10. **RepairOrderLine linkage (line)**: `repair_order_line_movement_links` (Zone 3's own table, already migrated and pgTAP-tested this session) — **exactly the mechanism the header-level reference cannot provide** (per Zone 3's own Correction 5: header-level reference alone is ambiguous when a RepairOrder has multiple lines sharing a SKU). **Recommendation: use both, together, exactly as the work order's own framing anticipated** — header context (`reference_type`/`reference_id`) for coarse-grained "what is this movement about," `repair_order_line_movement_links` for the exact per-line attribution that must never be inferred by SKU.
11. **Reservation consumption**: on WU posting, for each issued line, decrement the matching `inventory_reservation_lines.reserved_quantity` by the issued amount and increment `fulfilled_quantity` by the same — new wiring (see point 7), reusing the existing table/RLS.
12. **Container quantities**: if the issued stock is drawn from a specific container (`inventory_movement_lines.container_id` set), decrement `inventory_container_lines.quantity` by the same amount as part of the same posting transaction — new wiring, same reasoning.
13. **Reversal/correction**: via the (not-yet-built, engine-wide) `inventory_reverse_movement` RPC, using `original_movement_id`/`reversal_movement_id` — WU should not invent its own reversal mechanism.
14. **Permissions**: reuse `warehouse.inventory.operate` for create/post; `warehouse.inventory.reverse` for future reversal. No new permission.
15. **Audit trail**: `inventory_movement_audit_log` (automatic, inherited for free from `inventory_create_draft`/`inventory_finalize_posting`) + `inventory_stock_ledger_entries` (automatic) + Zone 3's own `platform_events` emission (`workshop.repair_orders.*`-family event, e.g. a new `workshop.repair_orders.parts_issued` entry) at the service layer that orchestrates WU-for-a-RepairOrder — **two separate, both-correct audit mechanisms, each already established in its own domain; WU orchestration should emit to both, not merge them into one.**
16. **Tests**: see Required Tests below.

## RepairOrder Integration — confirmed clean fit

The existing `reference_type`/`reference_id` header pattern plus Zone 3's `repair_order_line_movement_links` line-level table are **exactly** the right combination, and require no new reference contract:

- Header: `reference_type = 'repair_order'`, `reference_id = repair_orders.id` — matches the free-text convention already used by `inventory_reservations.reference_type`/`inventory_allocations.reference_type`/`inventory_containers.reference_type` (LIVE VERIFIED all three use the identical shape).
- Line: `repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type='issue')` — already migrated, RLS'd, and pgTAP-tested in this session's Zone 3 work; requires zero new schema for WU to use it, only new application code that writes to it after a WU posts.

## Required Tests (proposed, not written)

**Unit**: quantity validation (issue ≤ reserved, issue ≤ physically available); reservation-consumption arithmetic (`reserved_quantity`/`fulfilled_quantity` math); no status-transition state machine needed beyond the existing draft/posted/cancelled (WU reuses it as-is).

**Service**: issue one line; issue partial quantity; issue multiple lines in one WU; issue against the same RepairOrder across multiple separate WU documents; reject issuing above reserved quantity; reject issuing above physically available `on_hand`; issue the same SKU from two distinct RepairOrderLines without cross-attribution (mirrors Zone 3's own already-proven `repair_order_line_movement_links` uniqueness/independence guarantee).

**DB/RPC**: atomic posting (stock decrement + reservation decrement + `repair_order_line_movement_links` insert all-or-nothing); duplicate/idempotency behavior (reuses `inventory_create_draft`'s existing idempotency-key mechanism — verify it still holds for the new type); branch/org isolation (RLS, reusing the existing `warehouse.inventory.*` policies verbatim); permission denial (no `operate` → draft creation rejected); reversal correctness (once the engine-wide reversal RPC exists).

**E2E**: RepairOrder → reserved parts → container/location → issue selected quantity → WU created → stock decreases → reservation decreases → RepairOrder line history updated (via `repair_order_line_movement_links` + `computeRepairOrderLineQuantities`) → remaining `available_for_issue` correct.

## Open Questions

1. **UNRESOLVED**: exact WU code number (`501` vs `601` vs another) — naming choice for the product owner, not derivable from evidence.
2. **UNRESOLVED**: should WU document numbering become branch-scoped, unlike today's org-wide 101/401/402/801 numbering? The schema supports it; today's `inventory_finalize_posting` does not request it.
3. **UNRESOLVED**: whether moving a container changes its child lines' "effective location" via a movement, or via an out-of-band update — needs its own targeted trace before container-sourced WU issuing is built.
4. **UNRESOLVED**: whether the `qr_platform_*` system already targets containers.
5. **CONFIRMED GAP, not WU-specific**: `inventory_movement_headers`'s UPDATE RLS policy does not check `status`, meaning posted-header immutability is only a convention today, not a hard guarantee — worth a dedicated hardening pass regardless of WU.
6. **CONFIRMED GAP, not WU-specific**: no engine-wide movement reversal RPC exists yet, despite the schema and permission being ready for it — a prerequisite for a fully correctable WU (and for 101/401/402/801 too), not something to build WU-specifically.
