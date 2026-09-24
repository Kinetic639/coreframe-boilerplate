# Dashboard Current Status — Product Clarification (2026-09-24)

## Product-owner decision

**CURRENT STATUS — DEMO SUFFICIENT / NO PITCH WORK REQUIRED.**

The current dashboard is accepted for presentation purposes. It is not perfect and may receive later polish, but it is NOT: a presentation blocker, a "PITCH SHOULD" item requiring implementation, or a required pre-presentation task.

The product owner's own description of what the current dashboard provides: active branch context, organization context, operational shortcut cards, tickets, tasks, Kanban/current work, activity/overview information.

## Reconciliation against live code (performed before recording this decision)

Live-reverified 2026-09-24: `apps/web/src/app/[locale]/dashboard/start/page.tsx` is **unchanged** since 2026-03-21 — still a 15-line static client component rendering only `<PageHeaderV2 title="Dashboard" description="Welcome to your dashboard...">`, zero data fetching, zero server component. This exactly matches the prior audit's finding (`docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/zone-readiness-matrix.md`'s own Zone 11 entry) — the code fact has not changed.

The product owner's description, however, is accurate about the **broader dashboard experience** — confirmed live in code:

- **Active branch/org context**: `SidebarBranchSwitcher`/`SidebarOrgHeader` (the exact components hardened in Zone 1 Phases 1-3 this session) are present in the dashboard shell on every page, not just `/dashboard/start`.
- **Activity/overview information**: `DashboardStatusBar.tsx`, present on every dashboard page (not only `/dashboard/start`), fed by real data via `getLatestActivityAction()` — confirmed in the existing Zone 11 audit's own "Notes/evidence" section, not newly discovered here.
- **Kanban/current work**: a real Kanban system exists (`apps/web/src/components/primitives/kanban/`, `apps/web/src/server/services/kanban-boards.service.ts`, `apps/web/src/app/actions/kanban/`), confirmed via code search, matching a recent real commit (`02a8a78b feat(kanban): add shared inbox and quick add`).
- **Tickets**: Zone 8 (Help Desk/Tickets) is a real, functional module per the existing pitch-scope documentation (optional narrow demo).
- **Tasks**: Zone 9 (Planning) is a real, functional module per existing pitch-scope documentation.
- **Operational shortcut cards**: `quick-switcher.tsx`'s own default action set ("Dashboard", "Settings", "Team", "Products") provides quick navigation, matching the general shape of "operational shortcut cards" even if not literally rendered as cards on `/dashboard/start` itself.

## How this reconciles — no contradiction, a scope clarification

The product owner's acceptance decision is read as applying to **the overall dashboard experience** (the operational shell plus one-click-away real modules) — not as a claim that the static `/dashboard/start` placeholder file itself was rewritten with inline widgets. Both facts are true simultaneously:

1. `/dashboard/start` itself remains a bare placeholder (unchanged, verified).
2. The product owner has explicitly decided that fact does not matter for pitch purposes, because the surrounding, always-visible operational shell (context + activity) plus the real, working adjacent modules (Kanban, Tickets, Tasks) already provide a strong-enough first impression and working demo material.

This is a legitimate product/business judgment call, not a technical claim to be second-guessed — it is recorded as the product owner's decision, with the underlying code fact preserved as historical/technical evidence so no future reader is misled into thinking the placeholder was rebuilt.

## Effect on documentation

- Zone 11 removed from all "presentation blocker" / "PITCH SHOULD" / "should finish before pitch" lists across active documentation.
- Zone 11's own zone file (`docs/mvp/zones/11-home-operational-dashboard.md`) updated with a CURRENT STATUS banner; the 2026-09-23 audit findings preserved as HISTORICAL, not deleted.
- The manual UAT plan's Zone 11 scenario (A2 in `mvp-readiness.md`'s global verification plan) marked not required.
- No change to any other zone's status or the P0 blocker list (Zone 1, Phase 10D, Receiving/putaway UI, Phase 10E, Phase 10F all remain exactly as before).

## What remains genuinely open (not decided by this pass)

Whether and when `/dashboard/start` is ever rebuilt into a real, data-driven landing screen remains an open, non-blocking future polish item — not scoped, not scheduled, not designed here.
