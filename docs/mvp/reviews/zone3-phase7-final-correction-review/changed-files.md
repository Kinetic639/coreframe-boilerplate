# Zone 3 Phase 7 Final Narrow Pass — Changed File Manifest

Scope: **only** the 2026-09-12 final narrow verify-first pass — the two concrete issues fixed
(created_by INSERT spoof; org/branch immutability test gap) plus the tracker updates recording
this pass and the two verified-safe, no-fix-needed findings (advisor-contact cardinality;
`SECURITY DEFINER` EXECUTE grants). 4 files, all captured verbatim in
`zone3-phase7-final-corrections.diff`.

Baseline: a git commit reconstructed by applying, in order, the ORIGINAL Phase 7 review bundle's
diff (`docs/mvp/reviews/zone3-phase7-review/zone3-phase7.diff`) and the FIRST correction pass's
diff (`docs/mvp/reviews/zone3-phase7-correction-review/zone3-phase7-corrections.diff`) on top of
`HEAD` (`00221132`, "docs update"), in an isolated temporary worktree. That reconstructed commit
is the exact "Phase 7, after the first correction pass, before this final narrow pass" state. See
`review-context.md`'s "Baseline reconstruction method" for the full method.

**Note on scope isolation**: an unrestricted diff against this baseline additionally shows
pure-formatting differences (Prettier line-wrapping only, zero semantic change, confirmed by
direct inspection of every hunk) in six files: `repair-order-header-editor.tsx`,
`new-repair-order-form.tsx`, `lib/types/repair-orders.ts`, `lib/validations/repair-orders.ts`,
`repair-orders.service.ts`, `repair-orders.service.test.ts`. None of these were touched by this
final narrow pass (no Edit/Write call this pass targeted any of them) — this is pre-existing
formatting drift in the working tree, unrelated to this pass's own work, and is **deliberately
excluded** from this bundle per the explicit instruction to include a file "ONLY if it was
genuinely changed by this final pass." See `review-context.md` for the full note.

---

## `apps/web/supabase-target/supabase/migrations/20260911192411_repair_orders_created_by_insert_spoof_fix.sql`

- **Status**: NEW
- **Reason changed**: fixes Issue 1 (CONFIRMED, live-reproduced) — `repair_orders_enforce_
invariants()` froze `created_by` to `OLD.created_by` only on UPDATE, leaving `NEW.created_by`
  exactly as the client supplied it on INSERT. `repair_orders_insert`'s RLS `WITH CHECK` never
  checked `created_by` at all, so a raw INSERT could persist a spoofed author.
- **Security/business behavior affected**: an authenticated caller (either `manage_own` or
  `manage_all`) can no longer make a RepairOrder appear to have been created by a different real
  user. On INSERT, `created_by` is now unconditionally the caller's own `auth.uid()` whenever a
  session exists; only in a no-session (service-role) context is a caller-supplied value
  preserved. UPDATE behavior (freeze to `OLD.created_by`/`organization_id`/`branch_id`) is
  unchanged from the prior pass's `20260911183709` migration.
- **Test coverage**: `094_repair_orders_correction_pass_rls_test.sql` T3 (`manage_own`) / T15
  (`manage_all`).
- **DB / pgTAP / docs**: DB (migration).
- **Previous behavior**: `NEW.created_by` was left exactly as supplied on INSERT (no override at
  all); only UPDATE froze it to `OLD.created_by`.
- **Exact new trigger behavior**: on INSERT, `NEW.created_by := COALESCE(auth.uid(), NEW.
created_by)` — this line is new; the existing `identity_status` derivation (unconditional, both
  INSERT and UPDATE) and the existing UPDATE-only `created_by`/`organization_id`/`branch_id`
  freeze are both unchanged, byte-for-byte, from `20260911183709`.
- **`auth.uid()` behavior**: reads the session's JWT-claim GUC (`request.jwt.claims`), which is
  set per-request by PostgREST/Supabase's connection pooling — unaffected by the invoking
  function's own `SECURITY DEFINER`/`SECURITY INVOKER` mode. For any authenticated request (a
  direct `authenticated`-role call, or a call made through a `SECURITY DEFINER` RPC on that
  same request), `auth.uid()` resolves to the real, authenticated caller's id, never a value the
  caller can forge.
