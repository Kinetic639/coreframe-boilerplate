-- ============================================================
-- TARGET Phase 1 — Batch 4 / File 13
-- Tables: invitations, invitation_role_assignments
-- Indexes: 5 on invitations, 1 on invitation_role_assignments
-- RLS policies: invitations (5 + service_role),
--               invitation_role_assignments (2 + service_role)
-- ============================================================
-- Purpose      : Invitation system. invitations tracks pending/
--                accepted/declined/cancelled invitations.
--                invitation_role_assignments (IRA) stores the
--                multi-role assignment payload to be copied into
--                user_role_assignments on acceptance.
-- Dependencies : organizations, branches, users, roles
--                (Batches 1–2), is_org_member, has_permission
--                (Batch 2 File 8)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY:
--
--   1. invitations.team_id: column preserved but FK omitted.
--      LEGACY has team_id → teams(id) ON DELETE NO ACTION.
--      The teams table does not exist in TARGET Phase 1 scope.
--      The column is kept for schema parity; the FK will be
--      added when the teams module is ported.
--
--   2. invitations.role_id FK: ON DELETE SET NULL preserved.
--      This is a nullable legacy single-role pointer column
--      (superseded by invitation_role_assignments for new flows).
--      SET NULL on role deletion is appropriate for a pointer
--      column — same rationale as user_preferences pointer FKs.
--      Not treated as a cascade issue under soft-delete-first
--      because roles are soft-deleted; hard-deletes of roles
--      are rare admin operations where losing the pointer is
--      acceptable.
--
--   3. invitations.organization_id / branch_id / invited_by:
--      plain FK NO ACTION (matches LEGACY). Under soft-delete-
--      first, hard-deletes of orgs/branches/users are blocked by
--      these FKs, forcing explicit cleanup of invitations first.
--
--   4. invitation_role_assignments: RLS enabled, NOT forced.
--      Matches LEGACY exactly. service_role bypasses via
--      BYPASSRLS attribute; postgres superuser bypasses on
--      non-forced tables.
--
--   5. IRA policies: LEGACY has both TO {public} (a bug).
--      TARGET corrects both to TO authenticated.
--      Functional semantics are unchanged — unauthenticated
--      users never legitimately create or read IRA rows — but
--      the explicit role prevents future accidental exposure.
-- ============================================================

-- ============================================================
-- invitations
-- ============================================================
create table if not exists public.invitations (
  id                  uuid        not null default gen_random_uuid(),
  email               text        not null,
  invited_by          uuid        not null,
  organization_id     uuid,
  branch_id           uuid,
  team_id             uuid,           -- FK deferred: teams table not in Phase 1 scope (deviation 1)
  role_id             uuid,           -- Legacy single-role field; superseded by IRA for new flows
  token               text        not null,
  status              text        not null default 'pending'::text,
  expires_at          timestamptz,
  accepted_at         timestamptz,
  created_at          timestamptz          default timezone('utc'::text, now()),
  deleted_at          timestamptz,
  declined_at         timestamptz,
  invited_first_name  text,
  invited_last_name   text,

  constraint invitations_pkey
    primary key (id),

  -- Plain FK (NO ACTION). Soft-delete-first: hard-deleting an org
  -- with pending invitations is blocked until they are cleaned up.
  constraint invitations_organization_id_fkey
    foreign key (organization_id) references public.organizations(id),

  -- Plain FK (NO ACTION). Matches LEGACY. Same rationale as above.
  constraint invitations_branch_id_fkey
    foreign key (branch_id) references public.branches(id),

  -- Plain FK (NO ACTION). Matches LEGACY.
  constraint invitations_invited_by_fkey
    foreign key (invited_by) references public.users(id),

  -- ON DELETE SET NULL (deviation 2): role_id is a nullable pointer.
  -- If the role is hard-deleted, the pointer clears gracefully.
  -- Last constraint — no trailing comma (trailing commas are invalid
  -- in PostgreSQL CREATE TABLE definition lists).
  constraint invitations_role_id_fkey
    foreign key (role_id) references public.roles(id)
    on delete set null
);

-- Note: team_id FK is intentionally absent above — teams table does
-- not exist in Phase 1. When the teams module is ported, add:
--   alter table public.invitations
--     add constraint invitations_team_id_fkey
--     foreign key (team_id) references public.teams(id);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

-- ============================================================
-- Indexes on invitations (all mirror LEGACY exactly)
-- ============================================================

-- General email lookups.
create index if not exists idx_invitations_email
  on public.invitations (email);

-- Filtered lookup: active invitations by email + status + expiry.
-- Supports eligibility checks and listing.
create index if not exists idx_invitations_email_status_expires
  on public.invitations (email, status, expires_at)
  where deleted_at is null;

-- Token lookup: used by accept/decline/preview RPCs.
create index if not exists idx_invitations_token
  on public.invitations (token);

-- Filtered token lookup: accept/decline/preview with live-only rows.
create index if not exists idx_invitations_token_status_email
  on public.invitations (token, status, email)
  where deleted_at is null;

-- Partial UNIQUE: prevents duplicate pending invitations per org+email.
-- Case-insensitive via lower(email). Only live, pending rows constrained.
create unique index if not exists invitations_org_pending_email_idx
  on public.invitations (organization_id, lower(email))
  where status = 'pending' and deleted_at is null;

