-- =============================================
-- Trigger: Insert into public.users on user registration
-- =============================================

-- 1. Drop the trigger if it exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Drop the function if it exists (idempotent)
drop function if exists public.handle_new_auth_user();

-- 3. Create the function
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, timezone('utc', now()))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 4. Create the trigger
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();