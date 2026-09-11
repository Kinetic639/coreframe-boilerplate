# Zone 8 — Tickets / Help Desk: Progress Tracker

> Mechanical task counts only. No estimated percentages. See
> `08-tickets-implementation-plan.md` for phase definitions and
> `08-tickets.md` for the accepted audit this all traces back to.

Last updated: 2026-09-11 (session: pitch/zone8-tickets — includes a
same-day VERIFY-FIRST correction pass over the search-filter fix and a
re-check of live Supabase access)

## Current phase

**Phase A (pitch-safe correctness fix) — DONE.**
**Phase B (pitch narrowing, documentation-only) — DONE (no code required).**
**Phase C (product-decision-blocked) — BLOCKED, 5 decisions outstanding, 0 guessed.**
**Phase D (pilot hardening) — NOT STARTED (explicitly out of scope for this pass).**

## Mechanical task counts

| Phase                 | Total tasks                                   | Done           | Blocked (decision needed) | Not started |
| --------------------- | --------------------------------------------- | -------------- | ------------------------- | ----------- |
| A — pitch code fix    | 2 (A1 list search, A2 calendar-picker search) | 2              | 0                         | 0           |
| B — pitch narrowing   | 4 (B1..B4)                                    | 4 (documented) | 0                         | 0           |
| C — product decisions | 5 (PD-1..PD-5)                                | 0              | 5                         | 0           |
| D — pilot hardening   | 8 (see plan)                                  | 0              | 3 (depend on PD-2/3/4)    | 5           |

**PITCH-required task count:** 6 total (2 code + 4 narrowing) → **6 complete, 0 remaining.**
**PILOT-required task count:** 8 (Phase D) → **0 complete, 8 remaining** (unchanged by this session — explicitly deferred).

## Evidence

- Code fix: `apps/web/src/server/services/helpdesk-tickets.service.ts` —
  `listForDataView` and `listForCalendar` search now build
  `.or("title.ilike.<escaped>,ticket_number.ilike.<escaped>")` via a new
  private `ilikeOrValue()` helper (LIKE-metacharacter escaping + PostgREST
  or()-value quoting — see implementation plan's "Phase A correction pass"
  section for the full verification and rationale).
- Test: `apps/web/src/server/services/__tests__/helpdesk-tickets.service.test.ts`
  — 21 cases: normal ticket-number/title search, empty search emits no
  `.or()`, and 8 adversarial search inputs (comma, close paren, nested
  parens, quote, backslash, mixed, `%`, `_`) each checked for (a) exactly 2
  top-level or() conditions and (b) exact literal round-trip of the
  intended ILIKE pattern.
- Re-verification of every prior audit claim: see the evidence table in
  `08-tickets-implementation-plan.md` — all confirmed still accurate against
  current `pitch/zone8-tickets` tree as of 2026-09-11.
- Search-filter grammar verified directly against PostgREST's parser source
  (`PostgREST.ApiRequest.QueryParams`), not assumed from precedent — see
  implementation plan for the exact rule cited and the finding (Task A1/A2
  as originally shipped had a narrow, non-security query-construction bug;
  now fixed and test-covered).

## Tests

- **New/updated:** `helpdesk-tickets.service.test.ts` — 21 unit tests
  covering the Phase A fix and its correction pass (see Evidence above).
- **Pre-existing, unrelated to this session's change, unaffected:**
  `sidebar-ssr.test.tsx` (hd-1..hd-5 sidebar-gate tests),
  `planning-calendar.service.test.ts` /
  `app/actions/planning/__tests__/calendar.test.ts` (calendar integration,
  `HelpdeskTicketsService` fully mocked in both — the Phase A fix does not
  change either mock's expected call shape since they mock the whole
  service, not its internal query building).
