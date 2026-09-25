# Zone 1 / Phase 8 — UAT Environment

**Branch:** zone3-zone5-integration-audit
**Tested application SHA:** b017e6622e584ffcfb6fffb0d8917bd919b76b9b ("test: close Zone 1 automated demo gate", Phase 7's commit — the current HEAD at Phase 8 start)
**Date:** 2026-09-24

## Critical finding: no prepared demo environment exists yet

`docs/mvp/presentation-demo-setup.md` is a **specification**, not a record of completed setup — it opens with "This document does NOT create the data. It specifies what must exist before rehearsal," and every required row (branches, presenter/admin account, warehouse-worker account, advisor account, locations, products, location QR labels) is marked `CREATE BEFORE REHEARSAL`.

A read-only check of the live target Supabase project (`rjeraydumwechpjjzrus`, via `mcp__supabase-target__execute_sql`) confirms this: the only existing organizations are clearly ad-hoc test/scratch orgs from unrelated prior work ("Anna's Organization", "Grupa", "Grupa cichy-Zasada", "Diff Org name") — none named for or matching the Ambra pitch demo, none with the presenter/warehouse-worker/advisor role shape `presentation-demo-setup.md` requires, and none with printed/tested location QR labels. "Diff Org name" happens to have 8 branches (likely from unrelated branch-numbering test churn), but has no representative products/locations/roles and using it would not constitute genuine presentation-readiness evidence.

**This means Phase 8's own manual UAT scenarios cannot be executed today, independent of any device-access question.** The org/branch/user/data combination `presentation-demo-setup.md` requires does not exist. This is the primary blocker to completing Phase 8, more fundamental than the phone-access question below.

## Device/access findings

- **Desktop browser (presentation laptop):** not available to this agent. This agent operates in a headless, terminal-only sandboxed environment with no interactive browser, no display, and no way to visually confirm a rendered dialog, transition animation, or layout the way a human tester would.
- **Presentation phone:** not available to this agent under any circumstance — no physical device, no camera, no way to perform an actual QR scan or judge mobile rendering/touch-target sizing.
- **Supabase project:** `rjeraydumwechpjjzrus` (the live, remote target project — not a local/sandboxed copy; per `apps/web/CLAUDE.md`, local Supabase must never be used). Read-only queries were used to check for existing demo data; nothing was created, updated, or deleted.

## What WAS verified (Claude-executable, safe, non-mutating)

The local dev server was started against this branch/SHA (`pnpm dev`, bound to `127.0.0.1:3001`, connected to the live `.env.local`-configured Supabase project) and exercised with direct HTTP requests for routes that don't require an authenticated session or prepared demo data — i.e., checks that validate the Phase 6/7 code paths are live and wired correctly, without needing the presentation environment to exist. See `desktop-browser-results.md` for the specific requests and responses. The dev server was stopped immediately after (confirmed via `lsof`), per this repo's own "always kill the dev server when done" instruction.

No new organization, branch, user, or other data was created in the live Supabase project by this agent. No existing data was modified or deleted.

## Recommendation for the human tester

Before Phase 8's actual manual scenarios (Sections 4-17 of the task) can be executed — by a human, on a real desktop browser and the real presentation phone — the environment in `presentation-demo-setup.md` needs to actually be created:

1. One demo organization (not a scratch/test org).
2. At least 2 branches.
3. Presenter/admin account (full access) + warehouse-worker account (distinct, narrower role) + optionally an advisor account, all with real login credentials.
4. A small set of representative locations (with QR labels printed and tested on the actual presentation printer/phone beforehand), products, and — if Matcher/RepairOrder scenarios are included — at least one RepairOrder and the data needed to run a Matcher session against it.

This agent can assist with steps 1-4 via the application's own real sign-up/admin flows (not raw DB inserts) if explicitly asked to do so — this was intentionally not done unilaterally in this pass, since creating real accounts and org data on the shared live Supabase project is a nontrivial, semi-irreversible action better taken with the user's explicit go-ahead than assumed as implied scope.
