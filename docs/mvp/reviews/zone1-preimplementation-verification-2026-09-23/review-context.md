# Ambra — Zone 1 Pre-Implementation Verification Pass

**Date:** 2026-09-23
**Purpose:** Verify the exact current technical state of Zone 1 (Identity/Access/Branch/Authorization) before implementation begins, so the next task can move directly from PARTIAL toward DEMO READY (and later PILOT READY) without redesigning IAM blindly or fixing only isolated symptoms.
**Scope:** READ-ONLY VERIFICATION ONLY. No application code, tests, SQL, migrations, RPCs, RLS, configs, or packages modified. No live database mutation. Nothing committed.

## Section 0 — Required starting state

- **Branch:** `zone3-zone5-integration-audit`
- **Starting HEAD:** `1524e218` — "docs: final MVP/pitch documentation consolidation" (the immediately preceding pass).
- **Working tree:** clean (confirmed via `git status --porcelain`, zero output).
- **Inventory Core status:** confirmed still "INVENTORY CORE FINAL FOR PILOT / ARCHITECTURE FROZEN" (`docs/inventory/reviews/inventory-core-final-pilot-freeze/final-status.md`, first 6 lines re-read, unchanged).
- **Zone 1 implementation:** confirmed NOT started since the documentation consolidation — `git log` on `sidebar-branch-switcher.tsx` shows its last touching commit is `ddf6acdc` ("Convert project to monorepo with web and mobile apps"), nothing since; no code changes of any kind have landed on this branch since `1524e218`.
- **Branch-switch fix:** confirmed NOT landed (same evidence — the file implicated as the bug's root cause is untouched since the monorepo conversion, long before any of this session's own audit work began).
- **Phase 10D:** confirmed still NOT STARTED — `03-repair-orders-progress.md`'s own header (corrected in the immediately preceding pass) explicitly reads "10D NOT STARTED / READY TO START (NEXT)" and "Last updated: 2026-09-23 (Phase 10D unblock status correction; no phase implementation work done this update — documentation-only)."

Starting state check PASSED — proceeding with the verification pass.

## Authoritative product contract for this pass

Per this task's own instruction, `docs/mvp/zones/01-auth-org-branch-access.md` — specifically its "Product clarification and final design," "Product decisions," "Final intended workflows," "Architecture implications," "Readiness progression plan," and "Status change rules" sections — is treated as the accepted product contract. This pass verifies current code AGAINST that contract; it does not reopen or question the contract's own decisions.

## Methodology

Given the scope (4 major verification areas: environment/schema + test execution; systematic branch-state/cache inventory + switch-path trace + unsaved-work; authorization model — branch-access-vs-permissions + permission-context-after-switch + cross-branch QR; admin/security — org_owner/last-owner/self-demotion + privilege-escalation + invitations + member-removal), this pass was executed via 4 parallel, read-only research agents, each briefed with the exact accepted product-contract bullets relevant to its own area and the already-known findings from the prior `zone1-branch-switch-audit.md` (to extend and re-verify, not duplicate or blindly trust).

1. **Agent 1** (Explore): environment/schema verification (authoritative migration tree, live Zone-1-critical table/RLS state, schema-drift gaps) + existing relevant automated test execution.
2. **Agent 2** (Explore): systematic branch-scoped state/cache inventory across Matcher, Locations, Inventory Balances, Inventory Movements, RepairOrders, and central layout/provider state, going beyond the 3 previously-known bugs; full branch-switch path trace; unsaved-work mechanism check.
3. **Agent 3** (Explore): branch-access-vs-permissions model verification, permission-context-after-switch verification, cross-branch QR/deep-link behavior verification.
4. **Agent 4** (Explore): org_owner/last-owner/self-demotion verification, privilege-escalation verification, invitation/one-organization-invariant verification, member-removal/revocation/historical-identity verification.

Every finding in this bundle is cited to a specific file, line, or live-code/live-DB observation — not inferred from a document's own status label alone, per this whole project's own established discipline (and per this task's own explicit instruction: "Do not rely on previous audit summaries alone. Re-verify the current code at HEAD.").
