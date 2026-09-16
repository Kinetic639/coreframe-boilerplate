# IC-7A — Security Evidence

All results below are from this session's own live runs against
`supabase-target`, via Supabase MCP `execute_sql`, in safe, transaction-
scoped probes (`BEGIN ... ROLLBACK`). Nothing here is inferred, assumed,
or trusted from a prior report without re-verification.

## Pre-fix reproduction (fresh, not trusted from IC-3's own prior report)

**Function state before this pass** (live-queried):

| Function                        | Signature                                                   | `SECURITY DEFINER` | Owner      | `anon` EXECUTE |
| ------------------------------- | ----------------------------------------------------------- | ------------------ | ---------- | -------------- |
| `inventory_create_draft`        | `(uuid,uuid,text,jsonb,date,date,text,text,text,text,uuid)` | true               | `postgres` | **true**       |
| `inventory_finalize_posting`    | `(uuid,uuid)`                                               | true               | `postgres` | **true**       |
| `inventory_create_and_finalize` | `(uuid,uuid,text,jsonb,date,date,text,text,text,text,uuid)` | true               | `postgres` | **true**       |

**Body inspection** (`pg_get_functiondef`, re-fetched fresh this pass):
`inventory_create_draft` contained ZERO reference to `auth.uid()` and
ZERO call to `has_branch_permission` anywhere in its body —
`p_actor_user_id` was accepted and used ONLY to stamp `created_by`/
`actor_user_id` audit columns, fully spoofable. RLS (the only nominal
protection on the underlying tables) is structurally bypassed by this
function's own `SECURITY DEFINER`/owner-`postgres` execution context
(`rolbypassrls=true` for `postgres`, confirmed via `pg_roles`).

**Exploit A** (`inventory_create_and_finalize`, as `anon`, zero JWT
claims, zero session):

```sql
SET LOCAL ROLE anon;
-- no request.jwt.claims set at all
SELECT inventory_create_and_finalize(
  <arbitrary org>, <arbitrary fresh branch>, '101',
  [{"variant_id": ..., "quantity": 777, "destination_location_id": ...}],
  NULL, NULL, NULL, NULL, NULL, NULL, NULL  -- p_actor_user_id = NULL
);
```

**Result**: `{"status":"posted","document_number":"PZ/2026/000023"}`.
Post-probe query confirmed `on_hand_quantity = 777.000000` at the target
location. **Succeeded as a fully unauthenticated caller.**

**Exploit B** (`inventory_create_draft` + `inventory_finalize_posting`,
same conditions, separate probe): both succeeded independently as `anon`
— draft created, then finalized to `status='posted'`, `on_hand=55`.

## Caller-graph audit (performed BEFORE any grant was touched)

Repo-wide TypeScript grep (`apps/web/src`) plus a live `pg_proc`
source-text sweep (`prosrc ILIKE '%inventory_create_draft%'` etc. across
every function in `public`) found:

- `InventoryMovementsService.createDraft`/`.finalizePosting`/
  `.createAndFinalize` call the three target RPCs DIRECTLY via
  `supabase.rpc(...)`.
