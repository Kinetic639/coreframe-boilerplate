# Zone 3 Phase 10 Write-Boundary Correction — Changed Files Manifest

Baseline: the exact completed base-scope Phase 10 implementation state, immediately before this correction pass (2026-09-14). Phase 10 itself was never committed to git (still uncommitted on top of `HEAD` `0475bcd8`, "phase 9 complete"), so this baseline was reconstructed in an isolated scratchpad location (never touching the real implementation tree) by taking each file this correction pass touches and reversing this pass's own edits on a copy — exact byte-for-byte, since every edit's `old_string`/`new_string` was known precisely. See `review-context.md` §S for the full reconstruction method and its isolation guarantee.

Diff scope: **only** this correction's own 4 files. No RPC validation semantics, signature, `relation_type` model, issue classification, reversal behavior, quantity formulas, event emission, error normalization, inventory movement engine, or Phase 10A-10F file was touched. The original `zone3-phase10-review/` bundle (base-scope Phase 10) was left untouched, not regenerated.

## Added (1)

### `apps/web/supabase-target/supabase/migrations/20260914052934_repair_order_line_movement_links_close_direct_insert.sql`

New forward migration. Drops the Phase 2 permissive `repair_order_line_movement_links_insert` policy and replaces it with `repair_order_line_movement_links_insert_deny` (`FOR INSERT WITH CHECK (false)`). Applied live via MCP first (`mcp__supabase-target__apply_migration`), local file created afterward to mirror the exact live-reported version (`20260914052934`), matching every prior Zone 3 migration's own workflow. SELECT policy, DELETE-deny policy, and the (nonexistent) UPDATE policy are untouched.

## Modified (3)

### `apps/web/supabase/tests/097_repair_order_line_movement_attach_phase10_test.sql`

Purely additive. New header paragraph documenting the correction. `plan(21)` → `plan(29)`. New `fx` columns + fixtures for three new scenarios (`line_split_a/b` + `ml_split`, quantity=10; `line_cap_a/b` + `ml_overcap`, quantity=10; `line_rawinsert` + `ml_rawinsert`, quantity=5). New assertions T20-T22 (cardinality split success), T23-T25 (over-cap inverse, no partial write), T26-T27 (the write-boundary's own central acceptance proof: direct INSERT denied, RPC still succeeds for the same actor). T22/T25 are physically placed after `RESET ROLE` (alongside the pre-existing T16-T19 reads) for the same RLS-visibility reason those already were — not a design change, a placement fix caught on this file's own first live run of this pass. Nothing above the new section (T1-T19, all original Phase 10 assertions) was modified.

### `docs/mvp/zones/03-repair-orders-implementation-plan.md`

One line struck through and annotated (the Phase 10 verify-first note's own bullet claiming the raw-insert gap was "disclosed, not fixed" — now closed) plus one new `CORRECTION PASS (2026-09-14, external review)` blockquote appended immediately after the existing Phase 10 verify-first note, covering the write-boundary closure, the cardinality proof, the Phase 8/9 fixture-preservation decision, and the Zone 5 reality update. No other line in the file touched (confirmed via the reconstructed baseline diff, 19 lines changed total, all inside this one note).

### `docs/mvp/zones/03-repair-orders-progress.md`

`Current phase` header line updated to reflect the correction. Phase 10 table row's own notes cell updated (write-boundary/cardinality additions, test counts 21→29 pgTAP and 216→233 full-suite). One new change-log entry appended at the end of the file. No other phase's row, header field, or change-log entry touched.

## Cross-validation

- File count: **4** (1 added + 3 modified), matching this manifest's own count and the diff's 4 `diff --git` headers exactly.
- `zone3-phase10-write-boundary-correction.diff`: 292 lines, 57831 bytes.
- Baseline: reconstructed (not a git commit — Phase 10 itself is still uncommitted). Isolation: reconstruction happened entirely in this session's scratchpad directory; the real implementation tree was never touched during reconstruction, and no worktree/branch/commit was created or mutated for it.
- Packaging verification: `git status --short` immediately before and after generating this bundle shows the identical set of Zone 3 Phase 10 paths (the same 5 modified + 3 untracked implementation paths from the original Phase 10 bundle, now 5 modified + 4 untracked with this correction's own new migration added, plus this new bundle directory itself) — confirming bundle creation did not alter, stage, or commit any implementation file.
