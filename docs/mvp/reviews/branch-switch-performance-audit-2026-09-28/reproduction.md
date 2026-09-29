# Reproduction

**Date:** 2026-09-28
**Tested code:** working tree at `da109ae8` on `zone3-zone5-integration-audit`, byte-identical to final `origin/main` `1e86d66c` (`git diff --stat HEAD origin/main` is empty). Clean tree. Branch-switch code is the merged/final Zone 1 version (Phase 1 `SidebarBranchSwitcher` + Phase 6 `changeBranch`/`isBranchAccessible`).
**Supabase target:** `rjeraydumwechpjjzrus` (remote; no local Supabase).
**UAT account identified (read-only):** `user_preferences.updated_at` shows user `832858c3…` in org "Diff Org name" (`9f98fe91…`, 8 branches) switched branches at 2026-09-28 14:43 UTC. It matches today's manual UAT. The account has an avatar (`avatar_path` set) and holds the `branches.view.any` / `branches.view.update.any` grants.

## What could and could not be reproduced here

- **Not reproduced end to end.** This agent has no credentials for the UAT account and no interactive browser. Creating a session or account would mean mutating live data, which is out of scope. **So the T0–T8 browser timestamps the task asked for were NOT measured.** Nothing in this bundle presents a modeled number as a measured one.
- **What WAS measured, against the real target:**
  1. Network round-trip latency from this environment to PostgREST, Auth and Storage (`timing-breakdown.md`).
  2. The DB execution time of every query in the switch path, **under RLS, as the actual UAT user** (read-only `SELECT`s in a rolled-back transaction as `authenticated` with that user's JWT claims).
  3. Dev-server compile/render cost for `/dashboard/start`: cold, warm, and after 70 s idle.
  4. Next.js 16.1.7 router-queue behavior for `router.replace` + `router.refresh`, from its source.
- **Round-trip counts are exact**, derived by reading every awaited call on the path (`changebranch-profile.md`, `dashboard-load-profile.md`).

## Temporary instrumentation

None was added to application code. The dev server was started, used for timing, and stopped (confirmed via `lsof`). `git status` stayed clean throughout.
