create table transfer_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  from_branch_id uuid not null,
  to_branch_id uuid not null,
  status text not null check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
  requires_confirmation boolean not null default true,
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  comment text,
  created_at timestamp with time zone default now(),
  constraint valid_confirmation_logic check (
    (from_branch_id != to_branch_id and requires_confirmation = true)
    or
    (from_branch_id = to_branch_id and requires_confirmation = false)
  )
);
