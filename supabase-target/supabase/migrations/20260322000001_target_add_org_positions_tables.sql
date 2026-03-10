-- ============================================================
-- Add org_positions and org_position_assignments tables to TARGET
-- Schema matches LEGACY exactly. user_id FK → public.users
-- (consistent with TARGET's organization_members pattern).
-- ============================================================

create table public.org_positions (
  id          uuid        not null default gen_random_uuid() primary key,
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  name        text        not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id) on delete set null,
  deleted_at  timestamptz
);

create table public.org_position_assignments (
  id          uuid        not null default gen_random_uuid() primary key,
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  user_id     uuid        not null references public.users(id) on delete cascade,
  position_id uuid        not null references public.org_positions(id) on delete cascade,
  branch_id   uuid        references public.branches(id) on delete set null,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users(id) on delete set null,
  deleted_at  timestamptz,
  constraint uq_position_assignment unique nulls not distinct (org_id, user_id, position_id, branch_id)
);

-- Enable RLS
alter table public.org_positions enable row level security;
alter table public.org_position_assignments enable row level security;

-- org_positions policies
create policy "org_members_can_read_positions"
  on public.org_positions for select
  using (is_org_member(org_id) and deleted_at is null);

create policy "members_manage_can_insert_position"
  on public.org_positions for insert
  with check (is_org_member(org_id) and has_permission(org_id, 'members.manage') and deleted_at is null);

create policy "members_manage_can_update_position"
  on public.org_positions for update
  using (is_org_member(org_id) and has_permission(org_id, 'members.manage') and deleted_at is null)
  with check (is_org_member(org_id) and has_permission(org_id, 'members.manage'));

-- org_position_assignments policies
create policy "org_members_can_read_assignments"
  on public.org_position_assignments for select
  using (is_org_member(org_id) and deleted_at is null);

create policy "members_manage_can_insert_assignment"
  on public.org_position_assignments for insert
  with check (is_org_member(org_id) and has_permission(org_id, 'members.manage') and deleted_at is null);

create policy "members_manage_can_update_assignment"
  on public.org_position_assignments for update
  using (is_org_member(org_id) and has_permission(org_id, 'members.manage'))
  with check (is_org_member(org_id) and has_permission(org_id, 'members.manage'));
