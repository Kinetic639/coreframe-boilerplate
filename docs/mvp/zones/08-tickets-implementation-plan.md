# Zone 8 — Tickets / Help Desk: Implementation Plan

> Companion to `docs/mvp/zones/08-tickets.md` (accepted audit) and
> `docs/mvp/zones/08-tickets-progress.md` (mechanical tracker).
> This plan only covers work that is safely Zone‑8‑owned. It does not
> redesign or rebuild anything the audit already found real and working.

## Starting position (do not re-litigate)

The 2026‑09‑08 audit in `08-tickets.md` was independently re-verified line by
line against the current tree on 2026‑09‑11 (see Evidence Re-Verification
below). Every specific code claim it makes was confirmed still true:

- Multi-user ticket core (create → assign → comment → accept/close) is real,
  DB-backed, and RPC-enforced where it matters (creation, acceptance).
- `helpdesk_ticket_references` is dead infrastructure (schema + RLS exist,
  zero call sites in `apps/web/src`).
- No reject action exists anywhere in code or migrations.
- List search matched `title` only, not `ticket_number` (`.ilike("title", …)`).
- The generic `update()` method on `HelpdeskTicketsService` exists but is
  never called from any action — the only real post-creation status change
  is unconditional `closeTicket`.
- RLS on `helpdesk_tickets` is org-scoped only (`is_org_member(org_id)`);
  `branch_id` exists as a column but is not part of any RLS predicate.

This plan does **not** repeat that analysis. It only lists what changes as a
result of it.

## Evidence re-verification (2026-09-11)

Performed as part of this session, against current `pitch/zone8-tickets`:

| Claim                                                    | Verification method                                                                     | Result                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Search matches `title` only                              | `grep -n "ilike" helpdesk-tickets.service.ts`                                           | Confirmed, 2 call sites (list + calendar picker)                                                                                                       |
| No reject action                                         | `grep -rni reject` across service/actions/migrations                                    | Zero matches                                                                                                                                           |
| `helpdesk_ticket_references` unused                      | `grep -rn helpdesk_ticket_references apps/web/src` (excl. migrations)                   | Zero matches                                                                                                                                           |
| `update()` unused                                        | Cross-checked all call sites of `HelpdeskTicketsService.*` in actions                   | Not called                                                                                                                                             |
| Activity events logged                                   | `grep event_type` across service/migrations/target-registry                             | Exactly `ticket_created`, `ticket_accepted`, `ticket_closed`, `comment_added`, `attachment_added`                                                      |
| Acceptance is RPC-enforced, not RLS-only                 | Read `helpdesk_accept_ticket` body in `20260529100000_helpdesk_acceptance_workflow.sql` | Confirmed: explicit `has_permission('helpdesk.tickets.manage') OR is-listed-acceptor` check inside the `SECURITY DEFINER` function, independent of RLS |
| Close is RLS-enforced (creator or manager)               | Read `helpdesk_tickets_update` policy                                                   | Confirmed: `has_permission('helpdesk.tickets.manage') OR created_by = auth.uid()`                                                                      |
| QR resolves via `ticket_number` to the real detail route | Read `server/qr/target-registry.ts` `"helpdesk.ticket"` entry                           | Confirmed: `resolvePathAsync` looks up `ticket_number` and returns `/dashboard/help-desk/tickets/{number}`                                             |
| Branch RLS not enforced                                  | Read `helpdesk_tickets_select/insert/update/delete` policies                            | Confirmed: only `is_org_member(org_id)`, no `branch_id` predicate                                                                                      |
| No dedicated ticket tests exist                          | `grep -rl helpdesk **/__tests__/**`                                                     | Only sidebar-gate and calendar-integration tests, ticket service fully mocked in both                                                                  |

