-- 1. Dodaj kolumnę slug do branches (jeśli nie istnieje)
alter table public.branches
add column if not exists slug text;

-- 2. Utwórz tabelę branch_profiles
create table if not exists public.branch_profiles (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  name text,
  slug text,
  created_at timestamptz default now()
);

-- 3. Utwórz funkcję triggera
create or replace function public.handle_branch_profiles()
returns trigger as $$
declare
  generated_slug text := lower(regexp_replace(new.name, '[^a-zA-Z0-9]+', '-', 'g'));
begin
  -- Wstaw lub zaktualizuj wpis w branch_profiles
  insert into public.branch_profiles (branch_id, name, slug)
  values (new.id, new.name, generated_slug)
  on conflict (branch_id) do update
    set name = excluded.name,
        slug = excluded.slug;

  return new;
end;
$$ language plpgsql;

-- 4. Usuń poprzedni trigger (jeśli istnieje)
drop trigger if exists trigger_update_branch_profiles on public.branches;

-- 5. Dodaj nowy trigger po stronie branches
create trigger trigger_update_branch_profiles
after insert or update on public.branches
for each row
execute function public.handle_branch_profiles();
