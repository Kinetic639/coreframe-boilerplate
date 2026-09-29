# Tickets / Tasks Scope Verification

UAT observation: after switching branch, warehouse data and RepairOrders change, but the **Tickets** and **Tasks** lists look unchanged. Verified against code, live RLS (read-only `pg_policies`), and the zone docs. **Nothing was changed.**

## A. Help Desk Tickets

- **Data model:** `helpdesk_tickets.branch_id` exists as an optional column.
- **Live RLS (`helpdesk_tickets_select`):** `is_org_member(org_id) AND has_permission(org_id, 'helpdesk.tickets.read')` — **org-scoped, no branch predicate.**
- **List cache scope:** `tickets/page.tsx` and `tickets-client.tsx` use `dataViewScope.organization(orgId)` — deliberately org-scoped.
- **UI:** org-wide list with an optional, user-selectable branch _filter_ (re-confirmed in Zone 1 Phase 5's re-sweep).
- **Intended scope:** undecided. Zone 8's plan lists it as open product decision **PD-4** ("should `helpdesk_tickets` RLS additionally scope by `branch_id`…"). Zone 1 tracks the related RLS gap as **BLOCKER-Z1-010** (PILOT Phase D).
- **Dashboard contrast:** the home dashboard's attention widget _is_ branch-filtered (`attentionFilters(branchId)`), so the dashboard ticket queue changes on switch while the Tickets list doesn't. Both match their current design.

## B. Planning Tasks

- **Data model:** `planning_tasks.branch_id` is optional; `NULL` means an org-wide task.
- **Live RLS (`planning_tasks_select`, from main's `20260912065316_planning_tasks_branch_scope_rls.sql`):** org-wide tasks need an org permission; branch tasks need `has_branch_permission` for **that task's** branch. This is an **access** boundary, not an active-branch filter.
- **List cache scope:** `tasks-client.tsx` uses `dataViewScope.organization(orgId)`.
- **UI:** the list shows every task the user may access, across branches. The UAT account holds org-wide grants, so it sees all tasks whatever branch is active. `activeBranchId` is passed down but only used as a default (e.g. in the create form), not as a list filter.
- **Intended scope:** undecided. `09-planning.md` has an open item: `branch_id` is "today only an optional filtering tag, not an enforced RLS boundary; Kanban boards have no branch concept at all — to be accepted consciously or hardened." The later RLS migration made branch _access_ enforced, but active-branch _filtering_ of the list remains undecided.

## Result

| Surface                | Intended scope                                     | Current implementation                                                              | Bug?                                                                                                |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Help Desk Tickets list | **Undecided** (Zone 8 PD-4; BLOCKER-Z1-010, PILOT) | Org-scoped RLS, org-scoped cache, optional manual branch filter                     | **No** — matches the current, deliberately org-wide design                                          |
| Planning Tasks list    | **Undecided** (`09-planning.md` open item)         | Access-scoped RLS (org or task's branch), org-scoped cache, no active-branch filter | **No** — matches the current design; a user with org-wide grants correctly sees all branches' tasks |

**For the pitch:** this can surprise someone watching a branch-switch demo (warehouse changes, tickets and tasks don't). It's a presentation-choreography and product question, not a regression. It's worth a product decision before the pitch: accept "tickets/tasks are org-wide" and say so on stage, or scope these lists to the active branch later (PILOT). No change was made in this audit.