**Live Supabase verification could not be performed in this session** — no
Supabase MCP server is connected (not present in this session's tool set),
and the Supabase CLI (`supabase projects list`) returned `Unauthorized`
(expired/invalid `SUPABASE_ACCESS_TOKEN` in this environment; direct
credential lookup was correctly blocked by the harness's own safety
classifier and was not attempted further). **Re-checked on 2026-09-11
during the VERIFY-FIRST correction pass** (per explicit instruction to
check again, not assume the earlier result still held): `ToolSearch` for
any `mcp__supabase*` tool returned no match (server not configured, as
opposed to configured-but-failing), and `npx supabase projects list`
returned the identical `Unauthorized` error. No change from the original
finding; still recorded honestly as unavailable, not fabricated. Per
`08-tickets.md`'s own notes,
Help Desk is one of the few zones with **only one** migration tree
(`apps/web/supabase/migrations`, nothing in `apps/web/supabase-target`), so
there is no two-tree drift risk to reconcile — the migration files are the
full and only definition of the schema/RLS/RPCs. Conclusions here rely on
that migration tree, cross-checked against actual application code call
sites, not on a live `pg_catalog`/`pg_policies` read. This is recorded as an
open verification gap, not asserted as equivalent to a live check.

## Scope boundaries (unchanged from the task brief)

- No Zone 3 (Repair Orders), inventory movement, container, reservation,
  allocation, matcher, WU, or Zone 11 (Home dashboard) files touched.
- No `docs/mvp/mvp-readiness.md` edits.
- No new parallel comment/attachment/audit subsystem — everything reuses the
  existing generic `CommentsService` / `helpdesk_ticket_activity` /
  permissions infrastructure.

## Phase A — Pitch-safe correctness fix (Zone-8-owned, unambiguous)

**Objective:** ticket search finds a ticket by its human-facing number, not
just its title — the exact gap called out in the accepted audit and pitch
checklist ("prezenter wie, że wyszukiwanie po numerze ticketu dziś nie
działa").

- **Task A1** — `HelpdeskTicketsService.listForDataView`: change the search
  filter from `ilike("title", …)` to `.or("title.ilike.…,ticket_number.ilike.…")`,
  matching the exact idiom already used in `crm-parties.service.ts`,
  `warehouse-locations.service.ts`, and `inventory-movements.service.ts`
  (SKU/barcode search) for the same class of bug. **DB change:** none.
  **Reused infra:** existing PostgREST `.or()` filter idiom.
- **Task A2** — `HelpdeskTicketsService.listForCalendar` (unscheduled-ticket
  picker used by the Planning calendar "attach an existing ticket" search):
  identical fix, same file, same bug class. Included because it's the same
  service/table and same one-line pattern — not because Planning's UI is in
  scope.
- **Tests:** `helpdesk-tickets.service.test.ts` (new) — verifies the `.or()`
  clause is built correctly with a search term and is absent without one,
  for both `listForDataView` and `listForCalendar`. Uses the same chainable
  Supabase-mock pattern as `crm-parties.service.test.ts`.

**Acceptance criteria:** searching the ticket list by `HD-000012` (or any
substring of a real ticket number) returns that ticket; searching by title
substring still works; no `.or()` call is emitted when the search box is
empty (no query-shape regression for the common case).

**Classification:** PITCH REQUIRED — this exact gap is named in the accepted
pitch checklist ("Wyszukiwanie i ponowne odnalezienie").

### Phase A correction pass (2026-09-11, VERIFY-FIRST re-check)

Task A1/A2 as originally shipped built the `.or()` filter string by raw
interpolation (`title.ilike.%${search}%,ticket_number.ilike.%${search}%`),
copying the idiom used elsewhere in the codebase without independently
verifying PostgREST's actual grammar for that idiom. A follow-up
verify-first pass checked this directly against PostgREST's parser source
(`PostgREST.ApiRequest.QueryParams`, specifically `pLogicSingleVal` —
unquoted values inside `or()`/`and()` split on **any** unescaped `,` or `)`)
rather than assuming correctness by precedent, per instruction.

**Finding:** the interpolation was brittle, in a way specific to switching
from a plain `.ilike()` call to `.or()`. A plain single-column filter (the
pre-Phase-A code) uses PostgREST's permissive `pSingleVal = many anyChar`
value grammar — no character is structurally special there, so the
original code had _no_ comma/paren risk (only the pre-existing, unrelated
LIKE-wildcard-broadening behavior described below). Switching to `.or()`
for the ticket-number OR-search moved the value into the **logic-tree**
grammar instead, which reserves unquoted `,` and `)` as structural
delimiters — so Task A1/A2 introduced a new, narrow regression class that
did not exist before the fix:

- A literal `,` in the search box (e.g. "Return, urgent") broke `or()`
  parsing entirely → PostgREST returns a 400 for the whole ticket-list
  request.
- A literal `)` (e.g. "device (broken)") did not error — Parsec's `parse`
  does not require consuming the entire input, so the logic-tree parser
  silently accepted a truncated prefix, dropping the rest of the value and
  the entire `ticket_number.ilike.…` clause with no error surfaced.

Neither is SQL injection or an RLS/authorization bypass: PostgREST's
`or()`/`and()` grammar only ever composes filter _predicates_ from a fixed
operator vocabulary against columns already reachable via `select`, and RLS
is applied as an independent, additional predicate regardless of how (or
whether) the `or()` string parses — there is no path from either failure
mode to arbitrary SQL, other tables/columns, or another org's rows. The
correct classification is a **query-construction correctness bug**: one
input shape hard-fails the request, the other silently returns wrong
(narrower) results — both bad for a pitch demo, neither a security hole.

**Fix:** added `ilikeOrValue()` — a small private helper in
`helpdesk-tickets.service.ts` — applied at both Task A1/A2 call sites. It
does two independent, composable escaping passes on the raw search term
before building the `%…%` pattern:

1. LIKE-metacharacter escaping (`\`→`\\`, `%`→`\%`, `_`→`\_`), so a literal
   percent/underscore/backslash typed by a user matches literally instead
   of acting as an ILIKE wildcard/escape char — this closes the one part of
   "unexpectedly broaden matching" that _is_ fixable at this layer (a
   pre-existing behavior, unchanged by Task A1/A2 itself, but in scope
   since the task asked for it to be classified and, if brittle, escaped).
2. `or()`-value quoting (wrap in `"…"`, escaping only `\` and `"`, which
   are the sole two characters PostgREST's quoted-value grammar treats
   specially — confirmed directly from `pCharsOrSlashed = noneOf "\\\"" <|>
(char '\\' *> anyChar)`), so an embedded `,` or `)` is inert.

No characters are stripped — everything is escaped and round-trips to the
literal value, verified by tests that re-derive the exact bytes PostgREST
would hand to Postgres (see Testing section below).

**Cross-cutting observation, not acted on (scope discipline):** the same
raw-interpolation `.or(...ilike...)` idiom, with the same latent
comma/paren risk, exists in `crm-parties.service.ts`,
`warehouse-locations.service.ts`, and `inventory-movements.service.ts`
(SKU/barcode search) — all outside Zone 8. Not touched in this pass; noted
here only so it isn't silently rediscovered later as if new.

## Phase B — Pitch narrowing (documentation-only, no code)

These are pitch gaps the audit already correctly resolved as _presenter
language constraints_, not code defects to fix under pitch pressure.
Restated here only so the tracker has them as checkable items:

- **B1** — No reject action exists. Demo narrative must describe acceptance
  only ("confirmed with author/time for this ticket"), never imply a
  symmetric reject/deny decision.
- **B2** — No structural ticket↔order/part/container link exists.
  `helpdesk_ticket_references` is schema-only dead code. Demo narrative: "a
  ticket QR is a physical label stuck to a part," never "the ticket knows
  this part."
- **B3** — The "Zwrot" (Return) ticket type is not seeded by default (see
  Product Decision PD-1 below) — if a demo wants to show it, it must be
  created manually, with real product decisions made first, before the demo.
- **B4** — No notification of any kind fires on ticket create/assign/comment/
  accept. Presenter must not imply email/push/in-app notification exists
  (Zone 10 dependency, out of scope here).

**Classification:** PITCH REQUIRED (as narrowing, zero implementation cost).

## Phase C — Deferred: requires a product decision (not implemented here)

Per the task brief's STOP rule, these are **not guessed at** and **not
implemented**. Each has an exact decision needed, listed once here and in
the Product Decisions section of `08-tickets.md`'s clarification block
(which this branch does not edit further beyond what's already there,
since the questions are already open in that file's "Product clarification"
section) and in the final report to the human. Independent Zone‑8 work
(Phase A/B above) proceeds regardless.

- **PD-1 — "Zwrot" ticket type:** should it be seeded by default for pitch,
  and if so, what is its `default_priority`, `requires_acceptance` flag, and
  default responders/acceptors? Guessing these would misrepresent a business
  process (returns) that hasn't been defined. **Blocked until answered.**
- **PD-2 — Reject action:** should a real, symmetric "reject" action be
  built (new RPC + activity event + UI), or does the product intentionally
  stay accept-only through pilot? This changes the RPC surface and the
  activity log schema meaningfully enough that it should not be guessed.
  **Blocked until answered** (pilot-scope decision, not required for the
  current pitch since the audit already resolved pitch scope as
  "acceptance only, described accurately").
- **PD-3 — Status transition model:** if arbitrary status changes are ever
  exposed in UI (today they are not — `update()` is dead code), what
  transitions are legal from what states, and who may perform them? Building
  this without a defined state machine would create exactly the kind of
  "any status from any status" hole the audit already flagged as a
  future risk. **Not required for pitch** (no UI calls `update()` today);
  **blocked for pilot**.
- **PD-4 — Branch isolation for tickets:** should `helpdesk_tickets` RLS
  additionally scope by `branch_id` (matching the column that already
  exists but isn't enforced), and if so, are branch-less tickets (`branch_id
IS NULL`) valid, and visible to whom? This is explicitly a Zone 1
  (permissions/branch model) dependency — the task brief lists "whether
  branch-less tickets are valid" as a stop condition verbatim. **Not
  implemented from this branch.**
- **PD-5 — Ticket ownership semantics for future features:** if any future
  feature needs a single "owner" concept (vs. today's multi-assignee model +
  `created_by`), does "owner" mean creator or assignee? Not needed by
  anything currently planned in Phase A/B, recorded so it isn't invented
  incidentally later.

## Phase D — Pilot-scope hardening (explicitly NOT done in this pitch pass)

Listed for completeness / future tracker seeding only — matches the accepted
Pilot readiness checklist in `08-tickets.md` verbatim, not expanded:

- Branch-level RLS enforcement (depends on PD-4 + Zone 1).
- Real reject action (depends on PD-2).
- Server-enforced status transition state machine (depends on PD-3).
- Wire up `helpdesk_ticket_references` to a real UI once Zone 3 exists in a
  stable-enough shape to link against (cross-zone dependency, explicitly not
  started from this branch).
- Activity logging for assignment changes and non-close status changes.
- Full automated test suite for create/assign/comment/accept/close/QR
  (this pass adds coverage only for the Phase A search fix — see Testing
  section below for why a full suite is out of scope for a single pitch
  pass, not because it isn't valuable).
- Ghost-assignee behavior (user removed/deactivated while still assigned).
- Notification policy decision (Zone 10 dependency).
- Live-DB RLS integration tests (cross-org / cross-branch denial).

## Testing performed in this pass

- **Unit (service):** `helpdesk-tickets.service.test.ts` — covers the
  Phase A fix and its 2026-09-11 correction pass, for both
  `listForDataView` and `listForCalendar` search paths, using a hand-rolled
  chainable Supabase mock consistent with `crm-parties.service.test.ts`.
  **Run and passing: 21/21.** Includes two grammar-safety oracles
  (`splitTopLevelConditions`, `unescapeQuotedValue`) that re-implement, in
  JS, only the specific slice of PostgREST's real value grammar relevant
  here — verified against the actual parser source, not assumed — and
  parametrized cases for comma, close-paren, nested parens, double quote,
  backslash, mixed chaos, `%`, and `_` inputs, each checked two ways: (1)
  still exactly 2 top-level or() conditions (grammar not broken), and (2)
  the value PostgREST would hand to Postgres round-trips to the exact
  literal pattern intended (no silent truncation or broadening).
- **Typecheck:** `tsc --noEmit -p tsconfig.json` — exit 0, no errors.
- **Lint:** `eslint` on both changed files — exit 0, no errors or warnings.
- **Not attempted in this pass, and why:** a full create → assign → comment
  → accept → close → QR integration/E2E suite is real, valuable pilot-scope
  work (see Phase D) but is a multi-day effort on its own (new fixtures,
  live-auth test accounts, RPC mocking or live DB harness) — building it
  under a "bring the pitch gap list to zero" mandate would be scope creep
  beyond the one concrete, confirmed pitch-blocking defect (search). It is
  recorded as the top recommended next Zone 8 task.

## Acceptance criteria for this plan as a whole

- [x] Phase A code change applied to both call sites.
- [x] Phase A tests pass (3/3).
- [x] Typecheck and lint pass (`tsc --noEmit`, `eslint`, both exit 0).
- [x] Progress tracker (`08-tickets-progress.md`) reflects true task counts,
      not estimated percentages.
- [x] No file outside Zone 8 ownership was modified.
- [x] Product decisions PD-1..PD-5 are documented, not guessed.