-- ============================================================
-- invitations RLS policies
--
-- All policies check deleted_at IS NULL (soft-delete: deleted
-- invitations are invisible to all non-service callers).
--
-- service_role: bypasses FORCE RLS via BYPASSRLS attribute.
-- Added explicitly for defensive clarity.
-- ============================================================

-- Org admins with invites.create can insert invitations.
create policy "invitations_insert_permission"
  on public.invitations
  for insert
  to authenticated
  with check (
    public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'invites.create')
    and deleted_at is null
  );

-- Org admins with invites.read can see all org invitations.
-- Invitees can always see their own invitation (by email match).
-- Both branches guarded by deleted_at IS NULL via outer AND.
create policy "invitations_select_permission"
  on public.invitations
  for select
  to authenticated
  using (
    (
      (
        public.is_org_member(organization_id)
        and public.has_permission(organization_id, 'invites.read')
      )
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and deleted_at is null
  );

-- Org admins with invites.cancel can cancel (update status) invitations.
create policy "invitations_update_org_cancel"
  on public.invitations
  for update
  to authenticated
  using (
    public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'invites.cancel')
    and deleted_at is null
  )
  with check (
    public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'invites.cancel')
    and deleted_at is null
  );

-- Invitee can mark their own invitation as accepted.
-- WITH CHECK enforces that the caller can only write accepted status
-- with a non-null accepted_at.
create policy "invitations_update_self_accept"
  on public.invitations
  for update
  to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and deleted_at is null
  )
  with check (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'accepted'
    and accepted_at is not null
    and deleted_at is null
  );

-- Invitee can mark their own invitation as cancelled via direct update.
-- Note: this is DISTINCT from the decline_invitation() RPC which sets
-- status='declined'. 'cancelled' = invitee withdraws before accepting;
-- 'declined' = invitee explicitly rejects via the RPC flow. Both are
-- legitimate states; the policy covers only the direct-update path.
create policy "invitations_update_self_cancel"
  on public.invitations
  for update
  to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and deleted_at is null
  )
  with check (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'cancelled'
    and deleted_at is null
  );

-- service_role: full access (defensive explicit policy).
create policy "invitations_all_service_role"
  on public.invitations
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- invitation_role_assignments
-- Stores the role assignment payload for an invitation.
-- Copied into user_role_assignments when the invitation is
-- accepted (by accept_invitation_and_join_org RPC or the
-- handle_user_signup_hook).
-- ============================================================
create table if not exists public.invitation_role_assignments (
  id            uuid        not null default gen_random_uuid(),
  invitation_id uuid        not null,
  role_id       uuid        not null,
  scope         text        not null,
  scope_id      uuid,
  created_at    timestamptz not null default now(),

  constraint invitation_role_assignments_pkey
    primary key (id),

  constraint invitation_role_assignments_scope_check
    check (scope = any (array['org'::text, 'branch'::text])),

  -- CASCADE: IRA rows are meaningless without the parent invitation.
  -- Preserved from LEGACY. When an invitation is hard-deleted (admin
  -- cleanup after acceptance/cancellation), IRA rows are removed
  -- atomically. This is the one intentional CASCADE in Batch 4 —
  -- IRA rows have no independent business identity.
  constraint invitation_role_assignments_invitation_id_fkey
    foreign key (invitation_id) references public.invitations(id)
    on delete cascade,

  -- RESTRICT: deleting a role that is referenced by a pending IRA
  -- is blocked. Prevents orphaned role references in IRA payloads.
  -- Matches LEGACY.
  constraint invitation_role_assignments_role_id_fkey
    foreign key (role_id) references public.roles(id)
    on delete restrict
);

-- RLS: enabled, NOT forced. Matches LEGACY exactly.
-- service_role bypasses via BYPASSRLS; postgres superuser bypasses
-- on non-forced tables (allows hook to insert without a policy).
alter table public.invitation_role_assignments enable row level security;

-- Index: invitation_id lookups (join from invitations table).
create index if not exists ira_invitation_id_idx
  on public.invitation_role_assignments (invitation_id);

-- ============================================================
-- invitation_role_assignments RLS policies
--
-- LEGACY deviation: both policies were TO {public} (bug).
-- TARGET corrects both to TO authenticated.
-- Functional semantics unchanged — unauthenticated users never
-- legitimately access IRA rows. The TO authenticated clause
-- prevents accidental exposure if anon role gains other permissions.
-- ============================================================

-- Org admins with invites.read can view IRA rows for their invitations.
create policy "ira_select_org_admin"
  on public.invitation_role_assignments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_role_assignments.invitation_id
        and i.organization_id is not null
        and public.has_permission(i.organization_id, 'invites.read')
    )
  );

-- Org admins with invites.create can insert IRA rows.
create policy "ira_insert_org_admin"
  on public.invitation_role_assignments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_role_assignments.invitation_id
        and i.organization_id is not null
        and public.has_permission(i.organization_id, 'invites.create')
    )
  );

-- service_role: full access.
create policy "ira_all_service_role"
  on public.invitation_role_assignments
  for all
  to service_role
  using (true)
  with check (true);
