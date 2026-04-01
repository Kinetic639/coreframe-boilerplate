-- =============================================
-- Trigger: Insert into public.users on user registration
-- =============================================

-- Drop the trigger if it exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

-- Drop the function if it exists (idempotent)
drop function if exists public.handle_new_auth_user();

-- Function to insert into public.users after new auth.users row
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, timezone('utc', now()))
  on conflict (id) do nothing; -- Use DO NOTHING for idempotency in case of retries
  return new;
end;
$$ language plpgsql security definer;

-- Grant usage and execute on the function to the auth superuser
grant usage on schema public to supabase_auth_admin;
grant execute on function public.handle_new_auth_user() to supabase_auth_admin;

-- Create trigger to call the function after insert on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Note: Supabase automatically grants INSERT to authenticated users on auth.users
-- You may need additional RLS policies on public.users depending on your requirements.
