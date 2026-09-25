# Documentation Resolution Notes

Only one documentation file has an actual git conflict: `docs/mvp/zones/11-home-operational-dashboard.md`. Full detail already in `dashboard-integration-notes.md`; this file states the general principle and confirms no other doc conflicts exist.

## General principle applied (per the task's own instruction)

Prefer MANUAL COMBINE over taking either side's whole file, preserving:

- **Current authoritative status** — whichever side's factual claim is actually true post-integration (in the one conflict found, that's main's dashboard rebuild status, not Zone 1's placeholder claim).
- **Zone 1 completion history** — Zone 1's own record that Phases 1-8 happened, with their dates/SHAs/decisions, is never overwritten wholesale by a main-side doc change, because (per `zone1-protection-notes.md`) no main-side commit touches any Zone-1-owned doc file at all except this one shared dashboard doc.
- **Dashboard current state** — main's, since it's the accurate, tested one.
- **Container product clarifications** — Zone 1's `docs/mvp/reviews/dashboard-container-product-clarification-2026-09-24/` bundle is untouched by main (confirmed, not in the overlap list) and needs no merge — only the one companion-cleanup note in `dashboard-integration-notes.md` (its `dashboard-current-status.md` makes a now-stale claim, but that's an accuracy follow-up, not a conflict).
- **Presentation blocker updates** — `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/presentation-ready-gate.md` and its siblings are untouched by main (confirmed, not in the overlap list).
- **Phase 8 awaiting-human-UAT status** — `docs/mvp/zones/01-auth-org-branch-access-progress.md` is untouched by main (confirmed, not in the overlap list) — this status survives the integration exactly as Zone 1 left it.

## Confirmation: no other documentation file conflicts

Cross-checked the full 14-file overlap list (`conflict-files.md`) — of the 14, exactly one (`docs/mvp/zones/11-home-operational-dashboard.md`) is a docs file. Every other Zone-1-authored document (the entire `docs/mvp/zones/01-auth-org-branch-access*` family, every `docs/mvp/reviews/zone1-phase*-2026-09-24/` and `zone1-phase*-2026-09-25/` bundle, the pitch-readiness/consolidation bundles, the presentation-demo-environment plan) is either exclusively on the working branch (no main-side edit at all) or predates the fork entirely (part of the shared merge-base history) — none require any merge decision.