- **Execution status: PASS.** `vitest run` for
  `helpdesk-tickets.service.test.ts` → **21/21 passed** (initial 3/3 in
  10.09s pre-correction, 21/21 in 6.32s after the correction pass's
  additional edge-case tests were added). Getting here initially
  required working around a near-full shared `/home` filesystem (the VM's
  disk was at 98–100% full, shared with concurrent Zone 3/Zone 11
  worktrees, and this worktree's `apps/web/node_modules` had never been
  materialized). Sequence used, in order, each checked against disk
  headroom before proceeding: (1) plain `pnpm install` — hit `ENOSPC`
  downloading uncached tarballs; (2) `pnpm install --offline
--frozen-lockfile` — materialized 1836/1984 packages from the existing
  local store with zero network use, failed only on one non-cached tarball
  (`@parcel/watcher`); (3) `PUPPETEER_SKIP_DOWNLOAD=true pnpm install
--frozen-lockfile` (skips puppeteer's ~300MB Chromium download, the
  actual disk risk) — completed cleanly, all postinstall scripts (sharp,
  msw, core-js, @parcel/watcher, @swc/core, puppeteer) finished with no
  errors. Disk was monitored throughout and never dropped below the safety
  floor; no destructive action was taken and installs were not retried
  blindly — each attempt was diagnosed before the next was tried.
- **Confirms the earlier static argument:** the test file's chainable-mock
  pattern (matching `crm-parties.service.test.ts`) worked as designed on
  the first real run, no fixture or mock-shape fixes were needed.

## Typecheck / Lint

**PASS.** `tsc --noEmit -p tsconfig.json` → exit 0, no errors. `eslint
src/server/services/helpdesk-tickets.service.ts
src/server/services/__tests__/helpdesk-tickets.service.test.ts` → exit 0,
no output, no errors or warnings.

## Live Supabase verification

Not performed live. Re-checked explicitly during the 2026-09-11 correction
pass (not assumed unchanged): `ToolSearch` found no `mcp__supabase*` tool in
this session (server not configured), and `npx supabase projects list`
again returned `Unauthorized`. Same result as originally found — no
regression, no improvement, honestly re-confirmed rather than re-asserted.
Conclusions rely on the migration-file tree, which — per the accepted
audit — is the **only** tree for this module (no two-tree drift risk here,
unlike other zones). See the implementation plan's evidence table for what
was cross-checked this way.

## Demo-ready gate

**Gate status: PASS, conditionally on manual verification.**

The accepted audit already concluded the ticket core is DEMO READY with
narrowing (see `08-tickets.md`). This session's only functional change
removes one of the four items that previously required presenter narrowing
(ticket-number search now works), leaving three narrowing items (B1, B2,
B4) which are pure presenter-language constraints, not code defects.

**Gate is NOT "verified live end-to-end in this session"** — the fix is now
unit-tested, typechecked, and linted clean, but no browser automation was
run and no two-account manual UAT pass was performed. The exact manual UAT
scenario from the accepted checklist in `08-tickets.md` ("Brama końcowa")
still needs a human (or a follow-up session with working browser
automation) to execute once, on two prepared accounts, before the actual
pitch.

## Blockers

1. **Environment (resolved this session):** shared disk was near-full,
   initially blocking `pnpm install`/test execution/typecheck/lint. Worked
   around via `PUPPETEER_SKIP_DOWNLOAD=true pnpm install
--frozen-lockfile` (see Tests section); all three checks now pass. Not a
   Zone 8 code issue, and no longer blocking.
2. **Product decisions PD-1..PD-5:** listed in the implementation plan,
   none guessed, none blocking the pitch-required task list (all 6 pitch
   tasks are independent of these decisions).
3. **Manual two-account UAT:** not yet executed (browser automation
   environment limitation — see final report).

## Recommended next Zone 8 task

Execute the manual two-account UAT scenario from `08-tickets.md`'s "Brama
końcowa" checklist by hand in a real browser, once environment access to a
working browser is available, or once a human is available to run it. This
is the single highest-value remaining action: the code path has now been
independently re-verified twice (original audit + this session's
re-verification) but has still never been exercised live end-to-end.