- Wrapped by 5 real, reachable Next.js server actions:
  `createDraftMovementAction`, `finalizePostingAction`,
  `createAndPostMovementAction`, `quickReceiptAction`/`receiveStockAction`,
  `quickBinMoveAction`/`transferStockAction` — each traced one level up
  to a real page/component that calls it (`/dashboard/warehouse/
inventory/movements/new`, the movement detail panel's own "Post"
  action, `/dashboard/warehouse/inventory`'s own quick-action buttons).
  All run as the browser session's own `authenticated` role.
- `inventory_approve_count_session` (the live 401/402 adjustment flow) is
  **NOT** `SECURITY DEFINER` (confirmed live via `pg_get_functiondef` —
  no such clause in its definition) — its own nested calls into
  `inventory_create_draft`/`inventory_finalize_posting` therefore execute
  as the REAL, non-elevated invoking role, not an elevated one.
- `inventory_receive_stock`, `receive_repair_order_stock`, `inventory_
receive_purchase_order`, `putaway_repair_order_stock` are all
  themselves `SECURITY DEFINER` owned by `postgres` — their own nested
  calls are unaffected by any grant change on the three target functions,
  by standard same-owner `SECURITY DEFINER` privilege semantics.
- `inventory_accept_branch_transfer`/`inventory_decline_branch_transfer`
  do NOT call any of the three target functions at all.

**Conclusion driving the fix design**: revoking `authenticated` EXECUTE
on any of the three target functions (full internalization) would have
broken 5 real, currently-working production flows plus the live
count-session-approval flow. Option B (harden in place) was the only
caller-graph-consistent choice.

## Fix applied (see `migration-summary.md` for full detail)

Actor-identity (`28000`) + permission (`42501`) checks added to
`inventory_create_draft`, `inventory_finalize_posting_internal` (the
shared finalize choke point), and `inventory_create_and_finalize`
(defense in depth). `anon`/PUBLIC EXECUTE revoked from all three;
`authenticated`/`service_role` kept.

## Post-fix grant matrix (live-queried, not summarized from migration text)

| Function                                                                  | `anon`   | `authenticated` | `service_role` | `postgres` |
| ------------------------------------------------------------------------- | -------- | --------------- | -------------- | ---------- |
| `inventory_create_draft`                                                  | false    | **true**        | **true**       | true       |
| `inventory_finalize_posting` (public, 2-arg)                              | false    | **true**        | **true**       | true       |
| `inventory_finalize_posting_internal` (3-arg)                             | false    | **false**       | **false**      | true       |
| `inventory_create_and_finalize`                                           | false    | **true**        | **true**       | true       |
| `inventory_receive_stock` (IC-3, unaffected)                              | false    | true            | true           | true       |
| `receive_repair_order_stock` (IC-3, unaffected)                           | false    | true            | true           | true       |
| `inventory_receive_purchase_order` (IC-3, unaffected)                     | false    | true            | true           | true       |
| `inventory_reverse_movement` (IC-2, unaffected)                           | false    | true            | true           | true       |
| `inventory_approve_count_session` (pre-existing, NOT touched — see below) | **true** | true            | true           | true       |

**Note on `inventory_approve_count_session`'s own `anon` grant**: still
`true`, deliberately NOT touched this pass (out of narrow scope — not
one of the 3 named engine functions). Functionally, an `anon` call to it
would still fail: its own `has_branch_permission` check runs before any
create_draft call and would reject an `anon` caller (no org membership,
no permission rows), and even if that were somehow bypassed, the
newly-hardened `inventory_create_draft`/`inventory_finalize_posting`
beneath it would reject it too — defense in depth via two independent
layers, not relying on this function's own grant alone.

## Post-fix exploit replay (required evidence)

The EXACT original Exploit A payload (unauthenticated `anon`, arbitrary
fresh org/branch, 777 units, via `inventory_create_and_finalize`) was
replayed against the post-fix database:

```sql
SET LOCAL ROLE anon;
SELECT inventory_create_and_finalize(...same payload as Exploit A...);
```

**Result**: `SQLSTATE 42501`, `permission denied for function inventory_
create_and_finalize` — a grant-level denial (the call never reaches the
function body's own new checks at all, since `anon` no longer has
EXECUTE). Post-probe query: `header_count=0`, `balance_count=0` for the
target org/branch. **Zero physical mutation. The exploit is closed.**

## Stale-overload verification (this project's own recurring pitfall)

None of this pass's 4 migrations changed any function's own arity —
`inventory_create_draft` and `inventory_create_and_finalize` kept their
11-arg signature; `inventory_finalize_posting_internal` kept its 3-arg
signature; the public `inventory_finalize_posting` kept its 2-arg
signature. `SELECT oid::regprocedure FROM pg_proc WHERE proname = ...`
confirmed exactly one overload for each, after every migration — no
stale, still-vulnerable overload survived any `CREATE OR REPLACE` this
pass.

## Default-privilege root cause (investigated, NOT changed)

`SELECT defaclacl FROM pg_default_acl WHERE defaclnamespace = 'public'::
regnamespace AND defaclobjtype = 'f'` (function default ACL for role
`postgres` in schema `public`) returned:
`{postgres=X/postgres, anon=X/postgres, authenticated=X/postgres,
service_role=X/postgres}` — confirming EVERY function `postgres` creates
in `public` automatically receives `anon`/`authenticated`/`service_role`
EXECUTE by default, schema-wide. This is the exact, confirmed mechanism
behind IC-2's own "anon re-grant after CREATE OR REPLACE" finding.

**Deliberately NOT changed this pass**: altering this default privilege
(`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ... FROM anon`) would
affect every FUTURE function `postgres` creates anywhere in `public`, not
just the movement engine — this database has other migrations
(`20260423100000_qr_platform_foundation`, `public_warehouse_maps`) that
suggest genuinely intentional public-facing RPC surfaces exist elsewhere,
which were not audited this pass. Changing the default blind risked
silently breaking unrelated, unaudited functionality. Reported here for
the full IC-7 phase's own decision, per the pass's own explicit fallback
instruction — each of this pass's own migrations instead issues its own
explicit, final `REVOKE`, the already-proven-safe IC-2 pattern.