- **Service-role / no-JWT behavior**: `auth.uid()` returns `NULL` when there is no JWT session in
  the current connection (a direct `service_role`/`postgres` connection, or any backend-only path
  with no PostgREST request context). In that case, `COALESCE` falls through to `NEW.created_by`
  exactly as supplied — a fully-trusted, RLS-bypassing caller's own explicit value is preserved,
  not silently discarded.
- **Manual-creation compatibility**: `RepairOrdersService.createRepairOrder` already sets
  `created_by` from the authenticated actor's own resolved user id (never client input) — the
  same value `auth.uid()` independently resolves to for that same request. No behavior change.
- **Matcher-materialization compatibility**: `materialize_repair_orders_from_session` (`SECURITY
DEFINER`) validates `p_actor_user_id = auth.uid()` as its very first statement, then inserts
  `repair_orders` using `created_by = p_actor_user_id` — already guaranteed equal to `auth.uid()`
  by the time the INSERT runs. No behavior change.
- **Live verification result**: re-ran the exact spoof attempt (a raw INSERT supplying a
  different real org member's id as `created_by`) as both `manage_own` and `manage_all` after
  applying this migration — both now persist the genuine actor's id, never the supplied value.
- **Local/live parity**: live version `20260911192411`; local filename matches exactly (no
  rename needed — applied once, verified once).

---

## `apps/web/supabase/tests/094_repair_orders_correction_pass_rls_test.sql`

- **Status**: MODIFIED
- **Reason changed**: (a) adds regression coverage for the Issue 1 fix above (T3, T15); (b)
  closes Issue 3 — a confirmed test gap where the prior pass's `organization_id`/`branch_id`
  immutability behavior had only been spot-checked ad hoc, never committed as a regression test
  (T16, T17); (c) file-order relabeling of the pre-existing T1-T13 assertions to T1-T2, T4-T14 so
  the printed test numbers match physical/execution order in the file (no assertion logic
  changed — purely a label renumbering for readability, confirmed by diff inspection: every
  renumbered assertion's SQL body is byte-identical to its pre-pass counterpart).
- **Security/business behavior affected**: none directly (this is a test file) — it is the
  regression proof that Issue 1's fix and the pre-existing org/branch immutability behavior both
  hold, live, as the genuinely-RLS-enforced `authenticated` role.
- **Test coverage**: is itself the test coverage. 13 → 17 assertions; 17/17 passing live
  (re-executed via Supabase MCP as part of this pass, zero residual data after `ROLLBACK`).
- **DB / pgTAP / docs**: pgTAP.

---

## `docs/mvp/zones/03-repair-orders-implementation-plan.md`

- **Status**: MODIFIED
- **Reason changed**: appends a short summary blockquote note (4 lines) after the prior
  correction pass's own note, recording this final narrow pass's outcome at the point in the doc
  a reviewer would look for Phase 7's status.
- **Security/business behavior affected**: none (documentation only).
- **Test coverage**: n/a (documentation).
- **DB / pgTAP / docs**: docs/tracker.

---

## `docs/mvp/zones/03-repair-orders-progress.md`

- **Status**: MODIFIED
- **Reason changed**: adds a new "2026-09-12 final narrow verify-first pass" subsection under
  Phase 7's detailed task list (one `[x]` bullet per issue, each with Evidence/Fix/Tests
  sub-bullets, matching the established convention from every prior Zone 3 corrective pass), a
  testing-summary paragraph, an updated Phase-7-status closing line for this subsection, and a
  matching change-log entry at the end of the file.
- **Security/business behavior affected**: none (documentation only) — this file is the
  authoritative, continuously-updated execution log for Zone 3, and is where the detailed
  per-issue record belongs (the implementation plan carries only the summary).
- **Test coverage**: n/a (documentation).
- **DB / pgTAP / docs**: docs/tracker.

---

## Bundle validation

- **Files in `zone3-phase7-final-corrections.diff`**: 4 — verified via `git diff <baseline>
--name-status` over the same pathspec, matching this manifest's 4 sections exactly (one
  `diff --git` header per file, one `##` section per file, one-to-one).
- **Diff line count**: 421 lines.
- **Diff byte size**: 51,371 bytes (~50 KB).
- **Net change**: the migration (60 new lines) + the expanded pgTAP test (net +140 lines,
  reflecting both the 4 new assertions and the renumbering-driven line churn on unchanged
  assertions) + the two doc files (+4 / +27 lines respectively).
