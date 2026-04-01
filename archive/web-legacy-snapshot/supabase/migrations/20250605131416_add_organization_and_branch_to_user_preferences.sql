-- Add organization_id and default_branch_id to user_preferences
alter table public.user_preferences
add column if not exists organization_id uuid;

alter table public.user_preferences
add column if not exists default_branch_id uuid;

-- Add organization_id constraint if not exists
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_preferences_organization_id_fkey'
  ) then
    alter table public.user_preferences
    add constraint user_preferences_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete set null;
  end if;
end
$$;

-- Add default_branch_id constraint if not exists
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_preferences_default_branch_id_fkey'
  ) then
    alter table public.user_preferences
    add constraint user_preferences_default_branch_id_fkey
    foreign key (default_branch_id)
    references public.branches(id)
    on delete set null;
  end if;
end
$$;
